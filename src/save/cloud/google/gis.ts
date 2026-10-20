/**
 * The slice of Google Identity Services (https://accounts.google.com/gsi/client) this game uses:
 * the token model, which hands the browser a short-lived access token with no server in between.
 */
export interface GisTokenResponse {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface GisTokenError {
  type: 'popup_failed_to_open' | 'popup_closed' | 'unknown' | string;
  message?: string;
}

export interface GisTokenClient {
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void;
}

export interface GisOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: GisTokenResponse) => void;
    error_callback?: (error: GisTokenError) => void;
  }): GisTokenClient;
  hasGrantedAllScopes(response: GisTokenResponse, ...scopes: string[]): boolean;
  revoke(token: string, done?: () => void): void;
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let loading: Promise<GisOAuth2> | null = null;

const found = (): GisOAuth2 | undefined =>
  (globalThis as { google?: { accounts?: { oauth2?: GisOAuth2 } } }).google?.accounts?.oauth2;

/** Adds the script once, the first time it is needed. A failed load can be tried again. */
export function loadGis(): Promise<GisOAuth2> {
  const ready = found();
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<GisOAuth2>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      const oauth2 = found();
      if (oauth2) resolve(oauth2);
      else reject(new Error('Google sign-in script loaded without its API'));
    };
    script.onerror = () => reject(new Error('Google sign-in script failed to load'));
    document.head.append(script);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}
