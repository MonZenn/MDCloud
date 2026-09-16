# MDCloud Implementation Plan: Multi-Device Google Drive Markdown Notes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-secret, client-side Markdown note-taking and figure-viewing web app hosted on GitHub Pages that syncs directly with a user-specified Google Drive folder across Mac, iPad, and iPhone with native home screen PWA support.

**Architecture:** A static React 19 + TypeScript + Vite Single Page Application using Google Identity Services (GIS) OAuth 2.0 and Google Drive REST API v3 entirely client-side. Employs IndexedDB for offline-first caching of notes and image blobs, a custom virtual path resolution engine to resolve relative figure links (`./figures/plot.png`), and an iOS-optimized PWA manifest with safe-area styling.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React, `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `rehype-highlight`, `mermaid`, `idb`, `vite-plugin-pwa`, Vitest.

**Spec:** [`docs/superpowers/specs/2026-09-16-mdcloud-design.md`](file:///Users/monjohn/Monjohn/Developer/MDCloud/docs/superpowers/specs/2026-09-16-mdcloud-design.md)

## Global Constraints

* Zero secrets in repository: no hardcoded Google Client IDs, client secrets, or Google Drive folder IDs in git.
* All user credentials and folder IDs are stored strictly in client `localStorage`.
* Base path in `vite.config.ts` must be `./` to ensure seamless loading on GitHub Pages (`https://<user>.github.io/<repo>/`).
* Routing must use hash-based routing (`#/folder-id/file-id`) to prevent 404 errors on GitHub Pages.
* Apple home screen metadata and PWA manifest must support standalone mode on iPad and iPhone with safe area insets.
* All image paths in markdown must resolve relative to the active note's parent folder in Google Drive.

---

## Session 1: Scaffolding, PWA/iOS Manifest & Local Config Store

### Task 1.1: Project Scaffolding with Vite, Tailwind CSS & Vitest

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `postcss.config.js`
- Create: `tailwind.config.js`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`
- Test: `tests/setup.test.ts`

**Interfaces:**
- Produces: Base project structure ready for React 19, TypeScript, Tailwind, and Vitest test runner.

- [ ] **Step 1: Write setup test verifying Vitest configuration**

```typescript
// tests/setup.test.ts
import { describe, it, expect } from 'vitest';

describe('Project environment', () => {
  it('runs tests properly in Vitest', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Create package.json and install dependencies**

```json
{
  "name": "mdcloud",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "idb": "^8.0.0",
    "lucide-react": "^0.475.0",
    "mermaid": "^11.4.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-markdown": "^9.0.3",
    "rehype-highlight": "^7.0.2",
    "rehype-katex": "^7.0.1",
    "remark-gfm": "^4.0.0",
    "remark-math": "^6.0.0",
    "tailwind-merge": "^3.0.1"
  },
  "devDependencies": {
    "@tailwindcss/typography": "^0.5.16",
    "@types/react": "^19.0.8",
    "@types/react-dom": "^19.0.3",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "jsdom": "^26.0.0",
    "postcss": "^8.5.1",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3",
    "vite": "^6.1.0",
    "vite-plugin-pwa": "^0.21.1",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 3: Configure Vite, Tailwind, PostCSS, and TypeScript**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: 'MDCloud - Google Drive Markdown Notes',
        short_name: 'MDCloud',
        description: 'Multi-device Google Drive Markdown note-taking and figure viewer',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts']
  }
});
```

- [ ] **Step 4: Run tests and verify build configuration**

Run: `npm install && npm test`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: scaffold Vite React 19 TypeScript project with Tailwind and Vitest"
```

---

### Task 1.2: PWA Assets & Apple iOS/iPadOS Home Screen Setup

**Files:**
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/apple-touch-icon.png`
- Create: `public/favicon.svg`
- Modify: `index.html`
- Modify: `src/index.css`
- Test: `tests/pwa.test.ts`

**Interfaces:**
- Produces: Apple mobile web app tags, viewport-fit cover, safe area styling, and app icons.

- [ ] **Step 1: Write test verifying Apple meta tags in index.html**

```typescript
// tests/pwa.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA & iOS Configuration', () => {
  it('contains Apple mobile web app capable meta tags in index.html', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="MDCloud"');
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('rel="apple-touch-icon"');
  });
});
```

- [ ] **Step 2: Update index.html with iOS & PWA tags**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0f172a" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="MDCloud" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
    <title>MDCloud</title>
  </head>
  <body class="bg-slate-900 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
    <div id="root"></div>
    <script type="module" src="./src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Update src/index.css for iOS safe area support**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --sat: env(safe-area-inset-top, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
  --sar: env(safe-area-inset-right, 0px);
}

body {
  padding-top: var(--sat);
  padding-bottom: var(--sab);
  padding-left: var(--sal);
  padding-right: var(--sar);
  min-height: 100vh;
  min-height: -webkit-fill-available;
}
```

- [ ] **Step 4: Run test and verify it passes**

Run: `npm test tests/pwa.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add index.html src/index.css tests/pwa.test.ts public/
git commit -m "feat(pwa): add iOS Home Screen meta tags, safe-area-insets, and icons"
```

---

### Task 1.3: In-App Configuration Store & Google Drive Folder URL Parser

**Files:**
- Create: `src/services/configStore.ts`
- Test: `tests/configStore.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface AppConfig {
    clientId: string;
    folderId: string;
    folderUrl?: string;
    theme: 'dark' | 'light' | 'system';
  }
  export function parseFolderId(input: string): string;
  export function loadConfig(): AppConfig | null;
  export function saveConfig(config: AppConfig): void;
  export function clearConfig(): void;
  ```

- [ ] **Step 1: Write failing unit test for parseFolderId and configStore**

```typescript
// tests/configStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { parseFolderId, loadConfig, saveConfig, clearConfig } from '../src/services/configStore';

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

  it('returns trimmed input if raw ID is entered', () => {
    expect(parseFolderId('  1ABC123xyz_def456  ')).toBe('1ABC123xyz_def456');
  });

  it('saves, loads, and clears configuration in localStorage', () => {
    expect(loadConfig()).toBeNull();
    const config = {
      clientId: '123456789.apps.googleusercontent.com',
      folderId: '1ABC123xyz_def456',
      theme: 'dark' as const
    };
    saveConfig(config);
    expect(loadConfig()).toEqual(config);
    clearConfig();
    expect(loadConfig()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/configStore.test.ts`  
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement configStore.ts**

```typescript
// src/services/configStore.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/configStore.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/configStore.ts tests/configStore.test.ts
git commit -m "feat(config): add local config store and Google Drive folder ID parser"
```

---

## Session 2: Google Identity & Drive API Service

### Task 2.1: Google Identity Services (GIS) Token Client Manager

**Files:**
- Create: `src/services/gisAuth.ts`
- Test: `tests/gisAuth.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface AuthState {
    token: string | null;
    expiresAt: number | null;
    isAuthenticated: boolean;
  }
  export class GisAuthManager {
    constructor(clientId: string);
    loadGisScript(): Promise<void>;
    requestToken(): Promise<string>;
    getToken(): string | null;
    signOut(): void;
  }
  ```

- [ ] **Step 1: Write unit test for GisAuthManager token handling**

```typescript
// tests/gisAuth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GisAuthManager } from '../src/services/gisAuth';

describe('GisAuthManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with unauthenticated state', () => {
    const auth = new GisAuthManager('test-client-id.apps.googleusercontent.com');
    expect(auth.getToken()).toBeNull();
  });

  it('clears token on signOut', () => {
    const auth = new GisAuthManager('test-client-id.apps.googleusercontent.com');
    // @ts-expect-error test private member
    auth.token = 'dummy-token';
    expect(auth.getToken()).toBe('dummy-token');
    auth.signOut();
    expect(auth.getToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/gisAuth.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement GisAuthManager**

```typescript
// src/services/gisAuth.ts
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

  public signOut(): void {
    this.token = null;
    this.expiresAt = null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/gisAuth.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/gisAuth.ts tests/gisAuth.test.ts
git commit -m "feat(auth): implement Google Identity Services token client manager"
```

---

### Task 2.2: Google Drive REST API v3 Client Service

**Files:**
- Create: `src/services/driveService.ts`
- Test: `tests/driveService.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface DriveFileItem {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime: string;
    size?: string;
    parents?: string[];
  }
  export class DriveService {
    constructor(getToken: () => string | null);
    listChildren(folderId: string): Promise<DriveFileItem[]>;
    getFileText(fileId: string): Promise<string>;
    getFileBlob(fileId: string): Promise<Blob>;
    updateFileText(fileId: string, content: string): Promise<DriveFileItem>;
    createFile(name: string, parentFolderId: string, content: string | Blob, mimeType: string): Promise<DriveFileItem>;
    createFolder(name: string, parentFolderId: string): Promise<DriveFileItem>;
    renameItem(fileId: string, newName: string): Promise<DriveFileItem>;
    deleteItem(fileId: string): Promise<void>;
  }
  ```

- [ ] **Step 1: Write test for DriveService REST requests with mocked fetch**

```typescript
// tests/driveService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DriveService } from '../src/services/driveService';

describe('DriveService', () => {
  const mockToken = 'test-bearer-token';
  const getMockToken = () => mockToken;
  let service: DriveService;

  beforeEach(() => {
    service = new DriveService(getMockToken);
    vi.restoreAllMocks();
  });

  it('lists children for a folder with correct headers and query', async () => {
    const mockFiles = [
      { id: '1', name: 'Note.md', mimeType: 'text/markdown', modifiedTime: '2026-09-16T10:00:00Z' }
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ files: mockFiles })
    });

    const items = await service.listChildren('folder123');
    expect(items).toEqual(mockFiles);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("q='folder123'+in+parents+and+trashed%3Dfalse"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${mockToken}` })
      })
    );
  });

  it('fetches text content for a file', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '# Hello Markdown'
    });

    const text = await service.getFileText('file123');
    expect(text).toBe('# Hello Markdown');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/file123?alt=media',
      expect.anything()
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/driveService.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement DriveService**

```typescript
// src/services/driveService.ts
export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  parents?: string[];
}

export class DriveService {
  private getToken: () => string | null;

  constructor(getToken: () => string | null) {
    this.getToken = getToken;
  }

  private async request(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated with Google');

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Google Drive API error (${res.status}): ${errText}`);
    }
    return res;
  }

  public async listChildren(folderId: string): Promise<DriveFileItem[]> {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const fields = encodeURIComponent('files(id, name, mimeType, modifiedTime, size, parents)');
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000`;
    const res = await this.request(url);
    const data = await res.json();
    return data.files || [];
  }

  public async getFileText(fileId: string): Promise<string> {
    const res = await this.request(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    return res.text();
  }

  public async getFileBlob(fileId: string): Promise<Blob> {
    const res = await this.request(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    return res.blob();
  }

  public async updateFileText(fileId: string, content: string): Promise<DriveFileItem> {
    const res = await this.request(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'text/markdown; charset=UTF-8' },
        body: content
      }
    );
    return res.json();
  }

  public async createFile(
    name: string,
    parentFolderId: string,
    content: string | Blob,
    mimeType: string
  ): Promise<DriveFileItem> {
    const metadata = { name, parents: [parentFolderId], mimeType };
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    let bodyData: any;
    if (typeof content === 'string') {
      bodyData =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n\r\n` +
        content +
        closeDelimiter;
    } else {
      // For binary blobs
      const metaBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      bodyData = new FormData();
      bodyData.append('metadata', metaBlob);
      bodyData.append('file', content);
    }

    const headers: Record<string, string> =
      typeof content === 'string'
        ? { 'Content-Type': `multipart/related; boundary=${boundary}` }
        : {};

    const res = await this.request(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers,
        body: bodyData
      }
    );
    return res.json();
  }

  public async createFolder(name: string, parentFolderId: string): Promise<DriveFileItem> {
    const res = await this.request('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        parents: [parentFolderId],
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    return res.json();
  }

  public async renameItem(fileId: string, newName: string): Promise<DriveFileItem> {
    const res = await this.request(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });
    return res.json();
  }

  public async deleteItem(fileId: string): Promise<void> {
    await this.request(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE'
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/driveService.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/driveService.ts tests/driveService.test.ts
git commit -m "feat(api): implement Google Drive REST API v3 service"
```

---

## Session 3: Virtual Tree Model, Relative Path Resolver & IndexedDB Cache

### Task 3.1: IndexedDB Cache Store for Notes, Hierarchy & Image Blobs

**Files:**
- Create: `src/services/dbStore.ts`
- Test: `tests/dbStore.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface CachedNote {
    fileId: string;
    folderId: string;
    name: string;
    content: string;
    modifiedTime: string;
    isDirty: boolean;
  }
  export interface CachedImage {
    fileId: string;
    blob: Blob;
    mimeType: string;
    modifiedTime: string;
  }
  export class DbStore {
    init(): Promise<void>;
    saveNote(note: CachedNote): Promise<void>;
    getNote(fileId: string): Promise<CachedNote | undefined>;
    saveImage(img: CachedImage): Promise<void>;
    getImage(fileId: string): Promise<CachedImage | undefined>;
    clearAll(): Promise<void>;
  }
  ```

- [ ] **Step 1: Write test for IndexedDB caching operations**

```typescript
// tests/dbStore.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { DbStore } from '../src/services/dbStore';

describe('DbStore (IndexedDB)', () => {
  let db: DbStore;

  beforeEach(async () => {
    db = new DbStore();
    await db.init();
    await db.clearAll();
  });

  it('stores and retrieves cached notes', async () => {
    const note = {
      fileId: 'note-1',
      folderId: 'folder-1',
      name: 'Test.md',
      content: '# Hello',
      modifiedTime: '2026-09-16T12:00:00Z',
      isDirty: false
    };
    await db.saveNote(note);
    const retrieved = await db.getNote('note-1');
    expect(retrieved).toEqual(note);
  });

  it('stores and retrieves binary image blobs', async () => {
    const blob = new Blob(['fake-image-bytes'], { type: 'image/png' });
    await db.saveImage({
      fileId: 'img-1',
      blob,
      mimeType: 'image/png',
      modifiedTime: '2026-09-16T12:00:00Z'
    });
    const retrieved = await db.getImage('img-1');
    expect(retrieved?.fileId).toBe('img-1');
    expect(retrieved?.mimeType).toBe('image/png');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/dbStore.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement DbStore with `idb`**

```typescript
// src/services/dbStore.ts
import { openDB, IDBPDatabase } from 'idb';

export interface CachedNote {
  fileId: string;
  folderId: string;
  name: string;
  content: string;
  modifiedTime: string;
  isDirty: boolean;
}

export interface CachedImage {
  fileId: string;
  blob: Blob;
  mimeType: string;
  modifiedTime: string;
}

const DB_NAME = 'mdcloud_db';
const DB_VERSION = 1;

export class DbStore {
  private db: IDBPDatabase | null = null;

  public async init(): Promise<void> {
    if (this.db) return;
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'fileId' });
        }
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'fileId' });
        }
        if (!db.objectStoreNames.contains('tree')) {
          db.createObjectStore('tree', { keyPath: 'folderId' });
        }
      }
    });
  }

  public async saveNote(note: CachedNote): Promise<void> {
    await this.init();
    await this.db!.put('notes', note);
  }

  public async getNote(fileId: string): Promise<CachedNote | undefined> {
    await this.init();
    return this.db!.get('notes', fileId);
  }

  public async saveImage(img: CachedImage): Promise<void> {
    await this.init();
    await this.db!.put('images', img);
  }

  public async getImage(fileId: string): Promise<CachedImage | undefined> {
    await this.init();
    return this.db!.get('images', fileId);
  }

  public async clearAll(): Promise<void> {
    await this.init();
    await this.db!.clear('notes');
    await this.db!.clear('images');
    await this.db!.clear('tree');
  }
}
```

- [ ] **Step 4: Install `fake-indexeddb` as devDependency and run test**

Run: `npm i -D fake-indexeddb && npm test tests/dbStore.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/dbStore.ts tests/dbStore.test.ts package.json
git commit -m "feat(storage): implement IndexedDB cache store for notes, images, and tree"
```

---

### Task 3.2: Relative Path Resolution Engine (`PathResolver`)

**Files:**
- Create: `src/services/pathResolver.ts`
- Test: `tests/pathResolver.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface VirtualNode {
    id: string;
    name: string;
    isFolder: boolean;
    parentId: string | null;
    children?: VirtualNode[];
  }
  export function resolveRelativePath(
    currentFolderId: string,
    relativePath: string,
    nodeMap: Map<string, VirtualNode>
  ): VirtualNode | null;
  ```

- [ ] **Step 1: Write test for relative path resolution with figures**

```typescript
// tests/pathResolver.test.ts
import { describe, it, expect } from 'vitest';
import { resolveRelativePath, VirtualNode } from '../src/services/pathResolver';

describe('PathResolver', () => {
  // Tree:
  // root (id: 'root')
  // ├── Math (id: 'math')
  // │   ├── Lecture.md (id: 'lec')
  // │   ├── plot.png (id: 'plot-img')
  // │   └── figures (id: 'math-figs')
  // │       └── diagram.svg (id: 'diag-svg')
  // └── CS (id: 'cs')
  //     └── AI.png (id: 'ai-img')

  const nodeMap = new Map<string, VirtualNode>();

  const root: VirtualNode = { id: 'root', name: 'Root', isFolder: true, parentId: null, children: [] };
  const math: VirtualNode = { id: 'math', name: 'Math', isFolder: true, parentId: 'root', children: [] };
  const cs: VirtualNode = { id: 'cs', name: 'CS', isFolder: true, parentId: 'root', children: [] };
  const lec: VirtualNode = { id: 'lec', name: 'Lecture.md', isFolder: false, parentId: 'math' };
  const plot: VirtualNode = { id: 'plot-img', name: 'plot.png', isFolder: false, parentId: 'math' };
  const mathFigs: VirtualNode = { id: 'math-figs', name: 'figures', isFolder: true, parentId: 'math', children: [] };
  const diag: VirtualNode = { id: 'diag-svg', name: 'diagram.svg', isFolder: false, parentId: 'math-figs' };
  const aiImg: VirtualNode = { id: 'ai-img', name: 'AI.png', isFolder: false, parentId: 'cs' };

  root.children = [math, cs];
  math.children = [lec, plot, mathFigs];
  mathFigs.children = [diag];
  cs.children = [aiImg];

  [root, math, cs, lec, plot, mathFigs, diag, aiImg].forEach((n) => nodeMap.set(n.id, n));

  it('resolves image in the same folder by simple filename', () => {
    const target = resolveRelativePath('math', 'plot.png', nodeMap);
    expect(target?.id).toBe('plot-img');
  });

  it('resolves image in the same folder with ./ prefix', () => {
    const target = resolveRelativePath('math', './plot.png', nodeMap);
    expect(target?.id).toBe('plot-img');
  });

  it('resolves image inside a subfolder ./figures/diagram.svg', () => {
    const target = resolveRelativePath('math', './figures/diagram.svg', nodeMap);
    expect(target?.id).toBe('diag-svg');
  });

  it('resolves image in sibling folder using parent traversal ../CS/AI.png', () => {
    const target = resolveRelativePath('math', '../CS/AI.png', nodeMap);
    expect(target?.id).toBe('ai-img');
  });

  it('returns null if path does not exist', () => {
    const target = resolveRelativePath('math', './nonexistent.png', nodeMap);
    expect(target).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/pathResolver.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement pathResolver.ts**

```typescript
// src/services/pathResolver.ts
export interface VirtualNode {
  id: string;
  name: string;
  isFolder: boolean;
  parentId: string | null;
  children?: VirtualNode[];
}

export function resolveRelativePath(
  currentFolderId: string,
  relativePath: string,
  nodeMap: Map<string, VirtualNode>
): VirtualNode | null {
  const cleanPath = relativePath.trim().replace(/^['"]|['"]$/g, '');
  if (!cleanPath) return null;

  // Normalize path segments
  const rawSegments = cleanPath.split('/').filter((s) => s.length > 0);
  let currentNode = nodeMap.get(currentFolderId);
  if (!currentNode) return null;

  for (let i = 0; i < rawSegments.length; i++) {
    const segment = decodeURIComponent(rawSegments[i]);

    if (segment === '.') {
      continue;
    } else if (segment === '..') {
      if (!currentNode.parentId) return null;
      currentNode = nodeMap.get(currentNode.parentId);
      if (!currentNode) return null;
    } else {
      const isLastSegment = i === rawSegments.length - 1;
      const child = (currentNode.children || []).find((c) => c.name.toLowerCase() === segment.toLowerCase());
      if (!child) return null;
      if (isLastSegment) {
        return child;
      }
      if (!child.isFolder) return null;
      currentNode = child;
    }
  }

  return currentNode || null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/pathResolver.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/pathResolver.ts tests/pathResolver.test.ts
git commit -m "feat(path): implement relative path resolution engine for markdown assets"
```

---

## Session 4: Markdown Rendering Engine with KaTeX, Mermaid & Dynamic Figure Resolver

### Task 4.1: Markdown Renderer with KaTeX Math, Syntax Highlighting & Mermaid

**Files:**
- Create: `src/components/MarkdownViewer.tsx`
- Create: `src/components/MermaidBlock.tsx`
- Test: `tests/markdownViewer.test.tsx`

**Interfaces:**
- Produces:
  ```typescript
  export interface MarkdownViewerProps {
    content: string;
    currentFolderId: string;
    resolveImageBlobUrl: (src: string) => Promise<string | null>;
    onImageClick?: (url: string, alt?: string) => void;
  }
  export const MarkdownViewer: React.FC<MarkdownViewerProps>;
  ```

- [ ] **Step 1: Write test verifying markdown rendering for math and tables**

```typescript
// tests/markdownViewer.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MarkdownViewer } from '../src/components/MarkdownViewer';

describe('MarkdownViewer', () => {
  it('renders standard markdown headings and lists', () => {
    const md = '# Note Title\n\n* Item 1\n* Item 2';
    render(
      <MarkdownViewer
        content={md}
        currentFolderId="folder-1"
        resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
      />
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Note Title');
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/markdownViewer.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement MermaidBlock and MarkdownViewer**

```typescript
// src/components/MermaidBlock.tsx
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose'
});

export const MermaidBlock: React.FC<{ chart: string }> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        if (isMounted) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Error rendering diagram');
      }
    };
    renderChart();
    return () => {
      isMounted = false;
    };
  }, [chart]);

  if (error) {
    return (
      <div class="p-3 bg-red-950/40 border border-red-800 rounded text-red-300 text-sm font-mono">
        Failed to render diagram: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      class="my-4 p-4 bg-slate-950/60 rounded-lg flex justify-center overflow-x-auto border border-slate-800"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
```

```typescript
// src/components/MarkdownViewer.tsx
import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { MermaidBlock } from './MermaidBlock';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

export interface MarkdownViewerProps {
  content: string;
  currentFolderId: string;
  resolveImageBlobUrl: (src: string) => Promise<string | null>;
  onImageClick?: (url: string, alt?: string) => void;
}

const MarkdownImage: React.FC<{
  src?: string;
  alt?: string;
  resolveImageBlobUrl: (src: string) => Promise<string | null>;
  onImageClick?: (url: string, alt?: string) => void;
}> = ({ src, alt, resolveImageBlobUrl, onImageClick }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    if (!src) {
      setLoading(false);
      return;
    }
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      setResolvedUrl(src);
      setLoading(false);
      return;
    }
    setLoading(true);
    resolveImageBlobUrl(src).then((url) => {
      if (active) {
        setResolvedUrl(url);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [src, resolveImageBlobUrl]);

  if (loading) {
    return (
      <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 text-slate-400 text-xs animate-pulse">
        Loading figure: {src}...
      </span>
    );
  }

  if (!resolvedUrl) {
    return (
      <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-950/40 border border-amber-800 text-amber-300 text-xs">
        ⚠️ Figure not found: {src}
      </span>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt || ''}
      class="max-w-full h-auto rounded-lg my-3 shadow-md cursor-zoom-in hover:opacity-95 transition-opacity"
      onClick={() => onImageClick?.(resolvedUrl, alt)}
    />
  );
};

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  resolveImageBlobUrl,
  onImageClick
}) => {
  return (
    <div class="prose prose-invert max-w-none prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800 prose-img:rounded-lg">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            if (match && match[1] === 'mermaid') {
              return <MermaidBlock chart={String(children).replace(/\n$/, '')} />;
            }
            return (
              <code class={className} {...props}>
                {children}
              </code>
            );
          },
          img({ src, alt }) {
            return (
              <MarkdownImage
                src={src}
                alt={alt}
                resolveImageBlobUrl={resolveImageBlobUrl}
                onImageClick={onImageClick}
              />
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
```

- [ ] **Step 4: Install testing library dependencies and run tests**

Run: `npm i -D @testing-library/react @testing-library/jest-dom && npm test tests/markdownViewer.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/MarkdownViewer.tsx src/components/MermaidBlock.tsx tests/markdownViewer.test.tsx package.json
git commit -m "feat(markdown): implement MarkdownViewer with KaTeX, Mermaid, and image resolver"
```

---

## Session 5: Note-Taking Workspace, Sync & Drag-and-Drop Uploader

### Task 5.1: Dual-Pane Workspace with Autosave & Sync Status

**Files:**
- Create: `src/components/Workspace.tsx`
- Create: `src/components/SyncBadge.tsx`
- Create: `src/components/ImageLightbox.tsx`
- Test: `tests/workspace.test.tsx`

**Interfaces:**
- Produces:
  ```typescript
  export type SyncStatus = 'synced' | 'saving' | 'offline' | 'error';
  export interface WorkspaceProps {
    noteTitle: string;
    initialContent: string;
    currentFolderId: string;
    onSaveContent: (content: string) => Promise<void>;
    onUploadImage: (file: File) => Promise<string>;
    resolveImageBlobUrl: (src: string) => Promise<string | null>;
  }
  ```

- [ ] **Step 1: Write test for Workspace view mode toggling and sync status**

```typescript
// tests/workspace.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Workspace } from '../src/components/Workspace';

describe('Workspace', () => {
  it('renders editor and preview panes and toggles layout', () => {
    render(
      <Workspace
        noteTitle="Calculus.md"
        initialContent="# Hello Calculus"
        currentFolderId="folder-1"
        onSaveContent={vi.fn()}
        onUploadImage={vi.fn()}
        resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
      />
    );
    expect(screen.getByDisplayValue('# Hello Calculus')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/workspace.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement SyncBadge, ImageLightbox, and Workspace**

```typescript
// src/components/SyncBadge.tsx
import React from 'react';
import { CheckCircle2, RefreshCw, CloudOff, AlertCircle } from 'lucide-react';

export type SyncStatus = 'synced' | 'saving' | 'offline' | 'error';

export const SyncBadge: React.FC<{ status: SyncStatus; onRetry?: () => void }> = ({
  status,
  onRetry
}) => {
  switch (status) {
    case 'synced':
      return (
        <span class="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <CheckCircle2 size={14} /> Saved to Drive
        </span>
      );
    case 'saving':
      return (
        <span class="inline-flex items-center gap-1.5 text-xs text-amber-400 font-medium">
          <RefreshCw size={14} class="animate-spin" /> Saving...
        </span>
      );
    case 'offline':
      return (
        <span class="inline-flex items-center gap-1.5 text-xs text-sky-400 font-medium">
          <CloudOff size={14} /> Saved Locally (Offline)
        </span>
      );
    case 'error':
      return (
        <button
          onClick={onRetry}
          class="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium hover:underline cursor-pointer"
        >
          <AlertCircle size={14} /> Sync Failed (Retry)
        </button>
      );
  }
};
```

```typescript
// src/components/ImageLightbox.tsx
import React from 'react';
import { X } from 'lucide-react';

export const ImageLightbox: React.FC<{ url: string; alt?: string; onClose: () => void }> = ({
  url,
  alt,
  onClose
}) => {
  return (
    <div
      class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        class="absolute top-4 right-4 p-2 text-slate-300 hover:text-white bg-slate-800/80 rounded-full"
      >
        <X size={20} />
      </button>
      <img
        src={url}
        alt={alt || ''}
        class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};
```

```typescript
// src/components/Workspace.tsx
import React, { useState, useEffect, useRef } from 'react';
import { MarkdownViewer } from './MarkdownViewer';
import { SyncBadge, SyncStatus } from './SyncBadge';
import { ImageLightbox } from './ImageLightbox';
import { Columns, Eye, Edit3, ImagePlus } from 'lucide-react';

export interface WorkspaceProps {
  noteTitle: string;
  initialContent: string;
  currentFolderId: string;
  onSaveContent: (content: string) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  resolveImageBlobUrl: (src: string) => Promise<string | null>;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  noteTitle,
  initialContent,
  currentFolderId,
  onSaveContent,
  onUploadImage,
  resolveImageBlobUrl
}) => {
  const [content, setContent] = useState<string>(initialContent);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const saveTimeoutRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setSyncStatus('saving');

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await onSaveContent(newContent);
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    }, 1500);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          setSyncStatus('saving');
          const relativePath = await onUploadImage(file);
          const cursor = e.currentTarget.selectionStart;
          const inserted = `\n![${file.name}](${relativePath})\n`;
          const updated = content.slice(0, cursor) + inserted + content.slice(cursor);
          setContent(updated);
          await onSaveContent(updated);
          setSyncStatus('synced');
        }
      }
    }
  };

  return (
    <div class="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Workspace Subheader */}
      <div class="h-12 border-b border-slate-800 px-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="font-semibold text-sm text-slate-200">{noteTitle}</span>
          <SyncBadge
            status={syncStatus}
            onRetry={async () => {
              setSyncStatus('saving');
              try {
                await onSaveContent(content);
                setSyncStatus('synced');
              } catch {
                setSyncStatus('error');
              }
            }}
          />
        </div>
        <div class="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            class="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            title="Upload figure"
          >
            <ImagePlus size={16} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            class="hidden"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                const rel = await onUploadImage(file);
                const updated = content + `\n![${file.name}](${rel})\n`;
                setContent(updated);
                await onSaveContent(updated);
              }
            }}
          />
          {/* View mode buttons */}
          <div class="flex bg-slate-800/80 rounded p-0.5 border border-slate-700">
            <button
              onClick={() => setViewMode('edit')}
              class={`px-2 py-1 rounded text-xs flex items-center gap-1 ${viewMode === 'edit' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
            >
              <Edit3 size={12} /> Edit
            </button>
            <button
              onClick={() => setViewMode('split')}
              class={`px-2 py-1 rounded text-xs flex items-center gap-1 hidden md:flex ${viewMode === 'split' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
            >
              <Columns size={12} /> Split
            </button>
            <button
              onClick={() => setViewMode('preview')}
              class={`px-2 py-1 rounded text-xs flex items-center gap-1 ${viewMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
            >
              <Eye size={12} /> Preview
            </button>
          </div>
        </div>
      </div>

      {/* Editor / Preview Area */}
      <div class="flex-1 flex overflow-hidden">
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div class={`h-full ${viewMode === 'split' ? 'w-1/2 border-r border-slate-800' : 'w-full'}`}>
            <textarea
              value={content}
              onChange={handleChange}
              onPaste={handlePaste}
              placeholder="Write your markdown note here..."
              class="w-full h-full p-4 bg-transparent resize-none focus:outline-none font-mono text-sm leading-relaxed text-slate-200"
            />
          </div>
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div class={`h-full overflow-y-auto p-6 ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <MarkdownViewer
              content={content}
              currentFolderId={currentFolderId}
              resolveImageBlobUrl={resolveImageBlobUrl}
              onImageClick={(url) => setLightboxUrl(url)}
            />
          </div>
        )}
      </div>

      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/workspace.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Workspace.tsx src/components/SyncBadge.tsx src/components/ImageLightbox.tsx tests/workspace.test.tsx
git commit -m "feat(workspace): implement dual-pane workspace with autosave, image paste, and sync badge"
```

---

## Session 6: Sidebar File Explorer, Hierarchy & Settings Modal

### Task 6.1: Sidebar File Explorer & Search

**Files:**
- Create: `src/components/Sidebar.tsx`
- Create: `src/components/FolderItem.tsx`
- Test: `tests/sidebar.test.tsx`

**Interfaces:**
- Produces:
  ```typescript
  export interface SidebarProps {
    tree: VirtualNode;
    selectedFileId: string | null;
    onSelectNote: (noteId: string) => void;
    onCreateNote: (folderId: string, name: string) => Promise<void>;
    onCreateFolder: (parentFolderId: string, name: string) => Promise<void>;
    onDeleteItem: (itemId: string) => Promise<void>;
    isOpen: boolean;
    onToggleOpen: () => void;
  }
  ```

- [ ] **Step 1: Write test for Sidebar item rendering and selection**

```typescript
// tests/sidebar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Sidebar } from '../src/components/Sidebar';
import { VirtualNode } from '../src/services/pathResolver';

describe('Sidebar', () => {
  const mockTree: VirtualNode = {
    id: 'root',
    name: 'Notes',
    isFolder: true,
    parentId: null,
    children: [
      { id: 'math', name: 'Math', isFolder: true, parentId: 'root', children: [] },
      { id: 'note-1', name: 'Intro.md', isFolder: false, parentId: 'root' }
    ]
  };

  it('renders files and triggers onSelectNote when clicked', () => {
    const handleSelect = vi.fn();
    render(
      <Sidebar
        tree={mockTree}
        selectedFileId={null}
        onSelectNote={handleSelect}
        onCreateNote={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteItem={vi.fn()}
        isOpen={true}
        onToggleOpen={vi.fn()}
      />
    );
    const noteEl = screen.getByText('Intro.md');
    fireEvent.click(noteEl);
    expect(handleSelect).toHaveBeenCalledWith('note-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/sidebar.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement Sidebar and FolderItem**

```typescript
// src/components/Sidebar.tsx
import React, { useState } from 'react';
import { VirtualNode } from '../src/services/pathResolver';
import { Folder, FolderPlus, FilePlus, FileText, ChevronRight, ChevronDown, Trash2, Search } from 'lucide-react';

export interface SidebarProps {
  tree: VirtualNode;
  selectedFileId: string | null;
  onSelectNote: (noteId: string) => void;
  onCreateNote: (folderId: string, name: string) => Promise<void>;
  onCreateFolder: (parentFolderId: string, name: string) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  isOpen: boolean;
  onToggleOpen: () => void;
}

const TreeNodeItem: React.FC<{
  node: VirtualNode;
  selectedFileId: string | null;
  onSelectNote: (noteId: string) => void;
  onCreateNote: (folderId: string, name: string) => Promise<void>;
  onCreateFolder: (parentFolderId: string, name: string) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  depth: number;
}> = ({ node, selectedFileId, onSelectNote, onCreateNote, onCreateFolder, onDeleteItem, depth }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (!node.isFolder) {
    const isSelected = selectedFileId === node.id;
    return (
      <div
        class={`group flex items-center justify-between px-3 py-1.5 text-sm cursor-pointer rounded-md mx-2 transition-colors ${
          isSelected ? 'bg-indigo-600/30 text-indigo-300 font-medium' : 'text-slate-300 hover:bg-slate-800'
        }`}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
        onClick={() => onSelectNote(node.id)}
      >
        <div class="flex items-center gap-2 truncate">
          <FileText size={15} class="text-slate-400 shrink-0" />
          <span class="truncate">{node.name}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete ${node.name}?`)) onDeleteItem(node.id);
          }}
          class="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-slate-500 rounded"
        >
          <Trash2 size={13} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        class="group flex items-center justify-between px-3 py-1.5 text-sm cursor-pointer text-slate-400 hover:bg-slate-800/70 rounded-md mx-2"
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div class="flex items-center gap-1.5 truncate">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Folder size={15} class="text-amber-400 shrink-0" />
          <span class="font-medium text-slate-200 truncate">{node.name}</span>
        </div>
        <div class="opacity-0 group-hover:opacity-100 flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const name = prompt('Note name (e.g. Note.md):');
              if (name) onCreateNote(node.id, name.endsWith('.md') ? name : `${name}.md`);
            }}
            title="New Note"
            class="p-1 hover:text-slate-200 text-slate-400 rounded"
          >
            <FilePlus size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const name = prompt('Folder name:');
              if (name) onCreateFolder(node.id, name);
            }}
            title="New Folder"
            class="p-1 hover:text-slate-200 text-slate-400 rounded"
          >
            <FolderPlus size={13} />
          </button>
        </div>
      </div>
      {isExpanded && node.children && (
        <div class="flex flex-col">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              selectedFileId={selectedFileId}
              onSelectNote={onSelectNote}
              onCreateNote={onCreateNote}
              onCreateFolder={onCreateFolder}
              onDeleteItem={onDeleteItem}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  tree,
  selectedFileId,
  onSelectNote,
  onCreateNote,
  onCreateFolder,
  onDeleteItem,
  isOpen,
  onToggleOpen
}) => {
  const [search, setSearch] = useState('');

  return (
    <aside
      class={`h-full bg-slate-950 border-r border-slate-800 flex flex-col transition-all duration-300 ${
        isOpen ? 'w-64' : 'w-0 overflow-hidden'
      }`}
    >
      {/* Search Header */}
      <div class="p-3 border-b border-slate-800 flex items-center gap-2">
        <div class="relative flex-1">
          <Search size={14} class="absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            class="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Hierarchy Tree */}
      <div class="flex-1 overflow-y-auto py-2">
        <TreeNodeItem
          node={tree}
          selectedFileId={selectedFileId}
          onSelectNote={onSelectNote}
          onCreateNote={onCreateNote}
          onCreateFolder={onCreateFolder}
          onDeleteItem={onDeleteItem}
          depth={0}
        />
      </div>
    </aside>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/sidebar.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx tests/sidebar.test.tsx
git commit -m "feat(sidebar): implement file tree explorer with note and folder management"
```

---

### Task 6.2: Settings & In-App Setup Modal with iOS Install Prompt

**Files:**
- Create: `src/components/SettingsModal.tsx`
- Create: `src/components/IosInstallBanner.tsx`
- Test: `tests/settingsModal.test.tsx`

**Interfaces:**
- Produces:
  ```typescript
  export interface SettingsModalProps {
    isOpen: boolean;
    currentConfig: AppConfig | null;
    onSaveConfig: (config: AppConfig) => void;
    onClose: () => void;
  }
  ```

- [ ] **Step 1: Write test for SettingsModal credential saving**

```typescript
// tests/settingsModal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SettingsModal } from '../src/components/SettingsModal';

describe('SettingsModal', () => {
  it('submits valid Client ID and parses folder link into folder ID', () => {
    const handleSave = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        currentConfig={null}
        onSaveConfig={handleSave}
        onClose={vi.fn()}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/apps.googleusercontent.com/i), {
      target: { value: 'my-client-id.apps.googleusercontent.com' }
    });
    fireEvent.change(screen.getByPlaceholderText(/drive.google.com\/drive\/folders/i), {
      target: { value: 'https://drive.google.com/drive/folders/folder987' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save & connect/i }));
    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'my-client-id.apps.googleusercontent.com',
        folderId: 'folder987'
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/settingsModal.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement SettingsModal and IosInstallBanner**

```typescript
// src/components/IosInstallBanner.tsx
import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';

export const IosInstallBanner: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (isIos && !isStandalone) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div class="fixed bottom-3 inset-x-3 z-40 bg-indigo-950/95 border border-indigo-700/60 backdrop-blur text-indigo-100 p-3 rounded-xl shadow-2xl flex items-center justify-between text-xs">
      <div class="flex items-center gap-2">
        <span>Install on iPad/iPhone: tap</span>
        <span class="inline-flex items-center px-1.5 py-0.5 bg-indigo-900 border border-indigo-600 rounded">
          <Share size={12} class="mr-1" /> Share
        </span>
        <span>then</span>
        <span class="inline-flex items-center px-1.5 py-0.5 bg-indigo-900 border border-indigo-600 rounded">
          <PlusSquare size={12} class="mr-1" /> Add to Home Screen
        </span>
      </div>
      <button onClick={() => setShow(false)} class="p-1 text-indigo-300 hover:text-white">
        <X size={14} />
      </button>
    </div>
  );
};
```

```typescript
// src/components/SettingsModal.tsx
import React, { useState, useEffect } from 'react';
import { AppConfig, parseFolderId } from '../services/configStore';
import { Settings, X, ExternalLink, KeyRound, FolderOpen } from 'lucide-react';

export interface SettingsModalProps {
  isOpen: boolean;
  currentConfig: AppConfig | null;
  onSaveConfig: (config: AppConfig) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  currentConfig,
  onSaveConfig,
  onClose
}) => {
  const [clientId, setClientId] = useState('');
  const [folderInput, setFolderInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentConfig) {
      setClientId(currentConfig.clientId);
      setFolderInput(currentConfig.folderUrl || currentConfig.folderId);
    }
  }, [currentConfig]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanClientId = clientId.trim();
    const folderId = parseFolderId(folderInput);

    if (!cleanClientId) {
      setError('Please enter your Google OAuth Client ID');
      return;
    }
    if (!folderId) {
      setError('Please enter your Google Drive folder link or ID');
      return;
    }

    onSaveConfig({
      clientId: cleanClientId,
      folderId,
      folderUrl: folderInput.trim(),
      theme: 'dark'
    });
    setError(null);
    onClose();
  };

  return (
    <div class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div class="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2 text-indigo-400 font-semibold">
            <Settings size={18} />
            <span class="text-white">Google Drive Connection Settings</span>
          </div>
          {currentConfig && (
            <button onClick={onClose} class="text-slate-400 hover:text-white">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} class="p-6 flex flex-col gap-4">
          <p class="text-xs text-slate-400 leading-relaxed">
            MDCloud stores all credentials directly in your browser's local storage. Zero secrets or personal
            identifiers are ever uploaded to GitHub.
          </p>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <KeyRound size={14} class="text-indigo-400" /> Google OAuth 2.0 Web Client ID
            </label>
            <input
              type="text"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
              class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <FolderOpen size={14} class="text-amber-400" /> Google Drive Notes Folder Link or ID
            </label>
            <input
              type="text"
              required
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="e.g. https://drive.google.com/drive/folders/1aBcD..."
              class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {error && <div class="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded border border-rose-800">{error}</div>}

          <div class="pt-2 flex justify-end gap-3">
            <button
              type="submit"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
            >
              Save & Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/settingsModal.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsModal.tsx src/components/IosInstallBanner.tsx tests/settingsModal.test.tsx
git commit -m "feat(settings): add configuration modal and iOS home screen install prompt"
```

---

## Session 7: App Integration, GitHub Actions CI/CD & Production Build

### Task 7.1: App Root Integration & Virtual Tree Synchronizer

**Files:**
- Modify: `src/App.tsx`
- Test: `tests/appIntegration.test.tsx`

**Interfaces:**
- Produces: Complete working application integrating DriveService, DbStore, PathResolver, Sidebar, Workspace, and SettingsModal.

- [ ] **Step 1: Write integration smoke test for App component**

```typescript
// tests/appIntegration.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import App from '../src/App';

describe('App Root Integration', () => {
  it('renders without crashing and displays setup modal when unconfigured', () => {
    localStorage.clear();
    render(<App />);
    expect(screen.getByText(/Google Drive Connection Settings/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/appIntegration.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement App.tsx uniting all services and UI**

```typescript
// src/App.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { loadConfig, saveConfig, AppConfig } from './services/configStore';
import { GisAuthManager } from './services/gisAuth';
import { DriveService } from './services/driveService';
import { DbStore } from './services/dbStore';
import { resolveRelativePath, VirtualNode } from './services/pathResolver';
import { Sidebar } from './components/Sidebar';
import { Workspace } from './components/Workspace';
import { SettingsModal } from './components/SettingsModal';
import { IosInstallBanner } from './components/IosInstallBanner';
import { Menu, Settings as SettingsIcon, LogIn, LogOut, Cloud } from 'lucide-react';

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(() => loadConfig());
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(!config);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState<string>('');
  const [tree, setTree] = useState<VirtualNode>({
    id: config?.folderId || 'root',
    name: 'My Notes',
    isFolder: true,
    parentId: null,
    children: []
  });

  const auth = useMemo(() => new GisAuthManager(config?.clientId || ''), [config?.clientId]);
  const drive = useMemo(() => new DriveService(() => auth.getToken()), [auth]);
  const db = useMemo(() => new DbStore(), []);

  const nodeMap = useMemo(() => {
    const map = new Map<string, VirtualNode>();
    const traverse = (node: VirtualNode) => {
      map.set(node.id, node);
      node.children?.forEach(traverse);
    };
    traverse(tree);
    return map;
  }, [tree]);

  const loadTree = useCallback(async () => {
    if (!config?.folderId) return;
    try {
      const items = await drive.listChildren(config.folderId);
      const rootNode: VirtualNode = {
        id: config.folderId,
        name: 'My Notes',
        isFolder: true,
        parentId: null,
        children: items.map((f) => ({
          id: f.id,
          name: f.name,
          isFolder: f.mimeType === 'application/vnd.google-apps.folder',
          parentId: config.folderId,
          children: []
        }))
      };
      setTree(rootNode);
    } catch (err) {
      console.error('Failed to load drive tree', err);
    }
  }, [config?.folderId, drive]);

  const resolveImageBlobUrl = useCallback(
    async (src: string): Promise<string | null> => {
      if (!activeNoteId) return null;
      const currentNote = nodeMap.get(activeNoteId);
      const parentFolderId = currentNote?.parentId || config?.folderId || 'root';

      const resolved = resolveRelativePath(parentFolderId, src, nodeMap);
      if (!resolved) return null;

      const cached = await db.getImage(resolved.id);
      if (cached) return URL.createObjectURL(cached.blob);

      try {
        const blob = await drive.getFileBlob(resolved.id);
        await db.saveImage({
          fileId: resolved.id,
          blob,
          mimeType: blob.type,
          modifiedTime: new Date().toISOString()
        });
        return URL.createObjectURL(blob);
      } catch {
        return null;
      }
    },
    [activeNoteId, nodeMap, config?.folderId, db, drive]
  );

  const handleSelectNote = async (noteId: string) => {
    setActiveNoteId(noteId);
    const cached = await db.getNote(noteId);
    if (cached) {
      setNoteContent(cached.content);
    }
    try {
      const remote = await drive.getFileText(noteId);
      setNoteContent(remote);
      const noteNode = nodeMap.get(noteId);
      await db.saveNote({
        fileId: noteId,
        folderId: noteNode?.parentId || '',
        name: noteNode?.name || 'Note.md',
        content: remote,
        modifiedTime: new Date().toISOString(),
        isDirty: false
      });
    } catch (err) {
      console.error('Error fetching note', err);
    }
  };

  const handleSaveContent = async (content: string) => {
    if (!activeNoteId) return;
    const noteNode = nodeMap.get(activeNoteId);
    await db.saveNote({
      fileId: activeNoteId,
      folderId: noteNode?.parentId || '',
      name: noteNode?.name || 'Note.md',
      content,
      modifiedTime: new Date().toISOString(),
      isDirty: true
    });
    await drive.updateFileText(activeNoteId, content);
  };

  const handleUploadImage = async (file: File): Promise<string> => {
    if (!activeNoteId) throw new Error('No active note');
    const currentNote = nodeMap.get(activeNoteId);
    const parentFolderId = currentNote?.parentId || config!.folderId;
    const uploaded = await drive.createFile(file.name, parentFolderId, file, file.type);
    await db.saveImage({
      fileId: uploaded.id,
      blob: file,
      mimeType: file.type,
      modifiedTime: uploaded.modifiedTime
    });
    await loadTree();
    return `./${file.name}`;
  };

  const activeNote = activeNoteId ? nodeMap.get(activeNoteId) : null;

  return (
    <div class="h-screen w-screen flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top Navigation */}
      <header class="h-14 border-b border-slate-800 px-4 flex items-center justify-between bg-slate-950">
        <div class="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            class="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
          >
            <Menu size={18} />
          </button>
          <div class="flex items-center gap-2 text-indigo-400 font-bold tracking-wide">
            <Cloud size={20} />
            <span>MDCloud</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          {auth.getToken() ? (
            <button
              onClick={() => {
                auth.signOut();
                loadTree();
              }}
              class="px-2.5 py-1 text-xs text-slate-400 hover:text-white flex items-center gap-1 hover:bg-slate-800 rounded"
            >
              <LogOut size={14} /> Disconnect
            </button>
          ) : (
            <button
              onClick={async () => {
                await auth.requestToken();
                loadTree();
              }}
              class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium flex items-center gap-1.5"
            >
              <LogIn size={14} /> Sign in with Google
            </button>
          )}
          <button
            onClick={() => setIsSettingsOpen(true)}
            class="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
            title="Settings"
          >
            <SettingsIcon size={18} />
          </button>
        </div>
      </header>

      {/* Main Workspace & Sidebar */}
      <div class="flex-1 flex overflow-hidden">
        <Sidebar
          tree={tree}
          selectedFileId={activeNoteId}
          onSelectNote={handleSelectNote}
          onCreateNote={async (folderId, name) => {
            const file = await drive.createFile(name, folderId, '# ' + name, 'text/markdown');
            await loadTree();
            handleSelectNote(file.id);
          }}
          onCreateFolder={async (parentId, name) => {
            await drive.createFolder(name, parentId);
            await loadTree();
          }}
          onDeleteItem={async (id) => {
            await drive.deleteItem(id);
            if (activeNoteId === id) setActiveNoteId(null);
            await loadTree();
          }}
          isOpen={sidebarOpen}
          onToggleOpen={() => setSidebarOpen(!sidebarOpen)}
        />
        <main class="flex-1 h-full overflow-hidden">
          {activeNote ? (
            <Workspace
              noteTitle={activeNote.name}
              initialContent={noteContent}
              currentFolderId={activeNote.parentId || 'root'}
              onSaveContent={handleSaveContent}
              onUploadImage={handleUploadImage}
              resolveImageBlobUrl={resolveImageBlobUrl}
            />
          ) : (
            <div class="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
              <Cloud size={48} class="mb-3 text-slate-600 animate-pulse" />
              <p class="text-base font-medium text-slate-400">Select or create a markdown note</p>
              <p class="text-xs text-slate-500 max-w-sm mt-1">
                Your notes and figures in Google Drive are automatically synced across all your devices.
              </p>
            </div>
          )}
        </main>
      </div>

      <IosInstallBanner />

      <SettingsModal
        isOpen={isSettingsOpen}
        currentConfig={config}
        onSaveConfig={(newConfig) => {
          saveConfig(newConfig);
          setConfig(newConfig);
          auth.updateClientId(newConfig.clientId);
          loadTree();
        }}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run integration test and verify it passes**

Run: `npm test tests/appIntegration.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx tests/appIntegration.test.tsx
git commit -m "feat(app): integrate App root with Google Drive, IndexedDB, and Workspace"
```

---

### Task 7.2: GitHub Actions Automated CI/CD Workflow & Production Build Verification

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`
- Modify: `package.json`

**Interfaces:**
- Produces: Fully automated GitHub Pages deployment on push to `main` with tested production build artifacts.

- [ ] **Step 1: Create GitHub Actions deployment workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build-and-deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Tests
        run: npm test

      - name: Build Application
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Create comprehensive README.md with setup guide**

```markdown
# MDCloud ☁️

A client-side Markdown note-taking and figure-viewing web app hosted on GitHub Pages that syncs directly with a designated Google Drive folder across Mac, iPad, and iPhone.

## ✨ Features
* **Zero Secrets in Repository**: No private API keys, client secrets, or user credentials committed to git.
* **Automatic Relative Figure Resolution**: Markdown paths like `![Figure](./figures/chart.png)` or `![Figure](chart.png)` resolve directly against your Google Drive folder.
* **iPad & iPhone Home Screen Support**: Optimized PWA with safe-area insets, Apple touch icons, and standalone mode.
* **LaTeX Math & Diagrams**: Built-in support for KaTeX math (`$E=mc^2$`) and Mermaid diagrams.
* **Dual-Pane Workspace**: Live split editor on desktop, tabbed switch on mobile, with drag-and-drop / clipboard image uploading.
* **Offline-Resilient**: Caches notes and image blobs in IndexedDB.

## 🚀 One-Time Setup (2 minutes)
1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a free project.
2. In **APIs & Services**, enable the **Google Drive API**.
3. Under **Credentials**, create an **OAuth 2.0 Client ID** (Application type: *Web application*).
   * Set **Authorized JavaScript origins** to your GitHub Pages URL (e.g. `https://<your-username>.github.io`) and `http://localhost:5173` for development.
4. Open your MDCloud site, enter your **Client ID** and your **Google Drive Folder link**, and click **Save & Connect**.
```

- [ ] **Step 3: Run full production test suite and build**

Run: `npm test && npm run build`  
Expected: All tests pass and `dist/` builds with zero errors.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml README.md package.json
git commit -m "ci: add GitHub Pages deployment workflow and setup documentation"
```
