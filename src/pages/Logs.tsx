import { useCallback, useState } from "react";
import { fetchLogs, fmtDate, type ClientLog } from "../api";
import { usePoll } from "../usePoll";

// Hata logları 15 sn'de bir tazelenir.
const REFRESH_MS = 15000;

const LEVELS = [
  { value: "", label: "Tüm seviyeler" },
  { value: "error", label: "error" },
  { value: "script_error", label: "script_error" },
  { value: "shader_error", label: "shader_error" },
  { value: "warning", label: "warning" },
];

export default function Logs() {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [solved, setSolved] = useState(""); // '' = tümü, 'false' = açık, 'true' = çözüldü
  const fetcher = useCallback(() => fetchLogs(q, level, solved), [q, level, solved]);
  const { data, error } = usePoll(fetcher, REFRESH_MS);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <div className="page-head">
        <h1>Hatalar</h1>
        <div className="filters">
          <select value={solved} onChange={(e) => setSolved(e.target.value)}>
            <option value="">Tüm durumlar</option>
            <option value="false">Açık</option>
            <option value="true">Çözüldü</option>
          </select>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <input
            type="search"
            className="search"
            placeholder="Mesaj, dosya veya oyuncu ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="error-banner">Sunucuya ulaşılamadı: {error}</div>}

      {data && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Durum</th>
                <th>Seviye</th>
                <th>Tarih</th>
                <th>Sürüm</th>
                <th>Oyuncu</th>
                <th>Mesaj</th>
                <th>Konum</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={8}>Kayıtlı hata yok. 🎉</td>
                </tr>
              )}
              {data.map((l) => (
                <Row
                  key={l.id}
                  l={l}
                  open={open === l.id}
                  toggle={() => setOpen(open === l.id ? null : l.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Row({ l, open, toggle }: { l: ClientLog; open: boolean; toggle: () => void }) {
  return (
    <>
      <tr className="expander" onClick={toggle}>
        <td className="num">{l.id}</td>
        <td>
          <span className={l.solved ? "badge solved" : "badge open"}>
            {l.solved ? "çözüldü" : "açık"}
          </span>
        </td>
        <td>
          <span className={`badge level-${l.level}`}>{l.level}</span>
        </td>
        <td>{fmtDate(l.created_at)}</td>
        <td>{l.client_version || "—"}</td>
        <td>{l.user_email ? `${l.user_name || "?"} (${l.user_email})` : "Misafir"}</td>
        <td className="strong">{l.message}</td>
        <td>
          {l.file}
          {l.line ? `:${l.line}` : ""}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8}>
            <div className="report-detail">
              {l.solved && l.solved_note && (
                <>
                  <h4>Çözüm notu</h4>
                  <p>{l.solved_note}</p>
                </>
              )}
              <h4>Fonksiyon</h4>
              <code>{l.func_name || "—"}</code>
              <h4>Oturum</h4>
              <code>{l.session_id}</code>
              {l.context && (
                <>
                  <h4>Bağlam (sahne / harita / skor / backtrace)</h4>
                  <pre className="json">{JSON.stringify(l.context, null, 2)}</pre>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
