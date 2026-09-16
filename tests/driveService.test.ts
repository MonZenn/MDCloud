import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DriveService, DriveFileItem } from '../src/services/driveService';

describe('DriveService', () => {
  const mockToken = 'test-bearer-token';
  let getToken: () => string | null;
  let service: DriveService;

  beforeEach(() => {
    vi.restoreAllMocks();
    getToken = vi.fn(() => mockToken);
    service = new DriveService(getToken);
  });

  describe('listChildren', () => {
    it('lists children for a folder with correct headers and query parameters', async () => {
      const mockFiles: DriveFileItem[] = [
        {
          id: 'file-1',
          name: 'Note.md',
          mimeType: 'text/markdown',
          modifiedTime: '2026-09-16T10:00:00.000Z',
          size: '1024',
          parents: ['folder123'],
        },
        {
          id: 'folder-2',
          name: 'SubFolder',
          mimeType: 'application/vnd.google-apps.folder',
          modifiedTime: '2026-09-16T11:00:00.000Z',
          parents: ['folder123'],
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ files: mockFiles }),
      });

      const items = await service.listChildren('folder123');

      expect(items).toEqual(mockFiles);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOptions] = vi.mocked(global.fetch).mock.calls[0];
      const url = new URL(calledUrl as string);

      expect(url.origin + url.pathname).toBe('https://www.googleapis.com/drive/v3/files');
      expect(url.searchParams.get('q')).toBe("'folder123' in parents and trashed=false");
      expect(url.searchParams.get('fields')).toBe('files(id, name, mimeType, modifiedTime, size, parents)');
      expect(url.searchParams.get('pageSize')).toBe('1000');

      const headers = new Headers(calledOptions?.headers);
      expect(headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
    });

    it('returns empty array if files field is missing in response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const items = await service.listChildren('folderEmpty');
      expect(items).toEqual([]);
    });
  });

  describe('getFileText', () => {
    it('fetches text content for a file with alt=media', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '# Hello Markdown\nContent here',
      });

      const text = await service.getFileText('file123');

      expect(text).toBe('# Hello Markdown\nContent here');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/drive/v3/files/file123?alt=media',
        expect.objectContaining({
          headers: expect.any(Headers),
        })
      );

      const [, calledOptions] = vi.mocked(global.fetch).mock.calls[0];
      const headers = new Headers(calledOptions?.headers);
      expect(headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
    });
  });

  describe('getFileBlob', () => {
    it('fetches binary blob content for a file with alt=media', async () => {
      const mockBlob = new Blob(['fake binary image data'], { type: 'image/png' });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      const blob = await service.getFileBlob('file456');

      expect(blob).toBe(mockBlob);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/drive/v3/files/file456?alt=media',
        expect.objectContaining({
          headers: expect.any(Headers),
        })
      );

      const [, calledOptions] = vi.mocked(global.fetch).mock.calls[0];
      const headers = new Headers(calledOptions?.headers);
      expect(headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
    });
  });

  describe('updateFileText', () => {
    it('patches file content with text/markdown uploadType=media', async () => {
      const updatedItem: DriveFileItem = {
        id: 'file123',
        name: 'Note.md',
        mimeType: 'text/markdown',
        modifiedTime: '2026-09-16T12:00:00.000Z',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => updatedItem,
      });

      const result = await service.updateFileText('file123', '# Updated content');

      expect(result).toEqual(updatedItem);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOptions] = vi.mocked(global.fetch).mock.calls[0];
      expect(calledUrl).toBe('https://www.googleapis.com/upload/drive/v3/files/file123?uploadType=media&fields=id,name,mimeType,modifiedTime,size,parents');
      expect(calledOptions?.method).toBe('PATCH');
      expect(calledOptions?.body).toBe('# Updated content');

      const headers = new Headers(calledOptions?.headers);
      expect(headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
      expect(headers.get('Content-Type')).toBe('text/markdown; charset=UTF-8');
    });
  });

  describe('createFile', () => {
    it('creates a text file using multipart/related upload', async () => {
      const createdItem: DriveFileItem = {
        id: 'new-file-id',
        name: 'NewDoc.md',
        mimeType: 'text/markdown',
        modifiedTime: '2026-09-16T12:00:00.000Z',
        parents: ['parent-folder-id'],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => createdItem,
      });

      const result = await service.createFile(
        'NewDoc.md',
        'parent-folder-id',
        '# Document Content',
        'text/markdown'
      );

      expect(result).toEqual(createdItem);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOptions] = vi.mocked(global.fetch).mock.calls[0];
      expect(calledUrl).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,parents');
      expect(calledOptions?.method).toBe('POST');

      const headers = new Headers(calledOptions?.headers);
      expect(headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
      const contentType = headers.get('Content-Type');
      expect(contentType).toContain('multipart/related; boundary=');

      const boundary = contentType?.split('boundary=')[1];
      expect(boundary).toBeDefined();

      const body = calledOptions?.body as string;
      expect(body).toContain(`--${boundary}`);
      expect(body).toContain('Content-Type: application/json; charset=UTF-8');
      expect(body).toContain(JSON.stringify({
        name: 'NewDoc.md',
        parents: ['parent-folder-id'],
        mimeType: 'text/markdown',
      }));
      expect(body).toContain('Content-Type: text/markdown');
      expect(body).toContain('# Document Content');
      expect(body).toContain(`--${boundary}--`);
    });

    it('creates a binary file using FormData upload for Blob', async () => {
      const createdItem: DriveFileItem = {
        id: 'new-image-id',
        name: 'photo.png',
        mimeType: 'image/png',
        modifiedTime: '2026-09-16T12:00:00.000Z',
        parents: ['parent-folder-id'],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => createdItem,
      });

      const imageBlob = new Blob(['binary image data'], { type: 'image/png' });
      const result = await service.createFile(
        'photo.png',
        'parent-folder-id',
        imageBlob,
        'image/png'
      );

      expect(result).toEqual(createdItem);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOptions] = vi.mocked(global.fetch).mock.calls[0];
      expect(calledUrl).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,parents');
      expect(calledOptions?.method).toBe('POST');

      const headers = new Headers(calledOptions?.headers);
      expect(headers.get('Authorization')).toBe(`Bearer ${mockToken}`);

      // Body should be FormData
      const formData = calledOptions?.body as FormData;
      expect(formData).toBeInstanceOf(FormData);
      expect(formData.has('metadata')).toBe(true);
      expect(formData.has('file')).toBe(true);
    });
  });

  describe('createFolder', () => {
    it('creates a folder with correct mimeType and metadata', async () => {
      const createdFolder: DriveFileItem = {
        id: 'new-folder-id',
        name: 'Projects',
        mimeType: 'application/vnd.google-apps.folder',
        modifiedTime: '2026-09-16T12:00:00.000Z',
        parents: ['root-folder-id'],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => createdFolder,
      });

      const result = await service.createFolder('Projects', 'root-folder-id');

      expect(result).toEqual(createdFolder);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOptions] = vi.mocked(global.fetch).mock.calls[0];
      expect(calledUrl).toBe('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,modifiedTime,size,parents');
      expect(calledOptions?.method).toBe('POST');
      expect(JSON.parse(calledOptions?.body as string)).toEqual({
        name: 'Projects',
        parents: ['root-folder-id'],
        mimeType: 'application/vnd.google-apps.folder',
      });

      const headers = new Headers(calledOptions?.headers);
      expect(headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
      expect(headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('renameItem', () => {
    it('renames a file or folder via PATCH request', async () => {
      const renamedItem: DriveFileItem = {
        id: 'item-123',
        name: 'RenamedItem.md',
        mimeType: 'text/markdown',
        modifiedTime: '2026-09-16T12:30:00.000Z',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => renamedItem,
      });

      const result = await service.renameItem('item-123', 'RenamedItem.md');

      expect(result).toEqual(renamedItem);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOptions] = vi.mocked(global.fetch).mock.calls[0];
      expect(calledUrl).toBe('https://www.googleapis.com/drive/v3/files/item-123?fields=id,name,mimeType,modifiedTime,size,parents');
      expect(calledOptions?.method).toBe('PATCH');
      expect(JSON.parse(calledOptions?.body as string)).toEqual({
        name: 'RenamedItem.md',
      });

      const headers = new Headers(calledOptions?.headers);
      expect(headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
      expect(headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('deleteItem', () => {
    it('deletes an item via DELETE request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      await service.deleteItem('item-delete-123');

      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOptions] = vi.mocked(global.fetch).mock.calls[0];
      expect(calledUrl).toBe('https://www.googleapis.com/drive/v3/files/item-delete-123');
      expect(calledOptions?.method).toBe('DELETE');

      const headers = new Headers(calledOptions?.headers);
      expect(headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
    });
  });

  describe('authentication and error handling', () => {
    it('throws error when getToken returns null or empty', async () => {
      const unauthService = new DriveService(() => null);

      await expect(unauthService.listChildren('folder123')).rejects.toThrow(
        'Not authenticated with Google'
      );
      await expect(unauthService.getFileText('file123')).rejects.toThrow(
        'Not authenticated with Google'
      );
      await expect(unauthService.createFolder('Folder', 'parent')).rejects.toThrow(
        'Not authenticated with Google'
      );
    });

    it('throws error on non-ok HTTP response with error details', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Rate limit exceeded',
      });

      await expect(service.listChildren('folder123')).rejects.toThrow(
        'Google Drive API error (403): Rate limit exceeded'
      );
    });

    it('handles non-ok HTTP response when res.text() fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => {
          throw new Error('Stream read failure');
        },
      });

      await expect(service.getFileText('file123')).rejects.toThrow(
        'Google Drive API error (500): '
      );
    });
  });
});
