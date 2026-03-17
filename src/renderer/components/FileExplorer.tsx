import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useAppStore } from '../state/store';

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface TreeNode extends FileEntry {
  children?: TreeNode[];
  isExpanded?: boolean;
}

// Pre-computed icon components to avoid re-creating SVGs
const FolderIcon: React.FC<{ open?: boolean }> = memo(({ open }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M2 4h4l2 2h6v8H2V4z" stroke="#e6b450" strokeWidth="1.2" fill={open ? '#e6b45033' : 'none'} strokeLinejoin="round" />
  </svg>
));
FolderIcon.displayName = 'FolderIcon';

const FileIcon: React.FC<{ color: string }> = memo(({ color }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M4 2h5l3 3v9H4V2z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M9 2v3h3" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
));
FileIcon.displayName = 'FileIcon';

const ChevronIcon = memo(() => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
));
ChevronIcon.displayName = 'ChevronIcon';

const OpenFolderIcon = memo(() => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M2 4h4l2 2h6v8H2V4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M7 8l2-2 2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
));
OpenFolderIcon.displayName = 'OpenFolderIcon';

// Color cache for file extensions
const extensionColors: Record<string, string> = {
  ts: '#3178c6', tsx: '#3178c6',
  js: '#f1e05a', jsx: '#f1e05a',
  json: '#a8e6cf',
  css: '#c76dba', scss: '#c76dba',
  md: '#519aba',
  py: '#3572a5',
  rs: '#dea584',
  html: '#e44d26',
};

function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return extensionColors[ext] || '#8b949e';
}

interface FileTreeItemProps {
  node: TreeNode;
  depth: number;
  onToggle: (path: string) => void;
  onFileClick: (path: string) => void;
  onFolderOpen: (path: string) => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = memo(({ node, depth, onToggle, onFileClick, onFolderOpen }) => {
  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      onToggle(node.path);
    } else {
      onFileClick(node.path);
    }
  }, [node.isDirectory, node.path, onToggle, onFileClick]);

  const handleDoubleClick = useCallback(() => {
    if (node.isDirectory) {
      onFolderOpen(node.path);
    }
  }, [node.isDirectory, node.path, onFolderOpen]);

  const fileColor = useMemo(() => getFileColor(node.name), [node.name]);

  return (
    <div>
      <div
        className="file-tree-item"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {node.isDirectory ? (
          <span className={`file-tree-item__chevron ${node.isExpanded ? 'file-tree-item__chevron--open' : ''}`}>
            <ChevronIcon />
          </span>
        ) : (
          <span className="file-tree-item__spacer" />
        )}
        <span className="file-tree-item__icon">
          {node.isDirectory ? <FolderIcon open={node.isExpanded} /> : <FileIcon color={fileColor} />}
        </span>
        <span className="file-tree-item__name">{node.name}</span>
      </div>
      {node.isDirectory && node.isExpanded && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onToggle={onToggle}
              onFileClick={onFileClick}
              onFolderOpen={onFolderOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
});

FileTreeItem.displayName = 'FileTreeItem';

export const FileExplorer: React.FC = memo(() => {
  const { activeSessionId, sessions, openFile, rootDirectory, setRootDirectory, setSessionCwd } = useAppStore();
  const [rootPath, setRootPath] = useState<string>('');
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [childrenCache] = useState<Map<string, TreeNode[]>>(new Map());

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Load root directory
  useEffect(() => {
    const loadRoot = async () => {
      const cwd = rootDirectory || activeSession?.cwd || await window.nanoMux.fs.getHome();
      setRootPath(cwd);
      const entries = await window.nanoMux.fs.readDir(cwd);
      setTree(entries.map(e => ({ ...e, children: undefined, isExpanded: false })));
      setExpandedPaths(new Set());
      childrenCache.clear();
    };
    loadRoot();
  }, [rootDirectory, activeSessionId, activeSession?.cwd]);

  // Open directory dialog
  const handleOpenDirectory = useCallback(async () => {
    const dirPath = await window.nanoMux.dialog.openDirectory();
    if (dirPath) {
      setRootDirectory(dirPath);
      const sessionId = activeSessionId;
      if (sessionId) {
        await window.nanoMux.pty.write(sessionId, `cd "${dirPath}"\n`);
        setSessionCwd(sessionId, dirPath);
      }
    }
  }, [setRootDirectory, activeSessionId, setSessionCwd]);

  // Global keyboard shortcut Ctrl+O / Cmd+O
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'o') {
        e.preventDefault();
        handleOpenDirectory();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenDirectory]);

  const loadChildren = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
    if (childrenCache.has(dirPath)) {
      return childrenCache.get(dirPath)!;
    }
    const entries = await window.nanoMux.fs.readDir(dirPath);
    const children = entries.map(e => ({ ...e, children: undefined, isExpanded: false }));
    childrenCache.set(dirPath, children);
    return children;
  }, [childrenCache]);

  const updateTreeNode = useCallback((nodes: TreeNode[], targetPath: string, updater: (node: TreeNode) => TreeNode): TreeNode[] => {
    return nodes.map(node => {
      if (node.path === targetPath) return updater(node);
      if (node.children) return { ...node, children: updateTreeNode(node.children, targetPath, updater) };
      return node;
    });
  }, []);

  const handleToggle = useCallback(async (dirPath: string) => {
    const isExpanded = expandedPaths.has(dirPath);
    if (isExpanded) {
      setExpandedPaths(prev => { const next = new Set(prev); next.delete(dirPath); return next; });
      setTree(prev => updateTreeNode(prev, dirPath, node => ({ ...node, isExpanded: false })));
    } else {
      const children = await loadChildren(dirPath);
      setExpandedPaths(prev => new Set(prev).add(dirPath));
      setTree(prev => updateTreeNode(prev, dirPath, node => ({ ...node, isExpanded: true, children })));
    }
  }, [expandedPaths, loadChildren, updateTreeNode]);

  const handleFileClick = useCallback((filePath: string) => {
    openFile(filePath, 'edit');
  }, [openFile]);

  const handleFolderOpen = useCallback(async (dirPath: string) => {
    const sessionId = activeSessionId;
    if (sessionId) {
      await window.nanoMux.pty.write(sessionId, `cd "${dirPath}"\n`);
      setSessionCwd(sessionId, dirPath);
    }
  }, [activeSessionId, setSessionCwd]);

  const pathParts = rootPath.split('/').filter(Boolean);
  const displayPath = pathParts.length > 2 ? '.../' + pathParts.slice(-2).join('/') : rootPath;

  const treeContent = useMemo(() => (
    tree.map(node => (
      <FileTreeItem
        key={node.path}
        node={node}
        depth={0}
        onToggle={handleToggle}
        onFileClick={handleFileClick}
        onFolderOpen={handleFolderOpen}
      />
    ))
  ), [tree, handleToggle, handleFileClick, handleFolderOpen]);

  return (
    <div className="panel file-explorer">
      <div className="panel__header">
        <span className="panel__title">Explorer</span>
        <span className="panel__subtitle" title={rootPath}>{displayPath}</span>
        <button className="panel__action" onClick={handleOpenDirectory} title="Open Folder (Ctrl+O / Cmd+O)">
          <OpenFolderIcon />
        </button>
      </div>
      <div className="panel__content">
        {treeContent}
      </div>
    </div>
  );
});

FileExplorer.displayName = 'FileExplorer';
