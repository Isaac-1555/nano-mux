import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../state/store';
import { TerminalComponent } from './Terminal';
import { Editor } from './Editor';

export const Workspace: React.FC = () => {
  const { sessions, activeSessionId, editor, setSplitRatio } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsResizing(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = (moveEvent.clientX - rect.left) / rect.width;
      setSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [setSplitRatio]);

  const terminalWidth = editor.isOpen ? `${editor.splitRatio * 100}%` : '100%';
  const editorWidth = editor.isOpen ? `${(1 - editor.splitRatio) * 100}%` : '0%';

  return (
    <div
      ref={containerRef}
      className={`workspace ${isResizing ? 'workspace--resizing' : ''}`}
    >
      <div className="workspace__terminal" style={{ width: terminalWidth }}>
        {sessions.map(session => (
          <TerminalComponent
            key={session.id}
            sessionId={session.id}
            isVisible={session.id === activeSessionId}
          />
        ))}
      </div>

      {editor.isOpen && (
        <>
          <div
            className="workspace__divider"
            onMouseDown={handleMouseDown}
          >
            <div className="workspace__divider-handle" />
          </div>
          <div className="workspace__editor" style={{ width: editorWidth }}>
            <Editor />
          </div>
        </>
      )}
    </div>
  );
};
