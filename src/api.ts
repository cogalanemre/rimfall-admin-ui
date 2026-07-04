// Admin backend (hoopdrop-admin-backend, 8091) HTTP istemcisi ve tipler.
// Dev'de Vite 5173'ten mutlak adrese gider; build admin backend'den sunulunca
// aynı origin'e düşer. Ayrı container olarak deploy edilince VITE_API_URL
// build-time env'i ile backend adresi override edilir (bkz. Dockerfile).
const API = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8091" : "");

export type Stats = {
  total_players: number;
  active_players: number;
  banned_players: number;
  total_maps: number;
  total_runs: number;
  runs_today: number;
  total_bug_reports: number;
  total_sessions: number;
  runs_per_day: { day: string; count: number }[];
  generated_at: string;
};

export type Player = {
  id: number;
  email: string;
  name: string;
  provider: string;
  created_at: string;
  banned_at: string | null;
  ban_reason: string | null;
  runs: number;
  best_score: number;
  last_seen: string | null;
  online: boolean;
};

export type BugReport = {
  id: number;
  session_id: string;
  message: string;
  context: Record<string, unknown> | null;
  device: Record<string, unknown> | null;
  recent_logs: LogEntry[] | null;
  created_at: string;
  user_id: number;
  user_email: string;
  user_name: string;
};

export type LogEntry = {
  level: string;
  message: string;
  file: string;
  line: number;
  function: string;
  context?: Record<string, unknown>;
};

export type MapRow = {
  id: number;
  name: string;
  chunks: number;
  created_at: string;
  owner_email: string;
  owner_name: string;
  plays: number;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export const fetchStats = () => get<Stats>("/api/stats");
export const fetchPlayers = (q: string) =>
  get<Player[]>("/api/players" + (q ? `?q=${encodeURIComponent(q)}` : ""));
export const fetchBugReports = () => get<BugReport[]>("/api/bug-reports?limit=200");
export const fetchMaps = () => get<MapRow[]>("/api/maps");

export async function banPlayer(id: number, reason: string): Promise<void> {
  const res = await fetch(`${API}/api/players/${id}/ban`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`ban: HTTP ${res.status}`);
}

export async function unbanPlayer(id: number): Promise<void> {
  const res = await fetch(`${API}/api/players/${id}/unban`, { method: "POST" });
  if (!res.ok) throw new Error(`unban: HTTP ${res.status}`);
}

export const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
