import { describe, it, expect, beforeEach } from 'vitest';
import { parseFolderId, loadConfig, saveConfig, clearConfig, type AppConfig } from '../src/services/configStore';

describe('configStore & parseFolderId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('extracts folder ID from standard Google Drive folder URLs', () => {
    const url = 'https://drive.google.com/drive/folders/1ABC123xyz_def456?usp=sharing';
    expect(parseFolderId(url)).toBe('1ABC123xyz_def456');
  });

  it('extracts folder ID from u/0 drive links', () => {
    const url = 'https://drive.google.com/drive/u/0/folders/19jZ8K7xYz_abc';
    expect(parseFolderId(url)).toBe('19jZ8K7xYz_abc');
  });

  it('extracts folder ID from id= parameter URLs', () => {
    const url = 'https://drive.google.com/open?id=1xyz_FolderId-789';
    expect(parseFolderId(url)).toBe('1xyz_FolderId-789');
  });

  it('returns trimmed input if raw ID is entered', () => {
    expect(parseFolderId('  1ABC123xyz_def456  ')).toBe('1ABC123xyz_def456');
  });

  it('saves, loads, and clears configuration in localStorage', () => {
    expect(loadConfig()).toBeNull();
    const config: AppConfig = {
      clientId: '123456789.apps.googleusercontent.com',
      folderId: '1ABC123xyz_def456',
      folderUrl: 'https://drive.google.com/drive/folders/1ABC123xyz_def456',
      theme: 'dark'
    };
    saveConfig(config);
    expect(loadConfig()).toEqual(config);
    clearConfig();
    expect(loadConfig()).toBeNull();
  });

  it('returns null if stored config is invalid JSON or missing required fields', () => {
    localStorage.setItem('mdcloud_app_config', 'not-json');
    expect(loadConfig()).toBeNull();

    localStorage.setItem('mdcloud_app_config', JSON.stringify({ clientId: '123' }));
    expect(loadConfig()).toBeNull();

    localStorage.setItem('mdcloud_app_config', JSON.stringify({ folderId: '456' }));
    expect(loadConfig()).toBeNull();
  });
});
