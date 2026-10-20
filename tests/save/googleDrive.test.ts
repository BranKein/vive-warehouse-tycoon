import { describe, expect, it } from 'vitest';
import type { SaveData } from '@/contracts';
import {
  CURRENT_SAVE_VERSION,
  CloudAuthError,
  CloudCancelledError,
  DRIVE_APPDATA_SCOPE,
  GOOGLE_SESSION_KEY,
  GoogleDriveProvider,
  memoryStorage,
  type KeyValueStorage,
} from '@/save';

const data: SaveData = {
  version: CURRENT_SAVE_VERSION,
  savedAt: 1234,
  summary: { money: '9', buildings: 1, playSeconds: 5 },
  state: { money: '9' },
};

/** A tiny Drive: one appDataFolder, files by id. */
function fakeDrive() {
  const files = new Map<string, string>();
  const calls: Array<{ method: string; url: string; auth: string | null }> = [];
  let next = 1;
  let status: number | null = null;
  const fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = String(input);
    const method = init.method ?? 'GET';
    const auth = new Headers(init.headers).get('Authorization');
    calls.push({ method, url, auth });
    if (status !== null) return new Response('{}', { status });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?')) {
      const ids = [...files.keys()].reverse();
      return Response.json({ files: ids.slice(0, 1).map((id) => ({ id })) });
    }
    const media = url.match(/drive\/v3\/files\/([^?]+)\?alt=media/);
    if (media) {
      const body = files.get(media[1]!);
      return body ? new Response(body) : new Response('{}', { status: 404 });
    }
    const patch = url.match(/upload\/drive\/v3\/files\/([^?]+)\?uploadType=media/);
    if (patch && method === 'PATCH') {
      if (!files.has(patch[1]!)) return new Response('{}', { status: 404 });
      files.set(patch[1]!, String(init.body));
      return Response.json({ id: patch[1] });
    }
    if (url.includes('uploadType=multipart') && method === 'POST') {
      const body = String(init.body);
      expect(body).toContain('"parents":["appDataFolder"]');
      const json = body.split('\r\n\r\n')[2]!.split('\r\n--')[0]!;
      const id = `f${next++}`;
      files.set(id, json);
      return Response.json({ id });
    }
    return new Response('{}', { status: 400 });
  };
  return { files, calls, fetch, fail: (code: number | null) => (status = code) };
}

/** Google Identity Services standing in: answers each token request with `respond`. */
function fakeGis(respond: () => { access_token?: string; expires_in?: number; error?: string } | 'closed') {
  const requests: string[] = [];
  const revoked: string[] = [];
  return {
    requests,
    revoked,
    oauth2: {
      initTokenClient(config: { scope: string; callback: (r: object) => void; error_callback?: (e: { type: string }) => void }) {
        return {
          requestAccessToken() {
            requests.push(config.scope);
            const answer = respond();
            if (answer === 'closed') config.error_callback?.({ type: 'popup_closed' });
            else config.callback({ ...answer, scope: DRIVE_APPDATA_SCOPE });
          },
        };
      },
      hasGrantedAllScopes: (response: { scope?: string }, ...scopes: string[]) => scopes.every((s) => response.scope?.includes(s)),
      revoke: (token: string) => void revoked.push(token),
    },
  };
}

function setup(options: { storage?: KeyValueStorage; now?: () => number; respond?: Parameters<typeof fakeGis>[0] } = {}) {
  const drive = fakeDrive();
  const gis = fakeGis(options.respond ?? (() => ({ access_token: 'tok', expires_in: 3600 })));
  const storage = options.storage ?? memoryStorage();
  const provider = new GoogleDriveProvider({
    clientId: 'id.apps.googleusercontent.com',
    storage,
    fetch: drive.fetch as typeof fetch,
    loadOAuth: async () => gis.oauth2,
    now: options.now ?? (() => 0),
  });
  return { drive, gis, storage, provider };
}

describe('GoogleDriveProvider', () => {
  it('asks only for the app data scope and keeps the token', async () => {
    const { provider, gis, storage } = setup();
    expect(await provider.restore()).toBe('off');
    await provider.connect();
    expect(gis.requests).toEqual([DRIVE_APPDATA_SCOPE]);
    expect(JSON.parse(storage.getItem(GOOGLE_SESSION_KEY)!)).toEqual({ token: 'tok', expiresAt: 3_600_000 });
    expect(await provider.restore()).toBe('connected');
  });

  it('writes one file in the app folder and reads it back', async () => {
    const { provider, drive } = setup();
    await provider.connect();
    expect(await provider.read()).toBeNull();
    await provider.write({ data, device: 'Mac · Chrome' });
    await provider.write({ data: { ...data, savedAt: 5678 }, device: 'Mac · Chrome' });
    expect(drive.files.size).toBe(1);
    expect(await provider.read()).toEqual({ data: { ...data, savedAt: 5678 }, device: 'Mac · Chrome' });
    expect(drive.calls.every((call) => call.auth === 'Bearer tok')).toBe(true);
  });

  it('finds the file another device wrote', async () => {
    const storage = memoryStorage();
    const a = setup({ storage });
    await a.provider.connect();
    await a.provider.write({ data, device: 'PC' });
    const b = new GoogleDriveProvider({ clientId: 'x', storage, fetch: a.drive.fetch as typeof fetch, now: () => 0 });
    expect(await b.read()).toEqual({ data, device: 'PC' });
  });

  it('creates the file again when it was deleted', async () => {
    const { provider, drive } = setup();
    await provider.connect();
    await provider.write({ data, device: 'PC' });
    drive.files.clear();
    await provider.write({ data, device: 'PC' });
    expect(drive.files.size).toBe(1);
  });

  it('an expired token is an auth error without a network call', async () => {
    let now = 0;
    const { provider, drive } = setup({ now: () => now });
    await provider.connect();
    now = 3_600_000;
    expect(await provider.restore()).toBe('expired');
    await expect(provider.read()).rejects.toBeInstanceOf(CloudAuthError);
    expect(drive.calls).toHaveLength(0);
  });

  it('a 401 from Drive is an auth error and marks the session expired', async () => {
    const { provider, drive } = setup();
    await provider.connect();
    drive.fail(401);
    await expect(provider.read()).rejects.toBeInstanceOf(CloudAuthError);
    expect(await provider.restore()).toBe('expired');
  });

  it('other Drive failures are plain errors', async () => {
    const { provider, drive } = setup();
    await provider.connect();
    drive.fail(503);
    const error = await provider.read().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(CloudAuthError);
  });

  it('closing the popup or declining is a cancel', async () => {
    await expect(setup({ respond: () => 'closed' }).provider.connect()).rejects.toBeInstanceOf(CloudCancelledError);
    await expect(setup({ respond: () => ({ error: 'access_denied' }) }).provider.connect()).rejects.toBeInstanceOf(CloudCancelledError);
  });

  it('disconnecting revokes the token and forgets it', async () => {
    const { provider, gis, storage } = setup();
    await provider.connect();
    await provider.disconnect();
    expect(gis.revoked).toEqual(['tok']);
    expect(storage.getItem(GOOGLE_SESSION_KEY)).toBeNull();
    expect(await provider.restore()).toBe('off');
  });
});
