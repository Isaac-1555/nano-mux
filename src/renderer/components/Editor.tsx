import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { EditorView } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { cpp } from '@codemirror/lang-cpp';
import { lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { useAppStore } from '../state/store';

function getLanguageExtension(filePath: string) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js': case 'jsx': return javascript({ jsx: true });
    case 'ts': case 'tsx': return javascript({ jsx: true, typescript: true });
    case 'json': return json();
    case 'html': return html();
    case 'css': case 'scss': return css();
    case 'md': case 'markdown': return markdown();
    case 'py': return python();
    case 'rs': return rust();
    case 'c': case 'h': case 'cpp': case 'hpp': case 'cc': return cpp();
    default: return javascript();
  }
}

function computeDiff(oldContent: string, newContent: string) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const diffLines: Array<{ type: 'same' | 'added' | 'removed'; content: string; lineNum: number | null; oldLineNum: number | null }> = [];

  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (oldIdx >= oldLines.length) {
      diffLines.push({ type: 'added', content: newLines[newIdx], lineNum: newIdx + 1, oldLineNum: null });
      newIdx++;
    } else if (newIdx >= newLines.length) {
      diffLines.push({ type: 'removed', content: oldLines[oldIdx], lineNum: null, oldLineNum: oldIdx + 1 });
      oldIdx++;
    } else if (oldLines[oldIdx] === newLines[newIdx]) {
      diffLines.push({ type: 'same', content: oldLines[oldIdx], lineNum: newIdx + 1, oldLineNum: oldIdx + 1 });
      oldIdx++;
      newIdx++;
    } else {
      let foundOld = -1;
      let foundNew = -1;
      for (let i = 1; i < 10 && oldIdx + i < oldLines.length; i++) {
        if (oldLines[oldIdx + i] === newLines[newIdx]) { foundOld = i; break; }
      }
      for (let i = 1; i < 10 && newIdx + i < newLines.length; i++) {
        if (newLines[newIdx + i] === oldLines[oldIdx]) { foundNew = i; break; }
      }

      if (foundOld > 0 && (foundNew <= 0 || foundOld <= foundNew)) {
        for (let i = 0; i < foundOld; i++) {
          diffLines.push({ type: 'removed', content: oldLines[oldIdx + i], lineNum: null, oldLineNum: oldIdx + i + 1 });
        }
        oldIdx += foundOld;
      } else if (foundNew > 0) {
        for (let i = 0; i < foundNew; i++) {
          diffLines.push({ type: 'added', content: newLines[newIdx + i], lineNum: newIdx + i + 1, oldLineNum: null });
        }
        newIdx += foundNew;
      } else {
        diffLines.push({ type: 'removed', content: oldLines[oldIdx], lineNum: null, oldLineNum: oldIdx + 1 });
        diffLines.push({ type: 'added', content: newLines[newIdx], lineNum: newIdx + 1, oldLineNum: null });
        oldIdx++;
        newIdx++;
      }
    }
  }

  return diffLines;
}

export const Editor: React.FC = memo(() => {
  const { editor, closeEditor, setEditorMode } = useAppStore();
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const langCompartment = useRef(new Compartment());
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const contentRef = useRef<string>('');
  const savedContentRef = useRef<string>('');

  const { filePath, mode } = editor;

  // Load file content
  useEffect(() => {
    if (!filePath) return;
    setIsLoaded(false);

    const loadFile = async () => {
      const result = await window.nanoMux.fs.readFile(filePath);
      if (result.content !== null) {
        setContent(result.content);
        contentRef.current = result.content;
        savedContentRef.current = result.content;
        setIsDirty(false);
      }

      if (mode === 'diff') {
        const cwd = filePath.substring(0, filePath.lastIndexOf('/'));
        const relativePath = filePath.split('/').pop() || filePath;
        const gitResult = await window.nanoMux.git.fileContent(cwd, relativePath, 'HEAD');
        setOriginalContent(gitResult.content || '');
      }

      setIsLoaded(true);
    };

    loadFile();
  }, [filePath, mode]);

  // Setup CodeMirror editor
  useEffect(() => {
    if (!editorContainerRef.current || !filePath || !isLoaded || mode === 'diff') {
      if (editorViewRef.current) {
        editorViewRef.current.destroy();
        editorViewRef.current = null;
      }
      return;
    }

    // If editor already exists, just update content and language
    if (editorViewRef.current) {
      const currentContent = editorViewRef.current.state.doc.toString();
      if (currentContent !== contentRef.current) {
        editorViewRef.current.dispatch({
          changes: { from: 0, to: currentContent.length, insert: contentRef.current }
        });
      }
      editorViewRef.current.dispatch({
        effects: langCompartment.current.reconfigure(getLanguageExtension(filePath))
      });
      return;
    }

    const langExtension = getLanguageExtension(filePath);

    const state = EditorState.create({
      doc: contentRef.current,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        syntaxHighlighting(defaultHighlightStyle),
        langCompartment.current.of(langExtension),
        oneDark,
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px' },
          '.cm-scroller': { fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', monospace", lineHeight: '1.5' },
          '.cm-gutters': { backgroundColor: '#0d1117', borderRight: '1px solid #21262d' },
          '.cm-activeLineGutter': { backgroundColor: '#161b22' },
          '.cm-activeLine': { backgroundColor: '#161b2266' },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            contentRef.current = newContent;
            setIsDirty(newContent !== savedContentRef.current);
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorContainerRef.current,
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
  }, [filePath, mode, isLoaded]);

  // Compute diff only when content changes
  const diffLines = useMemo(() => {
    if (mode !== 'diff') return null;
    return computeDiff(originalContent, content);
  }, [originalContent, content, mode]);

  const handleSave = useCallback(async () => {
    if (!filePath || isSaving) return;
    setIsSaving(true);
    const currentContent = contentRef.current;
    const result = await window.nanoMux.fs.writeFile(filePath, currentContent);
    if (result.success) {
      setContent(currentContent);
      savedContentRef.current = currentContent;
      setIsDirty(false);
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(null), 2000);
    } else {
      setSaveMessage(`Error: ${result.error}`);
      setTimeout(() => setSaveMessage(null), 3000);
    }
    setIsSaving(false);
  }, [filePath, isSaving]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  if (!filePath) return null;

  const fileName = filePath.split('/').pop() || filePath;

  const renderDiffView = useMemo(() => () => {
    if (!diffLines) return null;
    return (
      <div className="diff-view">
        {diffLines.map((line, idx) => (
          <div key={idx} className={`diff-line diff-line--${line.type}`}>
            <span className="diff-line__gutter diff-line__gutter--old">{line.oldLineNum || ''}</span>
            <span className="diff-line__gutter diff-line__gutter--new">{line.lineNum || ''}</span>
            <span className="diff-line__sign">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            <span className="diff-line__content">{line.content || '\u00A0'}</span>
          </div>
        ))}
      </div>
    );
  }, [diffLines]);

  return (
    <div className="editor">
      <div className="editor__header">
        <div className="editor__tabs">
          <div className="editor__tab editor__tab--active">
            <span className="editor__tab-name">
              {fileName}
              {isDirty && <span className="editor__tab-dirty">*</span>}
            </span>
          </div>
        </div>
        <div className="editor__actions">
          {saveMessage && <span className="editor__save-msg">{saveMessage}</span>}
          <div className="editor__mode-toggle">
            <button
              className={`editor__mode-btn ${mode === 'edit' ? 'editor__mode-btn--active' : ''}`}
              onClick={() => setEditorMode('edit')}
            >
              Edit
            </button>
            <button
              className={`editor__mode-btn ${mode === 'diff' ? 'editor__mode-btn--active' : ''}`}
              onClick={() => setEditorMode('diff')}
            >
              Diff
            </button>
          </div>
          {mode === 'edit' && (
            <button className="editor__save-btn" onClick={handleSave} disabled={isSaving || !isDirty}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M12.5 14H3.5C3.10218 14 2.72064 13.842 2.43934 13.5607C2.15804 13.2794 2 12.8978 2 12.5V3.5C2 3.10218 2.15804 2.72064 2.43934 2.43934C2.72064 2.15804 3.10218 2 3.5 2H10.5L14 5.5V12.5C14 12.8978 13.842 13.2794 13.5607 13.5607C13.2794 13.842 12.8978 14 12.5 14Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M11.5 14V9H4.5V14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4.5 2V5.5H9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button className="editor__close-btn" onClick={closeEditor} title="Close editor">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="editor__body">
        {mode === 'edit' ? (
          <div ref={editorContainerRef} className="editor__codemirror" />
        ) : (
          renderDiffView()
        )}
      </div>
    </div>
  );
});

Editor.displayName = 'Editor';
