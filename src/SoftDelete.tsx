// Liste sayfalarında ortak soft delete akışı: SİL (opsiyonel sebep modalı) ve
// Silinenler görünümünde GERİ AL. Kayıt kalıcı silinmez; sunucu deleted_at
// doldurur, varsayılan listelerden gizler (uçlar: /api/{kind}/{id}/delete|restore).
// Maps.tsx kullanmaz: harita silme sebebi zorunlu, kendi modalı var (deleteMap).
import { useState } from "react";
import { restoreRecord, softDelete, type DeletableKind } from "./api";

export type DeleteTarget = { id: number; label: string };

export function useSoftDelete(kind: DeletableKind, refetch: () => Promise<void>) {
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const doDelete = async (reason: string) => {
    if (!target) return;
    setBusy(true);
    try {
      await softDelete(kind, target.id, reason);
      setMsg(`${target.label} silindi; Silinenler görünümünden geri alınabilir.`);
      setError(null);
      setTarget(null);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async (id: number, label: string) => {
    setBusy(true);
    try {
      await restoreRecord(kind, id);
      setMsg(`${label} geri alındı.`);
      setError(null);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return { target, setTarget, busy, error, msg, doDelete, doRestore };
}

export function SoftDeleteModal({
  title,
  subject,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  subject: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>
          <strong>{subject}</strong> listeden kaldırılacak. Kayıt kalıcı silinmez;
          Silinenler görünümünden geri alınabilir.
        </p>
        <input
          type="text"
          placeholder="Silme sebebi (opsiyonel)"
          value={reason}
          autoFocus
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && onConfirm(reason.trim())}
        />
        <div className="actions">
          <button onClick={onCancel}>Vazgeç</button>
          <button className="danger" disabled={busy} onClick={() => onConfirm(reason.trim())}>
            Sil
          </button>
        </div>
      </div>
    </div>
  );
}
