import { useCallback, useState } from "react";
import { deleteMap, fetchMaps, fmtDate, runExportUrl, unpublishMap, type MapRow } from "../api";
import { usePoll } from "../usePoll";

const REFRESH_MS = 15000;

// Harita yönetimi (07-TOPLULUK-HARITALAR "Admin tarafı"): ad/kod/yapımcı
// araması, yayın filtresi, satır detayı (doğrulama koşusu, havuz) ve
// SİL (sebep zorunlu → map_deletions) / YAYINDAN KALDIR (havuz iptali).
export default function Maps() {
  const [q, setQ] = useState("");
  const [published, setPublished] = useState(""); // '' = tümü, 'true', 'false'
  // Filtre istemci tarafında (BugReports deseni): poll turunu beklemeden anında daralır.
  const fetcher = useCallback(() => fetchMaps(), []);
  const { data: all, error, refetch } = usePoll(fetcher, REFRESH_MS);
  const needle = q.trim().toLowerCase();
  const data = all
    ? all.filter(
        (m) =>
          (published === "" || m.published === (published === "true")) &&
          (needle === "" ||
            m.name.toLowerCase().includes(needle) ||
            m.code.toLowerCase().includes(needle) ||
            m.owner_email.toLowerCase().includes(needle) ||
            m.owner_name.toLowerCase().includes(needle))
      )
    : null;
  const [open, setOpen] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MapRow | null>(null);
  const [unpubTarget, setUnpubTarget] = useState<MapRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const doDelete = async (reason: string) => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const res = await deleteMap(deleteTarget.id, reason);
      setActionMsg(`"${res.name}" silindi; sebep map_deletions'a kaydedildi.`);
      setDeleteTarget(null);
      setActionError(null);
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doUnpublish = async () => {
    if (!unpubTarget) return;
    setBusy(true);
    try {
      const res = await unpublishMap(unpubTarget.id);
      setActionMsg(
        `"${unpubTarget.name}" yayından kaldırıldı` +
          (res.pool_cancelled > 0 ? `; ${res.pool_cancelled} Pul havuz iptal edildi.` : ".")
      );
      setUnpubTarget(null);
      setActionError(null);
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Haritalar</h1>
        <div className="filters">
          <select value={published} onChange={(e) => setPublished(e.target.value)}>
            <option value="">Tümü</option>
            <option value="true">Yayında</option>
            <option value="false">Taslak</option>
          </select>
          <input
            type="search"
            className="search"
            placeholder="Ad, kod (RF-XXXXX) veya yapımcı ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {data && <div className="live">{data.length} harita</div>}
        </div>
      </div>

      {error && <div className="error-banner">Sunucuya ulaşılamadı: {error}</div>}
      {actionError && <div className="error-banner">İşlem başarısız: {actionError}</div>}
      {actionMsg && <div className="ok-banner">{actionMsg}</div>}

      {data && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Ad</th>
                <th>Kod</th>
                <th>Yapımcı</th>
                <th>Durum</th>
                <th className="num">Oynanma</th>
                <th className="num">Bitirme</th>
                <th className="num">Havuz</th>
                <th>Oluşturulma</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <Row
                  key={m.id}
                  m={m}
                  open={open === m.id}
                  toggle={() => setOpen(open === m.id ? null : m.id)}
                  busy={busy}
                  onDelete={() => setDeleteTarget(m)}
                  onUnpublish={() => setUnpubTarget(m)}
                />
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={9}>Eşleşen harita yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <DeleteModal
          map={deleteTarget}
          busy={busy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={doDelete}
        />
      )}

      {unpubTarget && (
        <div className="modal-overlay" onClick={() => setUnpubTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Yayından kaldır</h3>
            <p>
              <strong>{unpubTarget.name}</strong> taslağa çekilecek; biriken{" "}
              <strong>{unpubTarget.pool} Pul</strong> havuz iptal edilir (cüzdanlara dokunulmaz,
              iptal transactions'a admin_adj olarak yazılır).
            </p>
            <div className="actions">
              <button onClick={() => setUnpubTarget(null)}>Vazgeç</button>
              <button className="danger" disabled={busy} onClick={doUnpublish}>
                Yayından kaldır
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({
  m,
  open,
  toggle,
  busy,
  onDelete,
  onUnpublish,
}: {
  m: MapRow;
  open: boolean;
  toggle: () => void;
  busy: boolean;
  onDelete: () => void;
  onUnpublish: () => void;
}) {
  return (
    <>
      <tr className="expander" onClick={toggle}>
        <td className="num">{m.id}</td>
        <td className="strong">{m.name}</td>
        <td>{m.code || "—"}</td>
        <td>{m.owner_email ? `${m.owner_name} (${m.owner_email})` : "Misafir"}</td>
        <td>
          {m.published ? (
            <span className="badge solved">yayında</span>
          ) : (
            <span className="badge offline">taslak</span>
          )}
        </td>
        <td className="num">{m.plays}</td>
        <td className="num">{m.finishes}</td>
        <td className="num">{m.pool}</td>
        <td>{fmtDate(m.created_at)}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={9}>
            <div className="report-detail">
              <h4>Detay</h4>
              <p>
                Bölüm sayısı: <strong>{m.chunks}</strong> · Beğeni: <strong>{m.likes}</strong> ·
                Doğrulama koşusu:{" "}
                {m.verified ? (
                  <a className="download" href={runExportUrl(m.verified_run_id)}>
                    #{m.verified_run_id} ⇩
                  </a>
                ) : (
                  <span className="badge open">yok — taslak/eski istemci kaydı</span>
                )}
              </p>
              <div className="actions" style={{ justifyContent: "flex-start", marginTop: 8 }}>
                {m.published && (
                  <button
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnpublish();
                    }}
                  >
                    Yayından kaldır
                  </button>
                )}
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
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DeleteModal({
  map,
  busy,
  onCancel,
  onConfirm,
}: {
  map: MapRow;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const ok = reason.trim() !== "";
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Haritayı sil</h3>
        <p>
          <strong>{map.name}</strong> {map.code ? `(${map.code}) ` : ""}kalıcı olarak silinecek.
          Sebep notu zorunludur; map_deletions denetim kaydına yazılır (yapımcıya girişte
          gösterilecek).
        </p>
        <input
          type="text"
          placeholder="Silme sebebi (zorunlu)"
          value={reason}
          autoFocus
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ok && onConfirm(reason.trim())}
        />
        <div className="actions">
          <button onClick={onCancel}>Vazgeç</button>
          <button className="danger" disabled={busy || !ok} onClick={() => onConfirm(reason.trim())}>
            Sil
          </button>
        </div>
      </div>
    </div>
  );
}
