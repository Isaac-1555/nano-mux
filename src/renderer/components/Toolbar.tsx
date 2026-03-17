import React from 'react';
import { useAppStore } from '../state/store';

export const Toolbar: React.FC = () => {
  const { activePanel, togglePanel } = useAppStore();

  return (
    <div className="toolbar">
      <button
        className={`toolbar__btn ${activePanel === 'files' ? 'toolbar__btn--active' : ''}`}
        onClick={() => togglePanel('files')}
        title="File Explorer"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 4h5l2 2h7v10H3V4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        className={`toolbar__btn ${activePanel === 'git' ? 'toolbar__btn--active' : ''}`}
        onClick={() => togglePanel('git')}
        title="Git"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="4" r="2" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="6" cy="16" r="2" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="14" cy="16" r="2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M10 6v4M10 10c0 2-4 4-4 6M10 10c0 2 4 4 4 6" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>
    </div>
  );
};
