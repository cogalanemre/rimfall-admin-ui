import { useCallback, useState } from "react";
import { banPlayer, fetchPlayers, fmtDate, unbanPlayer, type Player } from "../api";
import { usePoll } from "../usePoll";

// Oyuncu listesi 10 sn'de bir tazelenir (çevrimiçi durumu için yeterli).
const REFRESH_MS = 10000;

export default function Players() {
  const [q, setQ] = useState("");
  const fetcher = useCallback(() => fetchPlayers(q), [q]);
  const { data, error, refetch } = usePoll(fetcher, REFRESH_MS);
  const [banTarget, setBanTarget] = useState<Player | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const doBan = async (reason: string) => {
    if (!banTarget) return;
    setBusy(true);
    try {
      await banPlayer(banTarget.id, reason);
      setBanTarget(null);
      setActionError(null);
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doUnban = async (p: Player) => {
    setBusy(true);
    try {
      await unbanPlayer(p.id);
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
        <h1>Oyuncular</h1>
        <input
          type="search"
          className="search"
          placeholder="E-posta veya isim ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {error && <div className="error-banner">Sunucuya ulaşılamadı: {error}</div>}
      {actionError && <div className="error-banner">İşlem başarısız: {actionError}</div>}

      {data && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th className="num">#</th>
                <th>E-posta</th>
                <th>İsim</th>
                <th>Giriş</th>
                <th>Kayıt</th>
                <th className="num">Oyun</th>
                <th className="num">En iyi skor</th>
                <th>Son görülme</th>
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td className="num">{p.id}</td>
                  <td className="strong">{p.email}</td>
                  <td>{p.name}</td>
                  <td>{p.provider === "google" ? "Google" : "E-posta"}</td>
                  <td>{fmtDate(p.created_at)}</td>
                  <td className="num">{p.runs}</td>
                  <td className="num">{p.best_score}</td>
                  <td>{fmtDate(p.last_seen)}</td>
                  <td>
                    <StatusBadge p={p} />
                  </td>
                  <td>
                    {p.banned_at ? (
                      <button disabled={busy} onClick={() => doUnban(p)}>
                        Banı kaldır
                      </button>
                    ) : (
                      <button className="danger" disabled={busy} onClick={() => setBanTarget(p)}>
                        Banla
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={10}>Oyuncu bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {banTarget && (
        <BanModal
          player={banTarget}
          busy={busy}
          onCancel={() => setBanTarget(null)}
          onConfirm={doBan}
        />
      )}
    </>
  );
}

function StatusBadge({ p }: { p: Player }) {
  if (p.banned_at) {
    const title = `${fmtDate(p.banned_at)}${p.ban_reason ? " — " + p.ban_reason : ""}`;
    return (
      <span className="badge banned" title={title}>
        Banlı
      </span>
    );
  }
  if (p.online) {
    return (
      <span className="badge online">
        <span className="dot" />
        Çevrimiçi
      </span>
    );
  }
  return (
    <span className="badge offline">
      <span className="dot" />
      Çevrimdışı
    </span>
  );
}

function BanModal({
  player,
  busy,
  onCancel,
  onConfirm,
}: {
  player: Player;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Oyuncuyu banla</h3>
        <p>
          <strong>{player.email}</strong> banlanacak; aktif oturumu anında düşer ve oyuna
          giriş yapamaz.
        </p>
        <input
          type="text"
          placeholder="Sebep (opsiyonel)"
          value={reason}
          autoFocus
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onConfirm(reason)}
        />
        <div className="actions">
          <button onClick={onCancel}>Vazgeç</button>
          <button className="danger" disabled={busy} onClick={() => onConfirm(reason)}>
            Banla
          </button>
        </div>
      </div>
    </div>
  );
}
