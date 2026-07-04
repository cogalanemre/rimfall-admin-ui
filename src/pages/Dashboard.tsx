import { useRef, useState } from "react";
import { fetchStats } from "../api";
import { usePoll } from "../usePoll";

const REFRESH_MS = 5000;

export default function Dashboard() {
  const { data, error, updatedAt } = usePoll(fetchStats, REFRESH_MS);

  return (
    <>
      <div className="page-head">
        <h1>Panel</h1>
        {updatedAt && (
          <div className="live">
            <span className="dot" />
            Canlı — son güncelleme {updatedAt.toLocaleTimeString("tr-TR")}
          </div>
        )}
      </div>

      {error && <div className="error-banner">Sunucuya ulaşılamadı: {error}</div>}

      {data && (
        <>
          <div className="tiles">
            <Tile label="Toplam oyuncu" value={data.total_players} />
            <Tile
              label="Anlık aktif oyuncu"
              value={data.active_players}
              sub="son 75 saniyede sinyal gönderenler"
            />
            <Tile label="Toplam harita" value={data.total_maps} />
            <Tile label="Toplam oyun" value={data.total_runs} />
          </div>
          <div className="tiles">
            <Tile small label="Bugünkü oyun" value={data.runs_today} />
            <Tile small label="Bug raporu" value={data.total_bug_reports} />
            <Tile small label="Banlı oyuncu" value={data.banned_players} />
            <Tile small label="Kayıtlı oturum" value={data.total_sessions} />
          </div>
          <div className="card">
            <h2>Son 7 günde oynanan oyun</h2>
            <RunsChart data={data.runs_per_day} />
          </div>
        </>
      )}
    </>
  );
}

function Tile({
  label,
  value,
  sub,
  small,
}: {
  label: string;
  value: number;
  sub?: string;
  small?: boolean;
}) {
  return (
    <div className={small ? "tile small" : "tile"}>
      <div className="label">{label}</div>
      <div className="value">{value.toLocaleString("tr-TR")}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

// --- 7 günlük sütun grafiği (tek seri; başlık seriyi adlandırır, lejant yok) ---

// viewBox tipik render genişliğine yakın tutulur ki yazı/sütun ölçüsü
// gerçek piksele otursun (sütun ≤24px, yazı ~11px).
const W = 1120;
const H = 250;
const PAD = { top: 20, right: 10, bottom: 26, left: 40 };

type Tip = { x: number; y: number; day: string; count: number };

function RunsChart({ data }: { data: { day: string; count: number }[] }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(4, Math.ceil(Math.max(...data.map((d) => d.count)) / 4) * 4);
  const band = innerW / data.length;
  const barW = Math.min(24, band * 0.4);
  const yOf = (v: number) => PAD.top + innerH * (1 - v / maxVal);
  const maxCount = Math.max(...data.map((d) => d.count));

  // Fare bir sütunun şerit alanına girince tooltip o sütunun tepesine oturur.
  const showTip = (i: number) => (e: React.PointerEvent<SVGRectElement>) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const sr = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const scaleX = sr.width / W;
    const scaleY = sr.height / H;
    setTip({
      x: sr.left - wr.left + (PAD.left + i * band + band / 2) * scaleX,
      y: sr.top - wr.top + (yOf(data[i].count) - 6) * scaleY,
      day: data[i].day,
      count: data[i].count,
    });
    setHover(i);
  };
  const hideTip = () => {
    setTip(null);
    setHover(null);
  };

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Son 7 günde oynanan oyun sayısı grafiği">
        {/* gridline'lar: hairline, sade */}
        {[0, maxVal / 2, maxVal].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yOf(v)}
              y2={yOf(v)}
              stroke={v === 0 ? "var(--baseline)" : "var(--grid)"}
              strokeWidth="1"
            />
            <text x={PAD.left - 7} y={yOf(v) + 3.5} textAnchor="end" fontSize="11" fill="var(--muted)">
              {v}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + i * band + (band - barW) / 2;
          const h = innerH * (d.count / maxVal);
          const label = dayLabel(d.day, i === data.length - 1);
          // Seçici etiket: yalnız en yüksek gün ve bugün (her noktaya sayı yazılmaz).
          const capLabel = d.count > 0 && (d.count === maxCount || i === data.length - 1);
          return (
            <g key={d.day}>
              {d.count > 0 && (
                <path
                  d={roundedTopBar(x, yOf(d.count), barW, h)}
                  fill={hover === i ? "var(--series-1-hover)" : "var(--series-1)"}
                />
              )}
              {capLabel && (
                <text
                  x={x + barW / 2}
                  y={yOf(d.count) - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--ink-2)"
                >
                  {d.count}
                </text>
              )}
              <text
                x={PAD.left + i * band + band / 2}
                y={H - 7}
                textAnchor="middle"
                fontSize="11"
                fill="var(--muted)"
              >
                {label}
              </text>
              {/* vuruş alanı: işaretin kendisinden büyük, tüm şerit */}
              <rect
                x={PAD.left + i * band}
                y={PAD.top}
                width={band}
                height={innerH}
                fill="transparent"
                onPointerMove={showTip(i)}
                onPointerLeave={hideTip}
              />
            </g>
          );
        })}
      </svg>
      {tip && (
        <div className="chart-tooltip" style={{ left: tip.x, top: tip.y }}>
          <span className="val">{tip.count}</span>{" "}
          <span className="lbl">oyun — {fullDayLabel(tip.day)}</span>
        </div>
      )}
      {/* grafik verisinin tablo hâli (ekran okuyucular için) */}
      <table className="sr-only">
        <caption>Son 7 günde oynanan oyun sayısı</caption>
        <thead>
          <tr>
            <th>Gün</th>
            <th>Oyun</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Üstü 4px yuvarlak, tabanı düz sütun (yükseklik yuvarlaktan kısaysa daralt).
function roundedTopBar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  const b = y + h;
  return (
    `M${x},${b} L${x},${y + r} Q${x},${y} ${x + r},${y} ` +
    `L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${b} Z`
  );
}

function dayLabel(iso: string, isToday: boolean): string {
  if (isToday) return "Bugün";
  return new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", {
    weekday: "short",
    day: "numeric",
  });
}

function fullDayLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
}
