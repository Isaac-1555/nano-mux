import React, { useCallback, memo } from 'react';
import { useAppStore, Session } from '../state/store';
import { destroyTerminal } from './Terminal';
import { cliAgent } from '../utils/cliAgent';

function getDirectoryName(cwd: string): string {
  if (!cwd) return '';
  const parts = cwd.split('/');
  return parts[parts.length - 1] || cwd;
}

interface SessionTabProps {
  session: Session;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRemove: (e: React.MouseEvent, id: string) => void;
}

const SessionTab = memo<SessionTabProps>(({ session, isActive, onSelect, onRemove }) => {
  const dirName = getDirectoryName(session.cwd);

  return (
    <div
      className={`session-tab ${isActive ? 'session-tab--active' : ''}`}
      onClick={() => onSelect(session.id)}
    >
      <div className="session-tab__header">
        <div className="session-tab__icon">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 3h12v10H2V3z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4 6l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 10h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <span className="session-tab__name">{session.name}</span>
        <button
          className="session-tab__close"
          onClick={(e) => onRemove(e, session.id)}
          title="Close session"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {session.cwd && (
        <div className="session-tab__cwd">
          Working on {dirName}
        </div>
      )}
      {session.activity && (
        <div className="session-tab__activity">
          {session.activity}
        </div>
      )}
    </div>
  );
});

SessionTab.displayName = 'SessionTab';

export const SessionTabs: React.FC = () => {
  const { sessions, activeSessionId, addSession, removeSession, setActiveSession } = useAppStore();

  const handleAddSession = useCallback(() => {
    addSession();
  }, [addSession]);

  const handleRemoveSession = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    destroyTerminal(id);
    window.nanoMux.pty.destroy(id);
    cliAgent.cleanupSession(id);
    removeSession(id);
  }, [removeSession]);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSession(id);
  }, [setActiveSession]);

  return (
    <div className="session-tabs">
      <button className="session-tabs__add" onClick={handleAddSession} title="New session">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div className="session-tabs__list">
        {sessions.map(session => (
          <SessionTab
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
            onSelect={handleSelectSession}
            onRemove={handleRemoveSession}
          />
        ))}
      </div>
    </div>
  );
};
