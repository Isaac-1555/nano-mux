import { contextBridge, ipcRenderer } from 'electron';

export interface NanoMuxAPI {
  pty: {
    create: (id: string, cwd: string) => Promise<{ id: string; cwd: string }>;
    write: (id: string, data: string) => Promise<void>;
    resize: (id: string, cols: number, rows: number) => Promise<void>;
    destroy: (id: string) => Promise<void>;
    getCwd: (id: string) => Promise<string>;
    getForegroundProcess: (id: string) => Promise<string | null>;
    onData: (callback: (data: { id: string; data: string }) => void) => () => void;
    onExit: (callback: (data: { id: string; exitCode: number }) => void) => () => void;
  };
  fs: {
    readDir: (dirPath: string) => Promise<Array<{ name: string; path: string; isDirectory: boolean }>>;
    readFile: (filePath: string) => Promise<{ content: string | null; error: string | null }>;
    writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error: string | null }>;
    getHome: () => Promise<string>;
  };
  git: {
    status: (cwd: string) => Promise<{
      isRepo: boolean;
      branch: string;
      files: Array<{ path: string; index: string; working_dir: string }>;
      staged: string[];
      modified: string[];
      notAdded: string[];
      ahead?: number;
      behind?: number;
    }>;
    diff: (cwd: string, filePath?: string) => Promise<{ diff: string | null; error: string | null }>;
    fileContent: (cwd: string, filePath: string, ref: string) => Promise<{ content: string; error: string | null }>;
  };
  shell: {
    openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  };
  dialog: {
    openDirectory: () => Promise<string | null>;
  };
}

const api: NanoMuxAPI = {
  pty: {
    create: (id, cwd) => ipcRenderer.invoke('pty:create', { id, cwd }),
    write: (id, data) => ipcRenderer.invoke('pty:write', { id, data }),
    resize: (id, cols, rows) => ipcRenderer.invoke('pty:resize', { id, cols, rows }),
    destroy: (id) => ipcRenderer.invoke('pty:destroy', { id }),
    getCwd: (id) => ipcRenderer.invoke('pty:getCwd', { id }),
    getForegroundProcess: (id) => ipcRenderer.invoke('pty:getForegroundProcess', { id }),
    onData: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; data: string }) => callback(data);
      ipcRenderer.on('pty:data', handler);
      return () => ipcRenderer.removeListener('pty:data', handler);
    },
    onExit: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; exitCode: number }) => callback(data);
      ipcRenderer.on('pty:exit', handler);
      return () => ipcRenderer.removeListener('pty:exit', handler);
    },
  },
  fs: {
    readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', { dirPath }),
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', { filePath }),
    writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', { filePath, content }),
    getHome: () => ipcRenderer.invoke('fs:getHome'),
  },
  git: {
    status: (cwd) => ipcRenderer.invoke('git:status', { cwd }),
    diff: (cwd, filePath) => ipcRenderer.invoke('git:diff', { cwd, filePath }),
    fileContent: (cwd, filePath, ref) => ipcRenderer.invoke('git:fileContent', { cwd, filePath, ref }),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  },
};

contextBridge.exposeInMainWorld('nanoMux', api);
