import { useCallback, useEffect, useState } from "react";
import { fetchBugReports, fmtDate, type BugReport } from "../api";
import { SoftDeleteModal, useSoftDelete } from "../SoftDelete";
import { usePoll } from "../usePoll";

const REFRESH_MS = 15000;

export default function BugReports() {
  const [deleted, setDeleted] = useState(""); // '' = kayıtlar, 'true' = silinenler
  const fetcher = useCallback(() => fetchBugReports(deleted), [deleted]);
  const { data, error, refetch } = usePoll(fetcher, REFRESH_MS);
  // Görünüm değişince poll turunu bekleme (usePoll fetcher değişimini izlemez).
  useEffect(() => {
    refetch();
  }, [deleted, refetch]);
  const sil = useSoftDelete("bug-reports", refetch);
  const [open, setOpen] = useState<number | null>(null);
  const [durum, setDurum] = useState(""); // '' = tümü, 'acik', 'cozuldu'
  const inDeleted = deleted === "true";

  const rows = (data ?? []).filter((r) =>
    durum === "" ? true : durum === "acik" ? !r.solved : r.solved
  );

  return (
    <>
      <div className="page-head">
        <h1>Bug Raporları</h1>
        <div className="filters">
          <select value={deleted} onChange={(e) => setDeleted(e.target.value)}>
            <option value="">Kayıtlar</option>
            <option value="true">Silinenler</option>
          </select>
          <select value={durum} onChange={(e) => setDurum(e.target.value)}>
            <option value="">Tüm durumlar</option>
            <option value="acik">Açık</option>
            <option value="cozuldu">Çözüldü</option>
          </select>
          {data && <div className="live">{rows.length} rapor</div>}
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
                <th>Tarih</th>
                <th>Sürüm</th>
                <th>Oyuncu</th>
                <th>Oyun</th>
                <th>Mesaj</th>
                <th>Cihaz</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Row
                  key={r.id}
                  r={r}
                  open={open === r.id}
                  toggle={() => setOpen(open === r.id ? null : r.id)}
                  busy={sil.busy}
                  onDelete={() => sil.setTarget({ id: r.id, label: `#${r.id} raporu` })}
                  onRestore={() => sil.doRestore(r.id, `#${r.id} raporu`)}
                />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    {inDeleted
                      ? "Silinmiş rapor yok."
                      : durum === ""
                        ? "Henüz bug raporu yok."
                        : "Bu durumda rapor yok."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {sil.target && (
        <SoftDeleteModal
          title="Bug raporunu sil"
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
  r,
  open,
  toggle,
  busy,
  onDelete,
  onRestore,
}: {
  r: BugReport;
  open: boolean;
  toggle: () => void;
  busy: boolean;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const device = r.device ?? {};
  const deviceLine = [device["os"], device["model"]].filter(Boolean).join(" · ") || "—";
  return (
    <>
      <tr className="expander" onClick={toggle}>
        <td className="num">{r.id}</td>
        <td>
          <span className={r.solved ? "badge solved" : "badge open"}>
            {r.solved ? "çözüldü" : "açık"}
          </span>
        </td>
        <td>{fmtDate(r.created_at)}</td>
        <td>{r.client_version || "—"}</td>
        <td>{r.user_email ? `${r.user_name} (${r.user_email})` : "Misafir"}</td>
        <td className="num strong">{r.run_id > 0 ? `#${r.run_id}` : "—"}</td>
        <td className="strong">{r.message}</td>
        <td>{String(deviceLine)}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8}>
            <div className="report-detail">
              {r.deleted_at && (
                <>
                  <h4>Silinme</h4>
                  <p>
                    {fmtDate(r.deleted_at)}
                    {r.delete_reason ? ` — ${r.delete_reason}` : ""}
                  </p>
                </>
              )}
              {r.solved && r.solved_note && (
                <>
                  <h4>Çözüm notu</h4>
                  <p>{r.solved_note}</p>
                </>
              )}
              <h4>Oturum</h4>
              <code>{r.session_id}</code>
              {r.context && (
                <>
                  <h4>Bağlam (sahne / harita / skor)</h4>
                  <pre className="json">{JSON.stringify(r.context, null, 2)}</pre>
                </>
              )}
              {r.device && (
                <>
                  <h4>Cihaz</h4>
                  <pre className="json">{JSON.stringify(r.device, null, 2)}</pre>
                </>
              )}
              <h4>Son loglar</h4>
              {r.recent_logs && r.recent_logs.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Seviye</th>
                      <th>Mesaj</th>
                      <th>Konum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.recent_logs.map((l, i) => (
                      <tr key={i}>
                        <td>
                          <span className={`badge level-${l.level}`}>{l.level}</span>
                        </td>
                        <td>{l.message}</td>
                        <td>
                          {l.file}
                          {l.line ? `:${l.line}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>Rapor öncesinde log kaydı yok.</p>
              )}
              <div className="actions" style={{ justifyContent: "flex-start", marginTop: 8 }}>
                {r.deleted_at ? (
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
