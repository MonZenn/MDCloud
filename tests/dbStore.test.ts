import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDB } from 'idb';
import { DbStore, type CachedNote, type CachedImage } from '../src/services/dbStore';

describe('DbStore (IndexedDB)', () => {
  let db: DbStore;

  beforeEach(async () => {
    db = new DbStore();
    await db.init();
    await db.clearAll();
  });

  it('stores and retrieves cached notes', async () => {
    const note: CachedNote = {
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
    const img: CachedImage = {
      fileId: 'img-1',
      blob,
      mimeType: 'image/png',
      modifiedTime: '2026-09-16T12:00:00Z'
    };
    await db.saveImage(img);
    const retrieved = await db.getImage('img-1');
    // Verify image properties
    expect(retrieved?.fileId).toBe('img-1');
    expect(retrieved?.mimeType).toBe('image/png');
    expect(retrieved?.modifiedTime).toBe('2026-09-16T12:00:00Z');
    expect(retrieved?.blob).toBeDefined();
  });

  it('returns undefined when note or image is not found', async () => {
    const note = await db.getNote('non-existent-note');
    expect(note).toBeUndefined();

    const image = await db.getImage('non-existent-img');
    expect(image).toBeUndefined();
  });

  it('updates an existing cached note', async () => {
    const note: CachedNote = {
      fileId: 'note-update',
      folderId: 'folder-1',
      name: 'Initial.md',
      content: 'initial content',
      modifiedTime: '2026-09-16T12:00:00Z',
      isDirty: false
    };
    await db.saveNote(note);

    const updatedNote: CachedNote = {
      ...note,
      content: 'updated content',
      isDirty: true
    };
    await db.saveNote(updatedNote);

    const retrieved = await db.getNote('note-update');
    expect(retrieved).toEqual(updatedNote);
  });

  it('clears all object stores with clearAll()', async () => {
    await db.saveNote({
      fileId: 'note-to-clear',
      folderId: 'folder-1',
      name: 'Clear.md',
      content: 'clear me',
      modifiedTime: '2026-09-16T12:00:00Z',
      isDirty: false
    });

    await db.saveImage({
      fileId: 'img-to-clear',
      blob: new Blob(['bytes'], { type: 'image/jpeg' }),
      mimeType: 'image/jpeg',
      modifiedTime: '2026-09-16T12:00:00Z'
    });

    await db.clearAll();

    expect(await db.getNote('note-to-clear')).toBeUndefined();
    expect(await db.getImage('img-to-clear')).toBeUndefined();
  });

  it('handles multiple init calls idempotently', async () => {
    await db.init();
    await db.init();
    const note: CachedNote = {
      fileId: 'note-init',
      folderId: 'folder-1',
      name: 'Test.md',
      content: 'test',
      modifiedTime: '2026-09-16T12:00:00Z',
      isDirty: false
    };
    await db.saveNote(note);
    expect(await db.getNote('note-init')).toEqual(note);
  });

  it('creates notes, images, and tree stores with correct key paths', async () => {
    const rawDb = await openDB('mdcloud_db', 1);
    expect(rawDb.objectStoreNames.contains('notes')).toBe(true);
    expect(rawDb.objectStoreNames.contains('images')).toBe(true);
    expect(rawDb.objectStoreNames.contains('tree')).toBe(true);

    const tx = rawDb.transaction(['notes', 'images', 'tree'], 'readonly');
    expect(tx.objectStore('notes').keyPath).toBe('fileId');
    expect(tx.objectStore('images').keyPath).toBe('fileId');
    expect(tx.objectStore('tree').keyPath).toBe('folderId');
    rawDb.close();
  });
});
