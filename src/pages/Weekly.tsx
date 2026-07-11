import { useCallback, useEffect, useState } from "react";
import {
  closeWeek,
  fetchWeeklyResults,
  fetchWeeklyRuns,
  fetchWeeks,
  flagWeeklyRun,
  fmtDate,
  runExportUrl,
  type WeekRow,
  type WeeklyResultRow,
  type WeeklyRunRow,
} from "../api";
import { usePoll } from "../usePoll";

const REFRESH_MS = 15000;

// Mod sekmeleri; skor biçimi moda göre değişir (05-MODLAR.md).
const MODES = [
  { value: "speed", label: "HIZ" },
  { value: "long", label: "UZUN" },
  { value: "first", label: "İLK BİTİREN" },
];

const MODE_LABEL: Record<string, string> = {
  speed: "HIZ",
  long: "UZUN",
  first: "İLK BİTİREN",
};

const fmtScore = (mode: string, score: number) =>
  mode === "speed"
    ? `${(score / 1000).toFixed(2)} sn`
    : mode === "long"
      ? String(score)
      : `#${score}`;

const fmtDuration = (ms: number) => (ms > 0 ? `${(ms / 1000).toFixed(1)} sn` : "—");

export default function Weekly() {
  const { data: weeks, error, refetch } = usePoll(fetchWeeks, REFRESH_MS);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState("speed");
  const [closeTarget, setCloseTarget] = useState<WeekRow | null>(null);
  const [closeMsg, setCloseMsg] = useState<string | null>(null);
  const [closeErr, setCloseErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // İlk yüklemede en güncel haftayı seç.
  useEffect(() => {
    if (!selected && weeks && weeks.length > 0) setSelected(weeks[0].week_id);
  }, [weeks, selected]);

  const week = weeks?.find((w) => w.week_id === selected) ?? null;

  const doClose = async () => {
    if (!closeTarget) return;
    setBusy(true);
    setCloseMsg(null);
    setCloseErr(null);
    try {
      const res = await closeWeek(closeTarget.week_id);
      setCloseMsg(
        `${res.week_id} kapatıldı: ${res.prizes_paid} sıralama ödülü + ${res.finish_paid} katılım pulu dağıtıldı.`
      );
      setCloseTarget(null);
      await refetch();
    } catch (e) {
      // 409 dahil sunucu mesajı aynen gösterilir ("hafta zaten kapatıldı").
      setCloseErr(e instanceof Error ? e.message : String(e));
      setCloseTarget(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Haftalık Modlar</h1>
        {weeks && <div className="live">{weeks.length} hafta</div>}
      </div>

      {error && <div className="error-banner">Sunucuya ulaşılamadı: {error}</div>}
      {closeErr && <div className="error-banner">Kapanış başarısız: {closeErr}</div>}
      {closeMsg && <div className="ok-banner">{closeMsg}</div>}

      {weeks && (
        <div className="table-card" style={{ marginBottom: 18 }}>
          <table>
            <thead>
              <tr>
                <th>Hafta</th>
                <th>Başlangıç</th>
                <th>Durum</th>
                <th className="num">HIZ</th>
                <th className="num">UZUN</th>
                <th className="num">İLK BİTİREN</th>
                <th className="num">Dağıtılan Pul</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr
                  key={w.week_id}
                  className="expander"
                  onClick={() => setSelected(w.week_id)}
                  style={w.week_id === selected ? { background: "var(--surface-2)" } : undefined}
                >
                  <td className="strong">{w.week_id}</td>
                  <td>{fmtDate(w.created_at)}</td>
                  <td>
                    {w.closed_at ? (
                      <span className="badge offline">kapandı · {fmtDate(w.closed_at)}</span>
                    ) : (
                      <span className="badge online">
                        <span className="dot" />
                        açık
                      </span>
                    )}
                  </td>
                  <td className="num">{w.speed_count}</td>
                  <td className="num">{w.long_count}</td>
                  <td className="num">{w.first_count}</td>
                  <td className="num">{w.total_prize}</td>
                  <td>
                    {!w.closed_at && (
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCloseTarget(w);
                        }}
                      >
                        Haftayı kapat
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {weeks.length === 0 && (
                <tr>
                  <td colSpan={8}>Henüz hafta kaydı yok (oyun backend'i ilk GET /weekly'de açar).</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {week && (
        <>
          <div className="page-head">
            <h1 style={{ fontSize: 16 }}>{week.week_id} — inceleme (ilk 10 koşu)</h1>
            <div className="filters">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  className={mode === m.value ? "primary" : ""}
                  onClick={() => setMode(m.value)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {/* key: hafta/mod değişince tablo yeniden kurulur — usePoll eski
              haftanın verisini yeni başlığın altında göstermesin. */}
          <RunsTable key={`${week.week_id}:${mode}`} weekId={week.week_id} mode={mode} />
          {week.closed_at && <ResultsTable weekId={week.week_id} />}
        </>
      )}

      {closeTarget && (
        <div className="modal-overlay" onClick={() => setCloseTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Haftayı kapat</h3>
            <p>
              <strong>{closeTarget.week_id}</strong> kapatılacak: oyun backend'i üç modun
              ödüllerini dağıtır (transactions'a weekly_prize / weekly_finish yazılır). Bu işlem
              geri alınamaz.
            </p>
            <div className="actions">
              <button onClick={() => setCloseTarget(null)}>Vazgeç</button>
              <button className="danger" disabled={busy} onClick={doClose}>
                Kapat ve ödülleri dağıt
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RunsTable({ weekId, mode }: { weekId: string; mode: string }) {
  const fetcher = useCallback(() => fetchWeeklyRuns(weekId, mode), [weekId, mode]);
  const { data, error, refetch } = usePoll(fetcher, REFRESH_MS);
  const [flagTarget, setFlagTarget] = useState<WeeklyRunRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const doFlag = async (note: string) => {
    if (!flagTarget) return;
    setBusy(true);
    try {
      await flagWeeklyRun(weekId, mode, flagTarget.user_id, note);
      setFlagTarget(null);
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
      {error && <div className="error-banner">Sunucuya ulaşılamadı: {error}</div>}
      {actionError && <div className="error-banner">İşlem başarısız: {actionError}</div>}
      {data && (
        <div className="table-card" style={{ marginBottom: 18 }}>
          <table>
            <thead>
              <tr>
                <th className="num">Sıra</th>
                <th>Oyuncu</th>
                <th className="num">Skor</th>
                <th className="num">Koşu süresi</th>
                <th className="num">Tap sayısı</th>
                <th>Koşu</th>
                <th>Gönderim</th>
                <th>İnceleme</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={`${r.user_id}`}>
                  <td className="num">{i + 1}</td>
                  <td className="strong">
                    {r.user_email ? `${r.user_name || "?"} (${r.user_email})` : `#${r.user_id}`}
                  </td>
                  <td className="num">{fmtScore(mode, r.score)}</td>
                  <td className="num">{fmtDuration(r.duration_ms)}</td>
                  <td className="num">{r.taps}</td>
                  <td>
                    {r.run_id > 0 ? (
                      <a className="download" href={runExportUrl(r.run_id)}>
                        #{r.run_id} ⇩
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{fmtDate(r.created_at)}</td>
                  <td>
                    {r.flagged ? (
                      <span className="badge open" title={r.flag_note}>
                        incelenecek
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <button disabled={busy} onClick={() => setFlagTarget(r)}>
                      İncele
                    </button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={9}>Bu modda koşu yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {flagTarget && (
        <FlagModal
          run={flagTarget}
          mode={mode}
          busy={busy}
          onCancel={() => setFlagTarget(null)}
          onConfirm={doFlag}
        />
      )}
    </>
  );
}

function FlagModal({
  run,
  mode,
  busy,
  onCancel,
  onConfirm,
}: {
  run: WeeklyRunRow;
  mode: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState(run.flag_note);
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>İnceleme işareti</h3>
        <p>
          <strong>{run.user_email || `#${run.user_id}`}</strong> — {MODE_LABEL[mode]} koşusu
          inceleme kuyruğuna alınacak. Koşu, Replay ekranında #{run.run_id} ile izlenebilir.
        </p>
        <input
          type="text"
          placeholder="Not (ör. süre şüpheli, tap yoğunluğu düşük)"
          value={note}
          autoFocus
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onConfirm(note)}
        />
        <div className="actions">
          <button onClick={onCancel}>Vazgeç</button>
          <button className="primary" disabled={busy} onClick={() => onConfirm(note)}>
            İşaretle
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultsTable({ weekId }: { weekId: string }) {
  const [data, setData] = useState<WeeklyResultRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setData(null);
    fetchWeeklyResults(weekId)
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [weekId]);

  if (error) return <div className="error-banner">Sonuçlar alınamadı: {error}</div>;
  if (!data) return null;
  return (
    <>
      <div className="page-head">
        <h1 style={{ fontSize: 16 }}>{weekId} — ödül dağıtımı</h1>
      </div>
      <div className="table-card" style={{ marginBottom: 18 }}>
        <table>
          <thead>
            <tr>
              <th>Mod</th>
              <th className="num">Sıra</th>
              <th>Oyuncu</th>
              <th className="num">Ödül (Pul)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={`${r.mode}-${r.rank}`}>
                <td>{MODE_LABEL[r.mode] ?? r.mode}</td>
                <td className="num">{r.rank}</td>
                <td className="strong">
                  {r.user_email ? `${r.user_name || "?"} (${r.user_email})` : `#${r.user_id}`}
                </td>
                <td className="num">{r.prize}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={4}>Ödül kaydı yok (katılımcı olmayabilir).</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
