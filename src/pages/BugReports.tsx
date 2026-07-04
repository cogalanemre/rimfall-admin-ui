import { useState } from "react";
import { fetchBugReports, fmtDate, type BugReport } from "../api";
import { usePoll } from "../usePoll";

const REFRESH_MS = 15000;

export default function BugReports() {
  const { data, error } = usePoll(fetchBugReports, REFRESH_MS);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <div className="page-head">
        <h1>Bug Raporları</h1>
        {data && <div className="live">{data.length} rapor</div>}
      </div>

      {error && <div className="error-banner">Sunucuya ulaşılamadı: {error}</div>}

      {data && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Tarih</th>
                <th>Oyuncu</th>
                <th>Mesaj</th>
                <th>Cihaz</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <Row key={r.id} r={r} open={open === r.id} toggle={() => setOpen(open === r.id ? null : r.id)} />
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5}>Henüz bug raporu yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Row({ r, open, toggle }: { r: BugReport; open: boolean; toggle: () => void }) {
  const device = r.device ?? {};
  const deviceLine = [device["os"], device["model"]].filter(Boolean).join(" · ") || "—";
  return (
    <>
      <tr className="expander" onClick={toggle}>
        <td className="num">{r.id}</td>
        <td>{fmtDate(r.created_at)}</td>
        <td>{r.user_email ? `${r.user_name} (${r.user_email})` : "Misafir"}</td>
        <td className="strong">{r.message}</td>
        <td>{String(deviceLine)}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5}>
            <div className="report-detail">
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
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
