import React, { useEffect } from 'react';
import { useAppStore } from '../state/store';
import { SessionTabs } from './SessionTabs';
import { Toolbar } from './Toolbar';
import { FileExplorer } from './FileExplorer';
import { GitPanel } from './GitPanel';
import { Workspace } from './Workspace';

export const App: React.FC = () => {
  const { sessions, addSession, activePanel } = useAppStore();

  useEffect(() => {
    if (sessions.length === 0) {
      addSession();
    }
  }, []);

  return (
    <div className="app">
      <div className="app-titlebar" />
      <div className="app-body">
        <SessionTabs />
        <Toolbar />
        {activePanel === 'files' && <FileExplorer />}
        {activePanel === 'git' && <GitPanel />}
        <Workspace />
      </div>
    </div>
  );
};
