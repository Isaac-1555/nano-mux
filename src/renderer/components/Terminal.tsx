import React, { useEffect, useRef, useCallback, memo } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

interface TerminalProps {
  sessionId: string;
  isVisible: boolean;
}

const terminals = new Map<string, { xterm: XTerm; fitAddon: FitAddon; initialized: boolean }>();

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  }) as T;
}

export const TerminalComponent: React.FC<TerminalProps> = memo(({ sessionId, isVisible }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

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

      // Create PTY backend
      const home = await window.nanoMux.fs.getHome();
      await window.nanoMux.pty.create(sessionId, home);

      // Connect PTY data to xterm
      const removeDataListener = window.nanoMux.pty.onData(({ id, data }) => {
        if (id === sessionId) {
          entry!.xterm.write(data);
        }
      });

      // Connect xterm input to PTY
      const onDataDisposable = entry.xterm.onData((data: string) => {
        window.nanoMux.pty.write(sessionId, data);
      });

      // Handle resize
      const onResizeDisposable = entry.xterm.onResize(({ cols, rows }) => {
        window.nanoMux.pty.resize(sessionId, cols, rows);
      });

      entry.initialized = true;

      cleanupRef.current = () => {
        removeDataListener();
        onDataDisposable.dispose();
        onResizeDisposable.dispose();
      };

      // Fit after a single animation frame
      requestAnimationFrame(() => {
        entry?.fitAddon.fit();
      });
    } else {
      // Re-attach to DOM if already initialized but not mounted
      if (containerRef.current && !containerRef.current.querySelector('.xterm')) {
        entry.xterm.open(containerRef.current);
      }
    }
  }, [sessionId]);

  // Initialize terminal when visible
  useEffect(() => {
    if (isVisible) {
      initTerminal();
    }
  }, [isVisible, initTerminal]);

  // Handle container resize with debounced fit
  useEffect(() => {
    if (!isVisible || !sessionId) return;

    const entry = terminals.get(sessionId);
    if (!entry) return;

    const debouncedFit = debounce(() => {
      try {
        entry.fitAddon.fit();
      } catch {
        // Ignore fit errors during transitions
      }
    }, 16);

    const observer = new ResizeObserver(debouncedFit);
    observer.observe(containerRef.current!);

    return () => {
      observer.disconnect();
    };
  }, [sessionId, isVisible]);

  // Fit terminal on window resize
  useEffect(() => {
    if (!isVisible || !sessionId) return;

    const entry = terminals.get(sessionId);
    if (!entry) return;

    const debouncedFit = debounce(() => {
      try {
        entry.fitAddon.fit();
      } catch {
        // Ignore
      }
    }, 50);

    window.addEventListener('resize', debouncedFit);
    return () => window.removeEventListener('resize', debouncedFit);
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

// Cleanup terminal when session is destroyed
export function destroyTerminal(sessionId: string) {
  const entry = terminals.get(sessionId);
  if (entry) {
    entry.xterm.dispose();
    terminals.delete(sessionId);
  }
}
