import { useAppStore } from '../state/store';

// Known TUI agent process names
export const TUI_AGENTS = new Set(['opencode', 'claude', 'cursor', 'aider', 'cline']);

// Extract terminal title set via OSC escape sequences (\x1b]0;title\x07 or \x1b]2;title\x07)
// This is the standard way TUI apps communicate their title to the terminal.
function extractOscTitle(data: string): string | null {
  // Match all OSC title sequences and take the last one (most recent)
  const regex = /\x1b\](?:0|2);([^\x07\x1b]+)(?:\x07|\x1b\\)/g;
  let lastTitle: string | null = null;
  let match;
  while ((match = regex.exec(data)) !== null) {
    const title = match[1].trim();
    // Filter out generic shell titles (paths, shell names, etc.)
    if (title && title.length > 2 && title.length < 120
      && !title.startsWith('/') && !/^(zsh|bash|fish|sh)$/i.test(title)) {
      lastTitle = title;
    }
  }
  return lastTitle;
}

const AGENT_PATTERNS = [
  /^\[opencode\]\s*(.+)/i,
  /^\[claude\]\s*(.+)/i,
  /^\[cursor\]\s*(.+)/i,
  /^\[cline\]\s*(.+)/i,
  /^\[aider\]\s*(.+)/i,
];

const COMMAND_PATTERNS: { pattern: RegExp; activity: string }[] = [
  { pattern: /^git\s+(commit|push|pull|merge|rebase)/i, activity: 'Git operations' },
  { pattern: /^git\s+(status|diff|log|blame)/i, activity: 'Inspecting changes' },
  { pattern: /^git\s+clone/i, activity: 'Cloning repository' },
  { pattern: /^git\s+checkout/i, activity: 'Switching branches' },
  { pattern: /^(npm|yarn|pnpm)\s+(test|run)/i, activity: 'Running scripts' },
  { pattern: /^(npm|yarn|pnpm)\s+install/i, activity: 'Installing dependencies' },
  { pattern: /^(npm|yarn|pnpm)\s+(build|build:|export)/i, activity: 'Building project' },
  { pattern: /^npm\s+dev/i, activity: 'Starting dev server' },
  { pattern: /^make\s+/i, activity: 'Building with make' },
  { pattern: /^cargo\s+build/i, activity: 'Building Rust project' },
  { pattern: /^cargo\s+test/i, activity: 'Running Rust tests' },
  { pattern: /^cargo\s+run/i, activity: 'Running Rust application' },
  { pattern: /^python\s+\w+\.py/i, activity: 'Running Python script' },
  { pattern: /^go\s+run/i, activity: 'Running Go application' },
  { pattern: /^docker\s+(build|run|compose)/i, activity: 'Docker operations' },
  { pattern: /^kubectl\s+/i, activity: 'Kubernetes operations' },
  { pattern: /^terraform\s+/i, activity: 'Terraform operations' },
];

interface SessionActivity {
  buffer: string;
  lastActivity: string | null;
  activityTimeout: ReturnType<typeof setTimeout> | null;
  lastTitle: string | null;
}

class CliAgent {
  private sessionActivities: Map<string, SessionActivity> = new Map();

  private getOrCreateSessionActivity(sessionId: string): SessionActivity {
    let activity = this.sessionActivities.get(sessionId);
    if (!activity) {
      activity = {
        buffer: '',
        lastActivity: null,
        activityTimeout: null,
        lastTitle: null,
      };
      this.sessionActivities.set(sessionId, activity);
    }
    return activity;
  }

  private clearActivityTimeout(sessionId: string) {
    const activity = this.sessionActivities.get(sessionId);
    if (activity?.activityTimeout) {
      clearTimeout(activity.activityTimeout);
      activity.activityTimeout = null;
    }
  }

  private updateActivity(sessionId: string, activity: string) {
    const sessionActivity = this.getOrCreateSessionActivity(sessionId);

    this.clearActivityTimeout(sessionId);

    useAppStore.getState().setSessionActivity(sessionId, activity);
    sessionActivity.lastActivity = activity;

    sessionActivity.activityTimeout = setTimeout(() => {
      useAppStore.getState().setSessionActivity(sessionId, null);
      sessionActivity.lastActivity = null;
    }, 30000);
  }

  private detectActivity(data: string): string | null {
    const lines = data.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      for (const { pattern, activity } of COMMAND_PATTERNS) {
        if (pattern.test(trimmedLine)) {
          return activity;
        }
      }

      for (const pattern of AGENT_PATTERNS) {
        const match = trimmedLine.match(pattern);
        if (match && match[1]) {
          const activityText = match[1].trim();
          if (activityText.length > 0 && activityText.length < 100) {
            return activityText;
          }
        }
      }
    }

    return null;
  }

  public processData(sessionId: string, data: string) {
    const sessionActivity = this.getOrCreateSessionActivity(sessionId);

    // Extract OSC title from raw data (lightweight, no stripping needed)
    const oscTitle = extractOscTitle(data);
    if (oscTitle) {
      sessionActivity.lastTitle = oscTitle;
    }

    // Buffer-based detection for shell command patterns
    sessionActivity.buffer += data;
    if (sessionActivity.buffer.length > 1000) {
      sessionActivity.buffer = sessionActivity.buffer.slice(-500);
    }

    if (data.includes('\n') || sessionActivity.buffer.length > 500) {
      const activity = this.detectActivity(sessionActivity.buffer);
      if (activity && activity !== sessionActivity.lastActivity) {
        this.updateActivity(sessionId, activity);
      }
      sessionActivity.buffer = '';
    }
  }

  public getSessionTitle(sessionId: string): string | null {
    return this.sessionActivities.get(sessionId)?.lastTitle || null;
  }

  public clearSessionTitle(sessionId: string) {
    const activity = this.sessionActivities.get(sessionId);
    if (activity) activity.lastTitle = null;
  }

  public cleanupSession(sessionId: string) {
    this.clearActivityTimeout(sessionId);
    this.sessionActivities.delete(sessionId);
  }
}

export const cliAgent = new CliAgent();
