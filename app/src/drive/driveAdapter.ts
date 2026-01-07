import type { FileRecord } from "../vfs/virtualFileSystem";
import { APP_ROOT_FOLDER_NAME } from "../config";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  modifiedTime?: string;
  appProperties?: Record<string, string>;
};

type ListResponse = {
  files: DriveFile[];
  nextPageToken?: string;
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

export class DriveAdapter {
  private tokenProvider: () => Promise<string | undefined>;
  private appRootId?: string;

  constructor(tokenProvider: () => Promise<string | undefined>) {
    this.tokenProvider = tokenProvider;
  }

  private async authHeaders() {
    const token = await this.tokenProvider();
    if (!token) throw new Error("Not authenticated");
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  private async ensureAppRoot(): Promise<string> {
    if (this.appRootId) return this.appRootId;
    const headers = await this.authHeaders();
    const q = encodeURIComponent(`name='${APP_ROOT_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,parents,mimeType)&spaces=drive`,
      { headers },
    );
    const data = (await res.json()) as ListResponse;
    let folder = data.files[0];
    if (!folder) {
      const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name: APP_ROOT_FOLDER_NAME, mimeType: FOLDER_MIME }),
      });
      if (!createRes.ok) throw new Error("Failed to create app root");
      folder = await createRes.json();
    }
    this.appRootId = folder.id;
    await this.ensureFolder(`${APP_ROOT_FOLDER_NAME}/Imported`);
    await this.ensureFolder(`${APP_ROOT_FOLDER_NAME}/.app_state`);
    return folder.id;
  }

  private async ensureFolder(path: string): Promise<string> {
    const headers = await this.authHeaders();
    const parts = path.split("/").filter(Boolean);
    let parentId = "root";
    for (const part of parts) {
      const q = encodeURIComponent(
        `name='${part}' and mimeType='${FOLDER_MIME}' and trashed=false and '${parentId}' in parents`,
      );
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,parents,mimeType)&spaces=drive`,
        { headers },
      );
      const data = (await res.json()) as ListResponse;
      let folder = data.files[0];
      if (!folder) {
        const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ name: part, mimeType: FOLDER_MIME, parents: [parentId] }),
        });
        if (!createRes.ok) throw new Error(`Failed to create folder ${part}`);
        folder = await createRes.json();
      }
      parentId = folder.id;
    }
    return parentId;
  }

  private async listAllFiles(): Promise<DriveFile[]> {
    const headers = await this.authHeaders();
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?pageSize=500&pageToken=${pageToken ?? ""}&fields=nextPageToken,files(id,name,mimeType,parents,modifiedTime,appProperties)&q=trashed=false&spaces=drive`,
        { headers },
      );
      if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
      const data = (await res.json()) as ListResponse;
      files.push(...(data.files ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);
    return files;
  }

  private buildPaths(files: DriveFile[]): Record<string, string> {
    const map = new Map(files.map((f) => [f.id, f]));
    const cache: Record<string, string> = {};
    const getPath = (file: DriveFile): string => {
      if (cache[file.id]) return cache[file.id];
      if (!file.parents || file.parents.length === 0) {
        cache[file.id] = `/${file.name}`;
        return cache[file.id];
      }
      const parent = map.get(file.parents[0]);
      if (!parent) {
        cache[file.id] = `/${file.name}`;
        return cache[file.id];
      }
      const parentPath = getPath(parent);
      cache[file.id] = `${parentPath}/${file.name}`;
      return cache[file.id];
    };
    files.forEach((f) => getPath(f));
    return cache;
  }

  async listFiles(): Promise<FileRecord[]> {
    await this.ensureAppRoot();
    const files = await this.listAllFiles();
    const paths = this.buildPaths(files);
    return files
      .filter((f) => f.mimeType !== FOLDER_MIME)
      .map((f) => ({
        id: f.id,
        path: paths[f.id],
        content: "",
        createdByApp: f.appProperties?.createdByApp === "true",
        lastModified: f.modifiedTime ? Date.parse(f.modifiedTime) : Date.now(),
      }));
  }

  async readFile(id: string): Promise<FileRecord> {
    const headers = await this.authHeaders();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers });
    if (!res.ok) throw new Error(`Failed to read file ${id}`);
    const content = await res.text();
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType,parents,modifiedTime,appProperties`,
      { headers },
    );
    const meta = (await metaRes.json()) as DriveFile;
    const path = await this.resolvePath(meta);
    return {
      id: meta.id,
      path: path,
      content,
      createdByApp: meta.appProperties?.createdByApp === "true",
      lastModified: meta.modifiedTime ? Date.parse(meta.modifiedTime) : Date.now(),
    };
  }

  async writeFile(id: string, content: string): Promise<FileRecord> {
    const headers = await this.authHeaders();
    const metadataRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType,parents,modifiedTime,appProperties`,
      { headers },
    );
    const meta = (await metadataRes.json()) as DriveFile;
    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;
    const body =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify({}) +
      delimiter +
      "Content-Type: text/plain\r\n\r\n" +
      content +
      closeDelim;

    const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!uploadRes.ok) throw new Error(`Failed to write file ${id}`);
    const updatedMeta = (await uploadRes.json()) as DriveFile;
    const path = await this.resolvePath(updatedMeta);
    return {
      id: updatedMeta.id,
      path,
      content,
      createdByApp: meta.appProperties?.createdByApp === "true",
      lastModified: updatedMeta.modifiedTime ? Date.parse(updatedMeta.modifiedTime) : Date.now(),
    };
  }

  async createFile(path: string, content: string, createdByApp: boolean): Promise<FileRecord> {
    const headers = await this.authHeaders();
    const parts = path.split("/").filter(Boolean);
    const fileName = parts.pop()!;
    const parentPath = parts.join("/");
    const parentId = await this.ensureFolder(parentPath);

    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;
    const metadata = {
      name: fileName,
      parents: [parentId],
      appProperties: createdByApp ? { createdByApp: "true" } : undefined,
    };
    const body =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: text/plain\r\n\r\n" +
      content +
      closeDelim;

    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { ...headers, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!res.ok) throw new Error("Failed to create file");
    const created = (await res.json()) as DriveFile;
    const resolvedPath = await this.resolvePath(created);
    return {
      id: created.id,
      path: resolvedPath,
      content,
      createdByApp,
      lastModified: Date.now(),
    };
  }

  private async resolvePath(file: DriveFile): Promise<string> {
    const headers = await this.authHeaders();
    const segments: string[] = [file.name];
    let current: DriveFile | undefined = file;
    while (current.parents && current.parents.length > 0) {
      const parentId = current.parents[0];
      if (parentId === "root") {
        segments.push("");
        break;
      }
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${parentId}?fields=id,name,parents,mimeType`,
        { headers },
      );
      if (!res.ok) break;
      const parent = (await res.json()) as DriveFile;
      segments.push(parent.name);
      current = parent;
      if (!parent.parents || parent.parents.length === 0) break;
    }
    return `/${segments.reverse().join("/")}`;
  }
}
