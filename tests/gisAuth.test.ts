import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GisAuthManager, AuthState } from '../src/services/gisAuth';

describe('GisAuthManager', () => {
  const TEST_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

  beforeEach(() => {
    vi.restoreAllMocks();
    document.head.innerHTML = '';
    // Clean up window.google
    if (window.google) {
      delete (window as any).google;
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with unauthenticated state', () => {
    const auth = new GisAuthManager(TEST_CLIENT_ID);
    expect(auth.getToken()).toBeNull();
    expect(auth.getAuthState()).toEqual<AuthState>({
      token: null,
      expiresAt: null,
      isAuthenticated: false,
    });
  });

  it('clears token on signOut', () => {
    const auth = new GisAuthManager(TEST_CLIENT_ID);
    // @ts-expect-error test private member
    auth.token = 'dummy-token';
    // @ts-expect-error test private member
    auth.expiresAt = Date.now() + 3600000;

    expect(auth.getToken()).toBe('dummy-token');
    expect(auth.getAuthState().isAuthenticated).toBe(true);

    auth.signOut();

    expect(auth.getToken()).toBeNull();
    expect(auth.getAuthState()).toEqual<AuthState>({
      token: null,
      expiresAt: null,
      isAuthenticated: false,
    });
  });

  describe('expiration buffer logic (Date.now() < expiresAt - 60000)', () => {
    it('returns token when expiration is more than 60 seconds away', () => {
      vi.useFakeTimers();
      const now = 1700000000000;
      vi.setSystemTime(now);

      const auth = new GisAuthManager(TEST_CLIENT_ID);
      // @ts-expect-error test private member
      auth.token = 'valid-token';
      // @ts-expect-error test private member
      auth.expiresAt = now + 61000; // 61s in future (> 60s buffer)

      expect(auth.getToken()).toBe('valid-token');
    });

    it('returns null when expiration is exactly 60 seconds away', () => {
      vi.useFakeTimers();
      const now = 1700000000000;
      vi.setSystemTime(now);

      const auth = new GisAuthManager(TEST_CLIENT_ID);
      // @ts-expect-error test private member
      auth.token = 'expiring-token';
      // @ts-expect-error test private member
      auth.expiresAt = now + 60000; // exactly 60s

      expect(auth.getToken()).toBeNull();
    });

    it('returns null when expiration is less than 60 seconds away', () => {
      vi.useFakeTimers();
      const now = 1700000000000;
      vi.setSystemTime(now);

      const auth = new GisAuthManager(TEST_CLIENT_ID);
      // @ts-expect-error test private member
      auth.token = 'expiring-token';
      // @ts-expect-error test private member
      auth.expiresAt = now + 59000; // 59s

      expect(auth.getToken()).toBeNull();
    });

    it('returns null when expiration is in the past', () => {
      vi.useFakeTimers();
      const now = 1700000000000;
      vi.setSystemTime(now);

      const auth = new GisAuthManager(TEST_CLIENT_ID);
      // @ts-expect-error test private member
      auth.token = 'expired-token';
      // @ts-expect-error test private member
      auth.expiresAt = now - 1000;

      expect(auth.getToken()).toBeNull();
    });

    it('returns null when token or expiresAt is missing', () => {
      const auth = new GisAuthManager(TEST_CLIENT_ID);
      // @ts-expect-error test private member
      auth.token = 'test-token';
      // @ts-expect-error test private member
      auth.expiresAt = null;

      expect(auth.getToken()).toBeNull();
    });
  });

  describe('updateClientId', () => {
    it('updates clientId and resets tokenClient', () => {
      const auth = new GisAuthManager(TEST_CLIENT_ID);
      // @ts-expect-error test private member
      auth.tokenClient = { requestAccessToken: vi.fn() };

      auth.updateClientId('new-client-id.apps.googleusercontent.com');

      // @ts-expect-error test private member
      expect(auth.clientId).toBe('new-client-id.apps.googleusercontent.com');
      // @ts-expect-error test private member
      expect(auth.tokenClient).toBeNull();
    });
  });

  describe('loadGisScript', () => {
    it('resolves immediately if window.google.accounts.oauth2 is already defined', async () => {
      window.google = {
        accounts: {
          oauth2: {} as any,
        },
      } as any;

      const auth = new GisAuthManager(TEST_CLIENT_ID);
      await expect(auth.loadGisScript()).resolves.toBeUndefined();
      expect(document.getElementById('google-gsi-client')).toBeNull();
    });

    it('injects script tag and resolves on script load event', async () => {
      const auth = new GisAuthManager(TEST_CLIENT_ID);
      const promise = auth.loadGisScript();

      const script = document.getElementById('google-gsi-client') as HTMLScriptElement;
      expect(script).not.toBeNull();
      expect(script.src).toBe('https://accounts.google.com/gsi/client');
      expect(script.async).toBe(true);
      expect(script.defer).toBe(true);

      // Trigger load event
      script.onload?.(new Event('load'));
      await expect(promise).resolves.toBeUndefined();
    });

    it('rejects if script loading encounters an error', async () => {
      const auth = new GisAuthManager(TEST_CLIENT_ID);
      const promise = auth.loadGisScript();

      const script = document.getElementById('google-gsi-client') as HTMLScriptElement;
      expect(script).not.toBeNull();

      script.onerror?.(new Event('error') as any);
      await expect(promise).rejects.toThrow('Failed to load Google Identity Services SDK');
    });

    it('attaches to existing script element if already in DOM', async () => {
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      document.head.appendChild(script);

      const auth = new GisAuthManager(TEST_CLIENT_ID);
      const promise = auth.loadGisScript();

      script.dispatchEvent(new Event('load'));
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('requestToken', () => {
    it('successfully acquires token and calculates expiresAt', async () => {
      vi.useFakeTimers();
      const now = 1700000000000;
      vi.setSystemTime(now);

      const mockRequestAccessToken = vi.fn();
      const mockInitTokenClient = vi.fn().mockImplementation((config) => {
        return {
          requestAccessToken: mockRequestAccessToken.mockImplementation(() => {
            config.callback({ access_token: 'mock-access-token-123', expires_in: 3600 });
          }),
        };
      });

      window.google = {
        accounts: {
          oauth2: {
            initTokenClient: mockInitTokenClient,
          },
        },
      } as any;

      const auth = new GisAuthManager(TEST_CLIENT_ID);
      const result = await auth.requestToken();

      expect(mockInitTokenClient).toHaveBeenCalledWith({
        client_id: TEST_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive',
        callback: expect.any(Function),
      });
      expect(mockRequestAccessToken).toHaveBeenCalledWith({ prompt: '' });
      expect(result).toBe('mock-access-token-123');
      expect(auth.getToken()).toBe('mock-access-token-123');
      expect(auth.getAuthState()).toEqual<AuthState>({
        token: 'mock-access-token-123',
        expiresAt: now + 3600 * 1000,
        isAuthenticated: true,
      });
    });

    it('uses default 3600s expires_in if response does not provide one', async () => {
      vi.useFakeTimers();
      const now = 1700000000000;
      vi.setSystemTime(now);

      window.google = {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn().mockImplementation((config) => ({
              requestAccessToken: vi.fn().mockImplementation(() => {
                config.callback({ access_token: 'mock-token-no-expires' });
              }),
            })),
          },
        },
      } as any;

      const auth = new GisAuthManager(TEST_CLIENT_ID);
      const token = await auth.requestToken();

      expect(token).toBe('mock-token-no-expires');
      expect(auth.getAuthState().expiresAt).toBe(now + 3600 * 1000);
    });

    it('rejects if OAuth response contains an error', async () => {
      window.google = {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn().mockImplementation((config) => ({
              requestAccessToken: vi.fn().mockImplementation(() => {
                config.callback({ error: 'access_denied' });
              }),
            })),
          },
        },
      } as any;

      const auth = new GisAuthManager(TEST_CLIENT_ID);
      await expect(auth.requestToken()).rejects.toThrow('access_denied');
      expect(auth.getToken()).toBeNull();
    });

    it('rejects if OAuth response is missing access_token', async () => {
      window.google = {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn().mockImplementation((config) => ({
              requestAccessToken: vi.fn().mockImplementation(() => {
                config.callback({});
              }),
            })),
          },
        },
      } as any;

      const auth = new GisAuthManager(TEST_CLIENT_ID);
      await expect(auth.requestToken()).rejects.toThrow('Authentication canceled');
      expect(auth.getToken()).toBeNull();
    });

    it('rejects if window.google.accounts.oauth2 is not available after script loading', async () => {
      const auth = new GisAuthManager(TEST_CLIENT_ID);
      // Spy on loadGisScript to resolve without defining window.google
      vi.spyOn(auth, 'loadGisScript').mockResolvedValue(undefined);

      await expect(auth.requestToken()).rejects.toThrow('Google Identity Services not available');
    });

    it('uses updated clientId when requesting token after updateClientId', async () => {
      const mockInitTokenClient = vi.fn().mockImplementation((config) => ({
        requestAccessToken: vi.fn().mockImplementation(() => {
          config.callback({ access_token: 'updated-token', expires_in: 3600 });
        }),
      }));

      window.google = {
        accounts: {
          oauth2: {
            initTokenClient: mockInitTokenClient,
          },
        },
      } as any;

      const auth = new GisAuthManager(TEST_CLIENT_ID);
      auth.updateClientId('updated-client-id.apps.googleusercontent.com');
      await auth.requestToken();

      expect(mockInitTokenClient).toHaveBeenCalledWith({
        client_id: 'updated-client-id.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/drive',
        callback: expect.any(Function),
      });
    });
  });
});
