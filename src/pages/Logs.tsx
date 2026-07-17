import { useCallback, useEffect, useState } from "react";
import { fetchLogs, fmtDate, type ClientLog } from "../api";
import { SoftDeleteModal, useSoftDelete } from "../SoftDelete";
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
  const [deleted, setDeleted] = useState(""); // '' = kayıtlar, 'true' = silinenler
  const fetcher = useCallback(
    () => fetchLogs(q, level, solved, deleted),
    [q, level, solved, deleted]
  );
  const { data, error, refetch } = usePoll(fetcher, REFRESH_MS);
  // Görünüm değişince poll turunu bekleme (usePoll fetcher değişimini izlemez).
  useEffect(() => {
    refetch();
  }, [deleted, refetch]);
  const sil = useSoftDelete("logs", refetch);
  const [open, setOpen] = useState<number | null>(null);
  const inDeleted = deleted === "true";

  return (
    <>
      <div className="page-head">
        <h1>Hatalar</h1>
        <div className="filters">
          <select value={deleted} onChange={(e) => setDeleted(e.target.value)}>
            <option value="">Kayıtlar</option>
            <option value="true">Silinenler</option>
          </select>
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
      {sil.error && <div className="error-banner">İşlem başarısız: {sil.error}</div>}
      {sil.msg && <div className="ok-banner">{sil.msg}</div>}

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
                  <td colSpan={8}>{inDeleted ? "Silinmiş log yok." : "Kayıtlı hata yok. 🎉"}</td>
                </tr>
              )}
              {data.map((l) => (
                <Row
                  key={l.id}
                  l={l}
                  open={open === l.id}
                  toggle={() => setOpen(open === l.id ? null : l.id)}
                  busy={sil.busy}
                  onDelete={() => sil.setTarget({ id: l.id, label: `#${l.id} logu` })}
                  onRestore={() => sil.doRestore(l.id, `#${l.id} logu`)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sil.target && (
        <SoftDeleteModal
          title="Hata logunu sil"
          subject={sil.target.label}
          busy={sil.busy}
          onCancel={() => sil.setTarget(null)}
          onConfirm={sil.doDelete}
        />
      )}
    </>
  );
}

function Row({
  l,
  open,
  toggle,
  busy,
  onDelete,
  onRestore,
}: {
  l: ClientLog;
  open: boolean;
  toggle: () => void;
  busy: boolean;
  onDelete: () => void;
  onRestore: () => void;
}) {
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
              {l.deleted_at && (
                <>
                  <h4>Silinme</h4>
                  <p>
                    {fmtDate(l.deleted_at)}
                    {l.delete_reason ? ` — ${l.delete_reason}` : ""}
                  </p>
                </>
              )}
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
              <div className="actions" style={{ justifyContent: "flex-start", marginTop: 8 }}>
                {l.deleted_at ? (
                  <button
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore();
                    }}
                  >
                    Geri al
                  </button>
                ) : (
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    Sil
                  </button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
