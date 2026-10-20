import type { CloudProvider, CloudRestoreResult, CloudSave } from '@/contracts';
import { CloudAuthError, CloudCancelledError } from '../errors';
import { parseCloudFile, toCloudFile } from '../format';
import { browserStorage, readJson, writeJson, type KeyValueStorage } from '../storage';
import { loadGis, type GisOAuth2, type GisTokenResponse } from './gis';

/** Only the app's own hidden folder in the player's Drive; the game cannot see any of their files. */
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export const DRIVE_FILE_NAME = 'warehouse-tycoon-save.json';
export const GOOGLE_SESSION_KEY = 'warehouse-tycoon.cloud.google';

const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
/** A token this close to running out is treated as gone, so a call does not fail halfway. */
const EXPIRY_MARGIN_MS = 60 * 1000;

interface GoogleSession {
  token: string;
  expiresAt: number;
}

export interface GoogleDriveOptions {
  clientId: string;
  storage?: KeyValueStorage;
  fetch?: typeof fetch;
  loadOAuth?: () => Promise<GisOAuth2>;
  now?: () => number;
}

/**
 * Google Drive through the browser only. The access token lasts about an hour and is kept in `localStorage`
 * so a reload does not ask again; once it runs out the player connects again with one click (Google does not
 * show the consent screen a second time).
 */
export class GoogleDriveProvider implements CloudProvider {
  readonly id = 'google' as const;
  private readonly storage: KeyValueStorage;
  private readonly fetch: typeof fetch;
  private readonly loadOAuth: () => Promise<GisOAuth2>;
  private readonly now: () => number;
  private oauth2: GisOAuth2 | null = null;
  private fileId: string | null = null;

  constructor(private readonly options: GoogleDriveOptions) {
    this.storage = options.storage ?? browserStorage();
    this.fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.loadOAuth = options.loadOAuth ?? loadGis;
    this.now = options.now ?? Date.now;
  }

  prepare(): void {
    if (this.oauth2) return;
    this.loadOAuth().then(
      (oauth2) => (this.oauth2 = oauth2),
      (error: unknown) => console.error(error),
    );
  }

  async restore(): Promise<CloudRestoreResult> {
    const session = readJson<GoogleSession>(this.storage, GOOGLE_SESSION_KEY);
    if (!session) return 'off';
    return this.validToken() ? 'connected' : 'expired';
  }

  connect(): Promise<void> {
    // With the script already loaded the popup opens inside the click; otherwise the browser may block it,
    // and the error asks the player to press the button again (the script is loaded by then).
    if (this.oauth2) return this.requestToken(this.oauth2);
    return this.loadOAuth().then((oauth2) => {
      this.oauth2 = oauth2;
      return this.requestToken(oauth2);
    });
  }

  async disconnect(): Promise<void> {
    const session = readJson<GoogleSession>(this.storage, GOOGLE_SESSION_KEY);
    this.storage.removeItem(GOOGLE_SESSION_KEY);
    this.fileId = null;
    if (!session?.token) return;
    // Withdraws the permission too, so the next connect asks again. A failure here leaves only a token
    // that runs out within the hour.
    if (this.oauth2) {
      this.oauth2.revoke(session.token);
      return;
    }
    await this.fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: session.token }).toString(),
    }).catch(() => undefined);
  }

  async read(): Promise<CloudSave | null> {
    const id = await this.findFile();
    if (!id) return null;
    const response = await this.api(`${FILES_URL}/${encodeURIComponent(id)}?alt=media`, {}, true);
    if (!response) {
      this.fileId = null;
      return null;
    }
    return parseCloudFile(await response.json());
  }

  async write(save: CloudSave): Promise<void> {
    const body = JSON.stringify(toCloudFile(save));
    const id = this.fileId ?? (await this.findFile());
    if (id) {
      const updated = await this.api(
        `${UPLOAD_URL}/${encodeURIComponent(id)}?uploadType=media`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body },
        true,
      );
      if (updated) return;
      this.fileId = null;
    }
    const boundary = `wt-${this.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const metadata = { name: DRIVE_FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' };
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    const created = await this.api(`${UPLOAD_URL}?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipart,
    });
    const json = (await created!.json()) as { id?: string };
    this.fileId = json.id ?? null;
  }

  private requestToken(oauth2: GisOAuth2): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: this.options.clientId,
        scope: DRIVE_APPDATA_SCOPE,
        callback: (response: GisTokenResponse) => {
          if (response.error) {
            reject(response.error === 'access_denied' ? new CloudCancelledError() : new Error(`Google sign-in: ${response.error}`));
            return;
          }
          if (!response.access_token || !oauth2.hasGrantedAllScopes(response, DRIVE_APPDATA_SCOPE)) {
            reject(new CloudCancelledError('Drive permission not granted'));
            return;
          }
          const seconds = Number(response.expires_in) || 3600;
          writeJson(this.storage, GOOGLE_SESSION_KEY, { token: response.access_token, expiresAt: this.now() + seconds * 1000 } satisfies GoogleSession);
          resolve();
        },
        error_callback: (error) => {
          reject(error.type === 'popup_closed' ? new CloudCancelledError() : new Error(`Google sign-in: ${error.type}`));
        },
      });
      client.requestAccessToken();
    });
  }

  private validToken(): string | null {
    const session = readJson<GoogleSession>(this.storage, GOOGLE_SESSION_KEY);
    if (!session?.token || session.expiresAt - EXPIRY_MARGIN_MS <= this.now()) return null;
    return session.token;
  }

  private async findFile(): Promise<string | null> {
    if (this.fileId) return this.fileId;
    const query = new URLSearchParams({
      spaces: 'appDataFolder',
      q: `name = '${DRIVE_FILE_NAME}' and trashed = false`,
      fields: 'files(id)',
      orderBy: 'modifiedTime desc',
      pageSize: '1',
    });
    const response = await this.api(`${FILES_URL}?${query.toString()}`);
    const json = (await response!.json()) as { files?: Array<{ id: string }> };
    this.fileId = json.files?.[0]?.id ?? null;
    return this.fileId;
  }

  /** An authorised Drive call. With `allowMissing`, a 404 gives `null` instead of an error. */
  private async api(url: string, init: RequestInit = {}, allowMissing = false): Promise<Response | null> {
    const token = this.validToken();
    if (!token) throw new CloudAuthError();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const response = await this.fetch(url, { ...init, headers });
    if (response.status === 401) {
      // Keep the session entry (as expired) so the game still knows the player wants Google.
      writeJson(this.storage, GOOGLE_SESSION_KEY, { token: '', expiresAt: 0 } satisfies GoogleSession);
      throw new CloudAuthError();
    }
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error(`Google Drive ${response.status}`);
    return response;
  }
}
