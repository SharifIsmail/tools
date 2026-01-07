export type FileRecord = {
  id: string;
  path: string;
  content: string;
  createdByApp: boolean;
  lastModified: number;
  revision?: number;
  mimeType?: string;
  downloadUrl?: string;
};

export type DriveAdapter = {
  readFile(id: string): Promise<FileRecord>;
  writeFile(id: string, content: string, opts?: { path?: string; createdByApp?: boolean }): Promise<FileRecord>;
  listFiles(): Promise<FileRecord[]>;
  createFile(path: string, content: string, createdByApp: boolean): Promise<FileRecord>;
};
