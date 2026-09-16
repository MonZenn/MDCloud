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
