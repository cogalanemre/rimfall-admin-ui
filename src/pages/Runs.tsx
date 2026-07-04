import { useCallback, useState } from "react";
import { fetchRuns, fmtDate, runExportUrl, type RunRow } from "../api";
import { usePoll } from "../usePoll";

// Koşu listesi 10 sn'de bir tazelenir.
const REFRESH_MS = 10000;

// Koşu süresi saniye cinsinden (started_at → ended_at).
function durationSec(r: RunRow): number {
  return Math.max(0, Math.round((+new Date(r.ended_at) - +new Date(r.started_at)) / 1000));
}

export default function Runs() {
  const [q, setQ] = useState("");
  const fetcher = useCallback(() => fetchRuns(q), [q]);
  const { data, error } = usePoll(fetcher, REFRESH_MS);

  return (
    <>
      <div className="page-head">
        <h1>Oyunlar</h1>
        <input
          type="search"
          className="search"
          placeholder="Oyuncu, harita veya ID ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <p className="hint">
        Bir koşuyu oyunda izlemek için: oyunda <strong>REPLAY</strong> ekranına gir, buradaki{" "}
        <strong>ID</strong>'yi yaz. İNDİR ise aynı verinin (bölümler + dokunuş tick'leri) JSON
        arşivini verir.
      </p>

      {error && <div className="error-banner">Sunucuya ulaşılamadı: {error}</div>}

      {data && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th className="num">ID</th>
                <th>Oyuncu</th>
                <th>Harita</th>
                <th>Tür</th>
                <th className="num">Skor</th>
                <th>Sonuç</th>
                <th className="num">Süre</th>
                <th>Tarih</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={9}>Koşu bulunamadı.</td>
                </tr>
              )}
              {data.map((r) => (
                <tr key={r.id}>
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
                  <td>
                    <a className="download" href={runExportUrl(r.id)} download>
                      İNDİR
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
