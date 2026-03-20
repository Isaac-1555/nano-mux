import React, { useEffect, useRef, useCallback, memo } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { useAppStore } from '../state/store';
import { cliAgent, TUI_AGENTS } from '../utils/cliAgent';

interface TerminalProps {
  sessionId: string;
  isVisible: boolean;
}

interface TerminalEntry {
  xterm: XTerm;
  fitAddon: FitAddon;
  initialized: boolean;
  cwdPollInterval?: ReturnType<typeof setInterval>;
  dataListenerCleanup?: () => void;
}

const terminals = new Map<string, TerminalEntry>();

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  }) as T;
}

export const TerminalComponent: React.FC<TerminalProps> = memo(({ sessionId, isVisible }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setSessionCwd, setSessionActivity } = useAppStore();

  const initTerminal = useCallback(async () => {
    if (!containerRef.current || !sessionId) return;

    let entry = terminals.get(sessionId);

    if (!entry) {
      const xterm = new XTerm({
        theme: {
          background: '#0d1117',
          foreground: '#c9d1d9',
          cursor: '#58a6ff',
          cursorAccent: '#0d1117',
          selectionBackground: '#264f78',
          selectionForeground: '#ffffff',
          black: '#484f58',
          red: '#ff7b72',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39d353',
          white: '#b1bac4',
          brightBlack: '#6e7681',
          brightRed: '#ffa198',
          brightGreen: '#56d364',
          brightYellow: '#e3b341',
          brightBlue: '#79c0ff',
          brightMagenta: '#d2a8ff',
          brightCyan: '#56d364',
          brightWhite: '#f0f6fc',
        },
        fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace",
        fontSize: 13,
        lineHeight: 1.35,
        letterSpacing: 0,
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 5000,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon((event, uri) => {
        event.preventDefault();
        window.nanoMux.shell.openExternal(uri);
      });

      xterm.loadAddon(fitAddon);
      xterm.loadAddon(webLinksAddon);

      entry = { xterm, fitAddon, initialized: false };
      terminals.set(sessionId, entry);
    }

    if (!entry.initialized) {
      entry.xterm.open(containerRef.current);

      const seededCwd = useAppStore.getState().sessions.find(s => s.id === sessionId)?.cwd?.trim();
      const initialCwd = seededCwd || await window.nanoMux.fs.getHome();
      const created = await window.nanoMux.pty.create(sessionId, initialCwd);
      setSessionCwd(sessionId, created.cwd);

      const removeDataListener = window.nanoMux.pty.onData(({ id, data }) => {
        if (id === sessionId) {
          entry!.xterm.write(data);
          cliAgent.processData(sessionId, data);
        }
      });

      const onDataDisposable = entry.xterm.onData((data: string) => {
        window.nanoMux.pty.write(sessionId, data);
      });

      const onResizeDisposable = entry.xterm.onResize(({ cols, rows }) => {
        window.nanoMux.pty.resize(sessionId, cols, rows);
      });

      const cwdPollInterval = setInterval(async () => {
        try {
          const cwd = await window.nanoMux.pty.getCwd(sessionId);
          setSessionCwd(sessionId, cwd);
        } catch {
        }
        try {
          const proc = await window.nanoMux.pty.getForegroundProcess(sessionId);
          if (proc) {
            if (TUI_AGENTS.has(proc)) {
              const title = cliAgent.getSessionTitle(sessionId);
              setSessionActivity(sessionId, title ? `${proc} · ${title}` : `Running ${proc}`);
            } else {
              setSessionActivity(sessionId, `Running ${proc}`);
            }
          } else {
            setSessionActivity(sessionId, null);
            cliAgent.clearSessionTitle(sessionId);
          }
        } catch {
        }
      }, 2000);

      entry.cwdPollInterval = cwdPollInterval;
      entry.dataListenerCleanup = removeDataListener;
      entry.initialized = true;

      requestAnimationFrame(() => {
        entry?.fitAddon.fit();
      });
    } else {
      if (containerRef.current && !containerRef.current.querySelector('.xterm')) {
        entry.xterm.open(containerRef.current);
      }
      requestAnimationFrame(() => {
        entry?.fitAddon.fit();
      });
    }
  }, [sessionId, setSessionCwd, setSessionActivity]);

  useEffect(() => {
    if (isVisible) {
      initTerminal();
    }
  }, [isVisible, initTerminal]);

  useEffect(() => {
    if (!isVisible || !sessionId) return;

    const entry = terminals.get(sessionId);
    if (!entry) return;

    const debouncedFit = debounce(() => {
      try {
        entry.fitAddon.fit();
      } catch {
      }
    }, 50);

    window.addEventListener('resize', debouncedFit);

    const observer = new ResizeObserver(debouncedFit);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', debouncedFit);
      observer.disconnect();
    };
  }, [sessionId, isVisible]);

  return (
    <div
      ref={containerRef}
      className="terminal-container"
      style={{ visibility: isVisible ? 'visible' : 'hidden', position: isVisible ? 'relative' : 'absolute' }}
    />
  );
});

TerminalComponent.displayName = 'TerminalComponent';

export function destroyTerminal(sessionId: string) {
  const entry = terminals.get(sessionId);
  if (entry) {
    if (entry.dataListenerCleanup) {
      entry.dataListenerCleanup();
    }
    if (entry.cwdPollInterval) {
      clearInterval(entry.cwdPollInterval);
    }
    entry.xterm.dispose();
    terminals.delete(sessionId);
  }
}
