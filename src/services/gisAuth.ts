export interface AuthState {
  token: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

export class GisAuthManager {
  private clientId: string;
  private token: string | null = null;
  private expiresAt: number | null = null;
  private tokenClient: any = null;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  public updateClientId(clientId: string): void {
    this.clientId = clientId;
    this.tokenClient = null;
  }

  public async loadGisScript(): Promise<void> {
    if (window.google?.accounts?.oauth2) return;
    return new Promise((resolve, reject) => {
      const existing = document.getElementById('google-gsi-client');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services SDK')));
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services SDK'));
      document.head.appendChild(script);
    });
  }

  public async requestToken(): Promise<string> {
    await this.loadGisScript();
    return new Promise((resolve, reject) => {
      if (!window.google?.accounts?.oauth2) {
        return reject(new Error('Google Identity Services not available'));
      }
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: 'https://www.googleapis.com/auth/drive',
        callback: (resp) => {
          if (resp.error || !resp.access_token) {
            return reject(new Error(resp.error || 'Authentication canceled'));
          }
          this.token = resp.access_token;
          const expiresIn = resp.expires_in || 3600;
          this.expiresAt = Date.now() + expiresIn * 1000;
          resolve(resp.access_token);
        }
      });
      this.tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  public getToken(): string | null {
    if (this.token && this.expiresAt && Date.now() < this.expiresAt - 60000) {
      return this.token;
    }
    return null;
  }

  public getAuthState(): AuthState {
    const token = this.getToken();
    return {
      token,
      expiresAt: token ? this.expiresAt : null,
      isAuthenticated: Boolean(token),
    };
  }

  public signOut(): void {
    this.token = null;
    this.expiresAt = null;
  }
}
