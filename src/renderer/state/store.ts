import { create } from 'zustand';

export interface Session {
  id: string;
  name: string;
  cwd: string;
  isActive: boolean;
}

export type PanelType = 'none' | 'files' | 'git';
export type EditorMode = 'edit' | 'diff';

export interface EditorState {
  isOpen: boolean;
  filePath: string | null;
  mode: EditorMode;
  splitRatio: number; // 0-1, portion for terminal
}

export interface GitStatus {
  isRepo: boolean;
  branch: string;
  files: Array<{ path: string; index: string; working_dir: string }>;
  staged: string[];
  modified: string[];
  notAdded: string[];
  ahead?: number;
  behind?: number;
}

interface AppState {
  // Sessions
  sessions: Session[];
  activeSessionId: string | null;
  nextSessionNumber: number;

  // Panels
  activePanel: PanelType;
  rootDirectory: string | null;

  // Editor
  editor: EditorState;

  // Git
  gitStatus: GitStatus | null;

  // Actions
  addSession: () => string;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  setSessionCwd: (id: string, cwd: string) => void;

  togglePanel: (panel: PanelType) => void;
  setRootDirectory: (path: string | null) => void;

  openFile: (filePath: string, mode?: EditorMode) => void;
  closeEditor: () => void;
  setEditorMode: (mode: EditorMode) => void;
  setSplitRatio: (ratio: number) => void;

  setGitStatus: (status: GitStatus | null) => void;
}

let sessionCounter = 0;

function generateId(): string {
  sessionCounter++;
  return `session-${Date.now()}-${sessionCounter}`;
}

export const useAppStore = create<AppState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  nextSessionNumber: 1,

  activePanel: 'none',
  rootDirectory: null,

  editor: {
    isOpen: false,
    filePath: null,
    mode: 'edit',
    splitRatio: 0.5,
  },

  gitStatus: null,

  addSession: () => {
    const id = generateId();
    const { nextSessionNumber, sessions } = get();
    const newSession: Session = {
      id,
      name: `Terminal ${nextSessionNumber}`,
      cwd: '',
      isActive: true,
    };
    set({
      sessions: [
        ...sessions.map(s => ({ ...s, isActive: false })),
        newSession,
      ],
      activeSessionId: id,
      nextSessionNumber: nextSessionNumber + 1,
    });
    return id;
  },

  removeSession: (id: string) => {
    const { sessions, activeSessionId } = get();
    const filtered = sessions.filter(s => s.id !== id);
    if (filtered.length === 0) {
      // Add a new session if removing the last one
      const newId = generateId();
      const { nextSessionNumber } = get();
      set({
        sessions: [{
          id: newId,
          name: `Terminal ${nextSessionNumber}`,
          cwd: '',
          isActive: true,
        }],
        activeSessionId: newId,
        nextSessionNumber: nextSessionNumber + 1,
      });
      return;
    }
    let newActiveId = activeSessionId;
    if (activeSessionId === id) {
      const idx = sessions.findIndex(s => s.id === id);
      const newIdx = Math.min(idx, filtered.length - 1);
      newActiveId = filtered[newIdx].id;
    }
    set({
      sessions: filtered.map(s => ({
        ...s,
        isActive: s.id === newActiveId,
      })),
      activeSessionId: newActiveId,
    });
  },

  setActiveSession: (id: string) => {
    set(state => ({
      sessions: state.sessions.map(s => ({
        ...s,
        isActive: s.id === id,
      })),
      activeSessionId: id,
    }));
  },

  renameSession: (id: string, name: string) => {
    set(state => ({
      sessions: state.sessions.map(s =>
        s.id === id ? { ...s, name } : s
      ),
    }));
  },

  setSessionCwd: (id: string, cwd: string) => {
    set(state => ({
      sessions: state.sessions.map(s =>
        s.id === id ? { ...s, cwd } : s
      ),
    }));
  },

  togglePanel: (panel: PanelType) => {
    const { activePanel } = get();
    set({ activePanel: activePanel === panel ? 'none' : panel });
  },

  setRootDirectory: (path: string | null) => {
    set({ rootDirectory: path });
  },

  openFile: (filePath: string, mode: EditorMode = 'edit') => {
    set(state => ({
      editor: {
        ...state.editor,
        isOpen: true,
        filePath,
        mode,
      },
    }));
  },

  closeEditor: () => {
    set(state => ({
      editor: {
        ...state.editor,
        isOpen: false,
        filePath: null,
      },
    }));
  },

  setEditorMode: (mode: EditorMode) => {
    set(state => ({
      editor: { ...state.editor, mode },
    }));
  },

  setSplitRatio: (ratio: number) => {
    set(state => ({
      editor: { ...state.editor, splitRatio: Math.max(0.2, Math.min(0.8, ratio)) },
    }));
  },

  setGitStatus: (status: GitStatus | null) => {
    set({ gitStatus: status });
  },
}));
