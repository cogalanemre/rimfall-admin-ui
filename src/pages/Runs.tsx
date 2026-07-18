import { useCallback, useEffect, useState } from "react";
import { fetchRuns, fmtDate, runExportUrl, type RunRow } from "../api";
import {
  BulkActions,
  SelectAllTh,
  SelectTd,
  SoftDeleteModal,
  useSoftDelete,
} from "../SoftDelete";
import { usePoll } from "../usePoll";

// Koşu listesi 10 sn'de bir tazelenir.
const REFRESH_MS = 10000;

// Koşu süresi saniye cinsinden (started_at → ended_at).
function durationSec(r: RunRow): number {
  return Math.max(0, Math.round((+new Date(r.ended_at) - +new Date(r.started_at)) / 1000));
}

export default function Runs() {
  const [q, setQ] = useState("");
  const [deleted, setDeleted] = useState(""); // '' = kayıtlar, 'true' = silinenler
  const fetcher = useCallback(() => fetchRuns(q, deleted), [q, deleted]);
  const { data, error, refetch } = usePoll(fetcher, REFRESH_MS);
  const sil = useSoftDelete("runs", refetch);
  // Görünüm değişince poll turunu bekleme (usePoll fetcher değişimini izlemez);
  // önceki görünümün seçimi de anlamını yitirir.
  const { clearSelection } = sil;
  useEffect(() => {
    clearSelection();
    refetch();
  }, [deleted, refetch, clearSelection]);
  const inDeleted = deleted === "true";
  const visibleIds = (data ?? []).map((r) => r.id);

  return (
    <>
      <div className="page-head">
        <h1>Oyunlar</h1>
        <div className="filters">
          <BulkActions sil={sil} inDeleted={inDeleted} />
          <select value={deleted} onChange={(e) => setDeleted(e.target.value)}>
            <option value="">Kayıtlar</option>
            <option value="true">Silinenler</option>
          </select>
          <input
            type="search"
            className="search"
            placeholder="Oyuncu, harita veya ID ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <p className="hint">
        Bir koşuyu oyunda izlemek için: oyunda <strong>REPLAY</strong> ekranına gir, buradaki{" "}
        <strong>ID</strong>'yi yaz. İNDİR ise aynı verinin (bölümler + dokunuş tick'leri) JSON
        arşivini verir.
      </p>

      {error && <div className="error-banner">Sunucuya ulaşılamadı: {error}</div>}
      {sil.error && <div className="error-banner">İşlem başarısız: {sil.error}</div>}
      {sil.msg && <div className="ok-banner">{sil.msg}</div>}

      {data && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <SelectAllTh sil={sil} visibleIds={visibleIds} />
                <th className="num">ID</th>
                <th>Oyuncu</th>
                <th>Harita</th>
                <th>Tür</th>
                <th className="num">Skor</th>
                <th>Sonuç</th>
                <th className="num">Süre</th>
                <th>Tarih</th>
                {inDeleted && <th>Silinme</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={inDeleted ? 11 : 10}>
                    {inDeleted ? "Silinmiş koşu yok." : "Koşu bulunamadı."}
                  </td>
                </tr>
              )}
              {data.map((r) => (
                <tr key={r.id}>
                  <SelectTd sil={sil} id={r.id} />
                  <td className="num strong">#{r.id}</td>
                  <td>{r.user_email ? `${r.user_name || "?"} (${r.user_email})` : "Misafir"}</td>
                  <td className="strong">{r.map_name}</td>
                  <td>{r.map_kind === "endless" ? "Sonsuz" : "Harita"}</td>
                  <td className="num strong">{r.score}</td>
                  <td>
                    {r.outcome === "win" ? (
                      <span className="badge online">
                        <span className="dot" />
                        Bitirdi
                      </span>
                    ) : (
                      <span className="badge banned">Öldü</span>
                    )}
                  </td>
                  <td className="num">{durationSec(r)} sn</td>
                  <td>{fmtDate(r.started_at)}</td>
                  {inDeleted && (
                    <td>
                      {fmtDate(r.deleted_at)}
                      {r.delete_reason ? ` — ${r.delete_reason}` : ""}
                    </td>
                  )}
                  <td>
                    <a className="download" href={runExportUrl(r.id)} download>
                      İNDİR
                    </a>{" "}
                    {inDeleted ? (
                      <button
                        disabled={sil.busy}
                        onClick={() => sil.doRestore(r.id, `#${r.id} koşusu`)}
                      >
                        Geri al
                      </button>
                    ) : (
                      <button
                        className="danger"
                        disabled={sil.busy}
                        onClick={() => sil.setTarget({ id: r.id, label: `#${r.id} koşusu` })}
                      >
                        Sil
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sil.target && (
        <SoftDeleteModal
          title="Koşuyu sil"
          subject={sil.target.label}
          busy={sil.busy}
          onCancel={() => sil.setTarget(null)}
          onConfirm={sil.doDelete}
        />
      )}
      {sil.batchOpen && (
        <SoftDeleteModal
          title="Seçilenleri sil"
          subject={`${sil.selected.size} koşu`}
          busy={sil.busy}
          onCancel={() => sil.setBatchOpen(false)}
          onConfirm={sil.doDeleteBatch}
        />
      )}
    </>
  );
}
