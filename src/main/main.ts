import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as pty from 'node-pty';
import simpleGit, { SimpleGit } from 'simple-git';

// ── PTY Management ──────────────────────────────────────────────

interface PtySession {
  id: string;
  process: pty.IPty;
  cwd: string;
}

const sessions = new Map<string, PtySession>();

function getShell(): string {
  if (process.platform === 'win32') return 'powershell.exe';
  return process.env.SHELL || '/bin/zsh';
}

function createPtySession(id: string, cwd: string): PtySession {
  const shell = getShell();
  const proc = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env: { ...process.env } as { [key: string]: string },
  });

  const session: PtySession = { id, process: proc, cwd };
  sessions.set(id, session);
  return session;
}

// ── IPC Handlers ────────────────────────────────────────────────

function setupIPC(win: BrowserWindow) {
  // PTY: create session
  ipcMain.handle('pty:create', (_event, { id, cwd }: { id: string; cwd: string }) => {
    const session = createPtySession(id, cwd || os.homedir());
    session.process.onData((data: string) => {
      if (!win.isDestroyed()) {
        win.webContents.send('pty:data', { id, data });
      }
    });
    session.process.onExit(({ exitCode }: { exitCode: number }) => {
      if (!win.isDestroyed()) {
        win.webContents.send('pty:exit', { id, exitCode });
      }
      sessions.delete(id);
    });
    return { id, cwd: session.cwd };
  });

  // PTY: write to session
  ipcMain.handle('pty:write', (_event, { id, data }: { id: string; data: string }) => {
    const session = sessions.get(id);
    if (session) session.process.write(data);
  });

  // PTY: resize
  ipcMain.handle('pty:resize', (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    const session = sessions.get(id);
    if (session) session.process.resize(cols, rows);
  });

  // PTY: destroy session
  ipcMain.handle('pty:destroy', (_event, { id }: { id: string }) => {
    const session = sessions.get(id);
    if (session) {
      session.process.kill();
      sessions.delete(id);
    }
  });

  // PTY: get cwd
  ipcMain.handle('pty:getCwd', (_event, { id }: { id: string }) => {
    const session = sessions.get(id);
    return session?.cwd || os.homedir();
  });

  // ── File System ─────────────────────────────────────────────

  ipcMain.handle('fs:readDir', async (_event, { dirPath }: { dirPath: string }) => {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(e => !e.name.startsWith('.'))
        .map(e => ({
          name: e.name,
          path: path.join(dirPath, e.name),
          isDirectory: e.isDirectory(),
        }))
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
    } catch {
      return [];
    }
  });

  ipcMain.handle('fs:readFile', async (_event, { filePath }: { filePath: string }) => {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return { content, error: null };
    } catch (err: any) {
      return { content: null, error: err.message };
    }
  });

  ipcMain.handle('fs:writeFile', async (_event, { filePath, content }: { filePath: string; content: string }) => {
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8');
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('fs:getHome', () => os.homedir());

  // ── Dialog ───────────────────────────────────────────────────────

  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Open Folder',
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // ── Shell ───────────────────────────────────────────────────────

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Git ─────────────────────────────────────────────────────

  ipcMain.handle('git:status', async (_event, { cwd }: { cwd: string }) => {
    try {
      const git: SimpleGit = simpleGit(cwd);
      const isRepo = await git.checkIsRepo();
      if (!isRepo) return { isRepo: false, branch: '', files: [], staged: [], modified: [], notAdded: [] };

      const status = await git.status();
      return {
        isRepo: true,
        branch: status.current || '',
        files: status.files.map(f => ({
          path: f.path,
          index: f.index,
          working_dir: f.working_dir,
        })),
        staged: status.staged,
        modified: status.modified,
        notAdded: status.not_added,
        ahead: status.ahead,
        behind: status.behind,
      };
    } catch {
      return { isRepo: false, branch: '', files: [], staged: [], modified: [], notAdded: [] };
    }
  });

  ipcMain.handle('git:diff', async (_event, { cwd, filePath }: { cwd: string; filePath?: string }) => {
    try {
      const git: SimpleGit = simpleGit(cwd);
      if (filePath) {
        const diff = await git.diff([filePath]);
        return { diff, error: null };
      }
      const diff = await git.diff();
      return { diff, error: null };
    } catch (err: any) {
      return { diff: null, error: err.message };
    }
  });

  ipcMain.handle('git:fileContent', async (_event, { cwd, filePath, ref }: { cwd: string; filePath: string; ref: string }) => {
    try {
      const git: SimpleGit = simpleGit(cwd);
      const content = await git.show([`${ref}:${filePath}`]);
      return { content, error: null };
    } catch (err: any) {
      return { content: '', error: err.message };
    }
  });
}

// ── Window ──────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d1117',
    icon: path.join(__dirname, '..', '..', 'public', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  setupIPC(mainWindow);

  // Use env var to distinguish dev mode (with webpack-dev-server) from production build
  const isDev = process.env.NANO_MUX_DEV === '1';
  if (isDev) {
    mainWindow.loadURL('http://localhost:9000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    sessions.forEach(s => s.process.kill());
    sessions.clear();
  });
}

app.whenReady().then(() => {
  app.name = 'nano-mux';
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
