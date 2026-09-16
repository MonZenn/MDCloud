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
    const data = (await res.json()) as { files?: DriveFileItem[] };
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
        body: content,
      }
    );
    return res.json() as Promise<DriveFileItem>;
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

    let bodyData: BodyInit;
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
      const formData = new FormData();
      formData.append('metadata', metaBlob);
      formData.append('file', content);
      bodyData = formData;
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
        body: bodyData,
      }
    );
    return res.json() as Promise<DriveFileItem>;
  }

  public async createFolder(name: string, parentFolderId: string): Promise<DriveFileItem> {
    const res = await this.request('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        parents: [parentFolderId],
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });
    return res.json() as Promise<DriveFileItem>;
  }

  public async renameItem(fileId: string, newName: string): Promise<DriveFileItem> {
    const res = await this.request(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    return res.json() as Promise<DriveFileItem>;
  }

  public async deleteItem(fileId: string): Promise<void> {
    await this.request(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
    });
  }
}
