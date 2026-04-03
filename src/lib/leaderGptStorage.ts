/**
 * Client-side persistence for LeaderGPT conversations (per tenant slug + user id).
 * Stored in localStorage — device/browser specific, not synced across devices.
 */

export const LEADER_GPT_STORAGE_VERSION = 2 as const;

export interface LeaderGptPersistedSession {
  id: string;
  title: string;
  updatedAt: string;
  /** Serialized message turns (same shape as LeaderQaPanel `MsgTurn[]`). */
  messages: unknown[];
}

export interface LeaderGptPersistedState {
  v: typeof LEADER_GPT_STORAGE_VERSION;
  sessions: LeaderGptPersistedSession[];
  activeSessionId: string;
}

const MAX_SESSIONS = 25;

function storageKey(slug: string, userId: string): string {
  return `leadergpt:v${LEADER_GPT_STORAGE_VERSION}:${slug}:${userId}`;
}

function pruneSessions(sessions: LeaderGptPersistedSession[]): LeaderGptPersistedSession[] {
  if (sessions.length <= MAX_SESSIONS) return sessions;
  const sorted = [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return sorted.slice(0, MAX_SESSIONS);
}

export function loadLeaderGptState(slug: string, userId: string): LeaderGptPersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(slug, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LeaderGptPersistedState;
    if (parsed.v !== LEADER_GPT_STORAGE_VERSION || !Array.isArray(parsed.sessions)) return null;
    const active = parsed.sessions.some((s) => s.id === parsed.activeSessionId)
      ? parsed.activeSessionId
      : parsed.sessions[0]?.id ?? "";
    if (!active) return null;
    return {
      v: LEADER_GPT_STORAGE_VERSION,
      sessions: parsed.sessions.map((s) => ({
        ...s,
        messages: Array.isArray(s.messages) ? s.messages : [],
      })),
      activeSessionId: active,
    };
  } catch {
    return null;
  }
}

export function saveLeaderGptState(slug: string, userId: string, state: LeaderGptPersistedState): void {
  if (typeof window === "undefined") return;
  try {
    const pruned = pruneSessions(state.sessions);
    const activeOk = pruned.some((s) => s.id === state.activeSessionId);
    const activeSessionId = activeOk ? state.activeSessionId : pruned[0]?.id ?? state.activeSessionId;
    const toSave: LeaderGptPersistedState = {
      v: LEADER_GPT_STORAGE_VERSION,
      sessions: pruned,
      activeSessionId,
    };
    window.localStorage.setItem(storageKey(slug, userId), JSON.stringify(toSave));
  } catch {
    /* quota / private mode */
  }
}
