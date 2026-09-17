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
  return input
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // strip invisible zero-width spaces
    .replace(/[\u2013\u2014]/g, '-') // convert iOS smart punctuation en-dash and em-dash to standard hyphen
    .replace(/^["']|["']$/g, '') // strip wrapping quotes
    .trim();
}

export function loadConfig(): AppConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.clientId || !parsed.folderId) return null;
    return parsed as AppConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: AppConfig): void {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function clearConfig(): void {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
}
