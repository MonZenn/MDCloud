export interface AppConfig {
  clientId: string;
  folderId: string;
  folderUrl?: string;
  theme: 'dark' | 'light' | 'system';
}

const CONFIG_STORAGE_KEY = 'mdcloud_app_config';

export function parseFolderId(input: string): string {
  const trimmed = input.trim();
  const folderMatch = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }
  const idMatch = trimmed.match(/id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }
  return trimmed;
}

export function sanitizeClientId(input: string): string {
  if (!input) return '';
  let clean = input
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // strip invisible zero-width spaces
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-') // normalize all unicode hyphens/dashes
    .replace(/^[\s"'“”‘’«»‹›`]+|[\s"'“”‘’«»‹›`]+$/g, ''); // strip all leading/trailing quotes

  // If input contains a complete Web client ID anywhere (e.g. from JSON or label), extract it directly
  const idMatch = clean.replace(/[\s\r\n]+/g, '').match(/([0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com)/i);
  if (idMatch) {
    return idMatch[1].toLowerCase();
  }

  // Otherwise strip common prefixes (client id =, client_id:, etc.)
  clean = clean.replace(/^(?:client[\s_-]*id\s*[:=]\s*)/i, '');
  clean = clean.replace(/^[\s"'“”‘’«»‹›`]+|[\s"'“”‘’«»‹›`]+$/g, '');
  clean = clean.replace(/[\s\r\n]+/g, '');

  // Lowercase standard domain suffix if present
  if (clean.toLowerCase().endsWith('.apps.googleusercontent.com')) {
    clean = clean.slice(0, -'.apps.googleusercontent.com'.length) + '.apps.googleusercontent.com';
  }

  return clean.trim();
}

export function isValidWebClientId(clientId: string): boolean {
  if (!clientId) return false;
  const sanitized = sanitizeClientId(clientId);
  return /^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/i.test(sanitized);
}

export function loadConfig(): AppConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.clientId || !parsed.folderId) return null;

    const cleanClientId = sanitizeClientId(parsed.clientId);
    const cleanFolderId = parseFolderId(parsed.folderId);
    if (!cleanClientId || !cleanFolderId) return null;

    const sanitizedConfig: AppConfig = {
      ...parsed,
      clientId: cleanClientId,
      folderId: cleanFolderId,
    };

    // Self-heal localStorage if stored values were not properly sanitized
    if (cleanClientId !== parsed.clientId || cleanFolderId !== parsed.folderId) {
      saveConfig(sanitizedConfig);
    }

    return sanitizedConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: AppConfig): void {
  const sanitizedConfig: AppConfig = {
    ...config,
    clientId: sanitizeClientId(config.clientId),
    folderId: parseFolderId(config.folderId),
  };
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(sanitizedConfig));
}

export function encodeConfigToSetupHash(config: { clientId: string; folderId: string }): string {
  const params = new URLSearchParams();
  params.set('clientId', sanitizeClientId(config.clientId));
  params.set('folderId', parseFolderId(config.folderId));
  return `#setup?${params.toString()}`;
}

export function parseSetupHash(hash: string): { clientId: string; folderId: string } | null {
  if (!hash.startsWith('#setup?') && !hash.startsWith('#/setup?')) return null;
  const queryString = hash.replace(/^#\/?setup\?/, '');
  const params = new URLSearchParams(queryString);
  const rawClientId = params.get('clientId');
  const rawFolderId = params.get('folderId');
  if (!rawClientId || !rawFolderId) return null;
  const clientId = sanitizeClientId(rawClientId);
  const folderId = parseFolderId(rawFolderId);
  if (!clientId || !folderId) return null;
  return { clientId, folderId };
}

export function clearConfig(): void {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
}
