// Admin backend (rimfall-admin-backend, 8096) HTTP istemcisi ve tipler.
// Dev'de Vite 5173'ten mutlak adrese gider; build admin backend'den sunulunca
// aynı origin'e düşer. Ayrı container olarak deploy edilince VITE_API_URL
// build-time env'i ile backend adresi override edilir (bkz. Dockerfile).
const API = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8096" : "");

export type Stats = {
  total_players: number;
  active_players: number;
  banned_players: number;
  total_maps: number;
  total_runs: number;
  runs_today: number;
  open_bug_reports: number; // çözülmemiş bug raporları
  open_errors: number; // çözülmemiş hata logları (warning hariç)
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
  run_id: number;
  client_version: string; // bug hangi oyun sürümünde yaşandı ('' = eski kayıt)
  solved: boolean;
  solved_note: string;
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
  code: string; // paylaşılabilir kısa kod (RF-XXXXX), '' = eski harita
  chunks: number;
  created_at: string;
  owner_email: string;
  owner_name: string;
  published: boolean;
  plays: number;
  finishes: number;
  likes: number;
  pool: number; // biriken ödül havuzu (Pul)
  verified: boolean; // yapımcı doğrulama koşusu var mı
  verified_run_id: number; // 0 = yok
};

export type ClientLog = {
  id: number;
  session_id: string;
  level: string;
  message: string;
  file: string;
  line: number;
  func_name: string;
  context: Record<string, unknown> | null;
  created_at: string;
  user_email: string;
  user_name: string;
  client_version: string;
  solved: boolean;
  solved_note: string;
};

export type RunRow = {
  id: number;
  map_name: string;
  map_kind: string;
  score: number;
  outcome: string;
  started_at: string;
  ended_at: string;
  user_id: number;
  user_email: string;
  user_name: string;
};

// --- Ekonomi config ---
export type EconomyConfig = {
  version: number;
  updated_at: string;
  config: Record<string, unknown>;
};

export type EconHistoryEntry = {
  id: number;
  admin: string;
  old_json: Record<string, unknown>;
  new_json: Record<string, unknown>;
  created_at: string;
};

// --- Haftalık modlar ---
export type WeekRow = {
  week_id: string;
  created_at: string;
  closed_at: string | null;
  speed_count: number;
  long_count: number;
  first_count: number;
  total_prize: number;
};

export type WeeklyRunRow = {
  user_id: number;
  user_email: string;
  user_name: string;
  score: number; // speed: time_ms, long: derinlik, first: bitirme sırası
  run_id: number;
  created_at: string;
  duration_ms: number; // koşu kaydının gerçek süresi (çapraz kontrol)
  taps: number;
  flagged: boolean;
  flag_note: string;
};

export type WeeklyResultRow = {
  mode: string;
  rank: number;
  prize: number;
  user_id: number;
  user_email: string;
  user_name: string;
};

// --- Cüzdan ---
export type TxRow = {
  id: number;
  delta: number;
  reason: string;
  ref_id: string;
  created_at: string;
};

export type WalletInfo = { balance: number; transactions: TxRow[] };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

// Yazma istekleri: hata gövdesindeki sunucu mesajını (düz metin veya
// {"error":...}) olduğu gibi yüzeye çıkarır (ör. 409 "hafta zaten kapatıldı").
async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.trim();
    try {
      const j = JSON.parse(text);
      if (j && typeof j.error === "string") msg = j.error;
    } catch {
      /* düz metin hata */
    }
    throw new Error(msg || `${path}: HTTP ${res.status}`);
  }
  return JSON.parse(text) as T;
}

export const fetchStats = () => get<Stats>("/api/stats");
export const fetchPlayers = (q: string) =>
  get<Player[]>("/api/players" + (q ? `?q=${encodeURIComponent(q)}` : ""));
export const fetchBugReports = () => get<BugReport[]>("/api/bug-reports?limit=200");
export const fetchMaps = (q = "", published = "") => {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (published) p.set("published", published);
  const qs = p.toString();
  return get<MapRow[]>("/api/maps" + (qs ? `?${qs}` : ""));
};
export const fetchRuns = (q: string) =>
  get<RunRow[]>("/api/runs?limit=200" + (q ? `&q=${encodeURIComponent(q)}` : ""));
export const fetchLogs = (q: string, level: string, solved: string) =>
  get<ClientLog[]>(
    "/api/logs?limit=200" +
      (q ? `&q=${encodeURIComponent(q)}` : "") +
      (level ? `&level=${encodeURIComponent(level)}` : "") +
      (solved ? `&solved=${solved}` : "")
  );
// İndirme fetch ile değil doğrudan <a href> ile yapılır (attachment olarak iner).
export const runExportUrl = (id: number) => `${API}/api/runs/${id}/export`;

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

// --- Ekonomi ---
export const fetchEconomyConfig = () => get<EconomyConfig>("/api/economy/config");
export const saveEconomyConfig = (config: Record<string, unknown>) =>
  send<{ version: number }>("PUT", "/api/economy/config", { config });
export const fetchEconHistory = () => get<EconHistoryEntry[]>("/api/economy/history?limit=50");

// --- Harita yönetimi ---
export const deleteMap = (id: number, reason: string) =>
  send<{ deleted: boolean; name: string }>("POST", `/api/maps/${id}/delete`, { reason });
export const unpublishMap = (id: number) =>
  send<{ published: boolean; pool_cancelled: number }>("POST", `/api/maps/${id}/unpublish`);

// --- Haftalık modlar ---
export const fetchWeeks = () => get<WeekRow[]>("/api/weekly/weeks");
export const fetchWeeklyRuns = (weekId: string, mode: string) =>
  get<WeeklyRunRow[]>(
    `/api/weekly/runs?week_id=${encodeURIComponent(weekId)}&mode=${encodeURIComponent(mode)}`
  );
export const fetchWeeklyResults = (weekId: string) =>
  get<WeeklyResultRow[]>(`/api/weekly/results?week_id=${encodeURIComponent(weekId)}`);
export const flagWeeklyRun = (weekId: string, mode: string, userId: number, note: string) =>
  send<{ flagged: boolean }>("POST", "/api/weekly/flag", {
    week_id: weekId,
    mode,
    user_id: userId,
    note,
  });
export const closeWeek = (weekId: string) =>
  send<{ week_id: string; closed: boolean; prizes_paid: number; finish_paid: number }>(
    "POST",
    "/api/weekly/close",
    { week_id: weekId }
  );

// --- Cüzdan ---
export const fetchWallet = (playerId: number) =>
  get<WalletInfo>(`/api/players/${playerId}/wallet`);
export const adjustWallet = (playerId: number, amount: number, reason: string) =>
  send<{ balance: number }>("POST", `/api/players/${playerId}/adjust`, { amount, reason });

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
