import React, { useEffect, useCallback } from 'react';
import { useAppStore } from '../state/store';

export const GitPanel: React.FC = () => {
  const { activeSessionId, sessions, gitStatus, setGitStatus, openFile } = useAppStore();
  const activeSession = sessions.find(s => s.id === activeSessionId);

  const refreshStatus = useCallback(async () => {
    if (!activeSession?.cwd) {
      const home = await window.nanoMux.fs.getHome();
      const status = await window.nanoMux.git.status(home);
      setGitStatus(status);
    } else {
      const status = await window.nanoMux.git.status(activeSession.cwd);
      setGitStatus(status);
    }
  }, [activeSession?.cwd, setGitStatus]);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const handleFileClick = useCallback((filePath: string) => {
    const cwd = activeSession?.cwd || '';
    const fullPath = filePath.startsWith('/') ? filePath : `${cwd}/${filePath}`;
    openFile(fullPath, 'diff');
  }, [activeSession?.cwd, openFile]);

  const getStatusIcon = (index: string, workingDir: string) => {
    if (index === '?' || workingDir === '?') return { label: 'U', className: 'git-status--untracked' };
    if (index === 'A') return { label: 'A', className: 'git-status--added' };
    if (index === 'M' || workingDir === 'M') return { label: 'M', className: 'git-status--modified' };
    if (index === 'D' || workingDir === 'D') return { label: 'D', className: 'git-status--deleted' };
    if (index === 'R') return { label: 'R', className: 'git-status--renamed' };
    return { label: '?', className: 'git-status--unknown' };
  };

  if (!gitStatus) {
    return (
      <div className="panel git-panel">
        <div className="panel__header">
          <span className="panel__title">Git</span>
        </div>
        <div className="panel__content panel__content--empty">
          Loading...
        </div>
      </div>
    );
  }

  if (!gitStatus.isRepo) {
    return (
      <div className="panel git-panel">
        <div className="panel__header">
          <span className="panel__title">Git</span>
        </div>
        <div className="panel__content panel__content--empty">
          <svg width="32" height="32" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.3, marginBottom: 8 }}>
            <circle cx="10" cy="4" r="2" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="6" cy="16" r="2" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="14" cy="16" r="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M10 6v4M10 10c0 2-4 4-4 6M10 10c0 2 4 4 4 6" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          <span>Not a Git repository</span>
        </div>
      </div>
    );
  }

  const stagedFiles = gitStatus.files.filter(f => f.index !== ' ' && f.index !== '?');
  const changedFiles = gitStatus.files.filter(f => f.working_dir !== ' ' || f.index === '?');

  return (
    <div className="panel git-panel">
      <div className="panel__header">
        <span className="panel__title">Git</span>
        <button className="panel__action" onClick={refreshStatus} title="Refresh">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11.5 2.5A5.5 5.5 0 1 0 13 7h-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11.5 0v2.5H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="panel__content">
        <div className="git-branch">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="5" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="11" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5 5.5v5M5 7c0 0 0-1 2-1h2.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          <span className="git-branch__name">{gitStatus.branch}</span>
          {(gitStatus.ahead !== undefined && gitStatus.ahead > 0) && (
            <span className="git-branch__badge git-branch__badge--ahead">+{gitStatus.ahead}</span>
          )}
          {(gitStatus.behind !== undefined && gitStatus.behind > 0) && (
            <span className="git-branch__badge git-branch__badge--behind">-{gitStatus.behind}</span>
          )}
        </div>

        {stagedFiles.length > 0 && (
          <div className="git-section">
            <div className="git-section__header">Staged ({stagedFiles.length})</div>
            {stagedFiles.map(file => {
              const status = getStatusIcon(file.index, file.working_dir);
              return (
                <div
                  key={`staged-${file.path}`}
                  className="git-file"
                  onClick={() => handleFileClick(file.path)}
                >
                  <span className={`git-file__status ${status.className}`}>{status.label}</span>
                  <span className="git-file__name" title={file.path}>
                    {file.path.split('/').pop()}
                  </span>
                  <span className="git-file__path" title={file.path}>
                    {file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {changedFiles.length > 0 && (
          <div className="git-section">
            <div className="git-section__header">Changes ({changedFiles.length})</div>
            {changedFiles.map(file => {
              const status = getStatusIcon(file.index, file.working_dir);
              return (
                <div
                  key={`changed-${file.path}`}
                  className="git-file"
                  onClick={() => handleFileClick(file.path)}
                >
                  <span className={`git-file__status ${status.className}`}>{status.label}</span>
                  <span className="git-file__name" title={file.path}>
                    {file.path.split('/').pop()}
                  </span>
                  <span className="git-file__path" title={file.path}>
                    {file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {stagedFiles.length === 0 && changedFiles.length === 0 && (
          <div className="panel__content--empty" style={{ padding: '24px 16px' }}>
            <span style={{ opacity: 0.5 }}>Working tree clean</span>
          </div>
        )}
      </div>
    </div>
  );
};
