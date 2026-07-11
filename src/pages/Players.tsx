import { useCallback, useEffect, useState } from "react";
import {
  adjustWallet,
  banPlayer,
  fetchPlayers,
  fetchWallet,
  fmtDate,
  unbanPlayer,
  type Player,
  type WalletInfo,
} from "../api";
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
  const [open, setOpen] = useState<number | null>(null); // cüzdan detayı açık oyuncu

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
                <PlayerRow
                  key={p.id}
                  p={p}
                  open={open === p.id}
                  toggle={() => setOpen(open === p.id ? null : p.id)}
                  busy={busy}
                  onBan={() => setBanTarget(p)}
                  onUnban={() => doUnban(p)}
                />
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

// Satıra tıklayınca cüzdan detayı (bakiye + son 50 transaction + düzeltme) açılır.
function PlayerRow({
  p,
  open,
  toggle,
  busy,
  onBan,
  onUnban,
}: {
  p: Player;
  open: boolean;
  toggle: () => void;
  busy: boolean;
  onBan: () => void;
  onUnban: () => void;
}) {
  return (
    <>
      <tr className="expander" onClick={toggle}>
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
            <button
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onUnban();
              }}
            >
              Banı kaldır
            </button>
          ) : (
            <button
              className="danger"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onBan();
              }}
            >
              Banla
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={10}>
            <WalletPanel playerId={p.id} />
          </td>
        </tr>
      )}
    </>
  );
}

// Cüzdan paneli: açılınca yüklenir; düzeltme sonrası yeniden çekilir.
function WalletPanel({ playerId }: { playerId: number }) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchWallet(playerId)
      .then((w) => {
        setWallet(w);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [playerId]);
  useEffect(load, [load]);

  const amountNum = Number(amount);
  const valid = amount.trim() !== "" && Number.isInteger(amountNum) && amountNum !== 0 && reason.trim() !== "";

  const doAdjust = async () => {
    if (!valid) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await adjustWallet(playerId, amountNum, reason.trim());
      setMsg(`Düzeltme uygulandı; yeni bakiye ${res.balance} Pul.`);
      setError(null);
      setAmount("");
      setReason("");
      load();
    } catch (e) {
      // Sunucu reddi (ör. "bakiye negatife düşürülemez") aynen gösterilir.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="report-detail">
      {error && <div className="error-banner">Cüzdan: {error}</div>}
      {msg && <div className="ok-banner">{msg}</div>}
      {wallet && (
        <>
          <h4>Cüzdan</h4>
          <p>
            Bakiye: <strong>{wallet.balance} Pul</strong>
          </p>

          <h4>Elle düzeltme (miktar + sebep zorunlu; negatife düşürme yasak)</h4>
          <div className="wallet-adjust" onClick={(e) => e.stopPropagation()}>
            <input
              type="number"
              step="1"
              placeholder="Miktar (+/-)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              type="text"
              placeholder="Sebep (transactions ref_id'sine yazılır)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button className="primary" disabled={busy || !valid} onClick={doAdjust}>
              Uygula
            </button>
          </div>

          <h4>Son {wallet.transactions.length} işlem</h4>
          {wallet.transactions.length === 0 ? (
            <p>Henüz Pul hareketi yok.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th className="num">Δ Pul</th>
                  <th>Sebep</th>
                  <th>Referans</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {wallet.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="num">{t.id}</td>
                    <td className={"num " + (t.delta < 0 ? "delta-neg" : "delta-pos")}>
                      {t.delta > 0 ? `+${t.delta}` : t.delta}
                    </td>
                    <td>
                      <span className="badge">{t.reason}</span>
                    </td>
                    <td>{t.ref_id || "—"}</td>
                    <td>{fmtDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
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
