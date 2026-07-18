// Liste sayfalarında ortak soft delete akışı: SİL (sebepsiz, tek tık onay
// modalı), satır seçimi (tümünü seç + toplu sil / toplu geri al) ve Silinenler
// görünümünde GERİ AL. Kayıt kalıcı silinmez; sunucu deleted_at doldurur,
// varsayılan listelerden gizler (uçlar: /api/{kind}/{id}/delete|restore ve
// /api/{kind}/delete-batch|restore-batch). Dört sayfa da bunu kullanır;
// haritada sunucu ayrıca map_deletions denetim kaydı yazar.
import { useCallback, useState } from "react";
import {
  restoreBatch,
  restoreRecord,
  softDelete,
  softDeleteBatch,
  type DeletableKind,
} from "./api";

export type DeleteTarget = { id: number; label: string };

export function useSoftDelete(kind: DeletableKind, refetch: () => Promise<void>) {
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [batchOpen, setBatchOpen] = useState(false); // toplu silme onay modalı
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Başlıktaki "tümünü seç": görünürdekilerin hepsi seçiliyse temizler, değilse hepsini seçer.
  const toggleAll = (visibleIds: number[]) =>
    setSelected((s) =>
      visibleIds.length > 0 && visibleIds.every((id) => s.has(id))
        ? new Set()
        : new Set(visibleIds)
    );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const run = async (op: () => Promise<string>) => {
    setBusy(true);
    try {
      setMsg(await op());
      setError(null);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = () => {
    if (!target) return;
    const t = target;
    return run(async () => {
      await softDelete(kind, t.id);
      setTarget(null);
      setSelected((s) => {
        const n = new Set(s);
        n.delete(t.id);
        return n;
      });
      return `${t.label} silindi; Silinenler görünümünden geri alınabilir.`;
    });
  };

  const doRestore = (id: number, label: string) =>
    run(async () => {
      await restoreRecord(kind, id);
      setSelected((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      return `${label} geri alındı.`;
    });

  const doDeleteBatch = () =>
    run(async () => {
      const res = await softDeleteBatch(kind, [...selected]);
      setBatchOpen(false);
      setSelected(new Set());
      return `${res.affected} kayıt silindi; Silinenler görünümünden geri alınabilir.`;
    });

  const doRestoreBatch = () =>
    run(async () => {
      const res = await restoreBatch(kind, [...selected]);
      setSelected(new Set());
      return `${res.affected} kayıt geri alındı.`;
    });

  return {
    target,
    setTarget,
    batchOpen,
    setBatchOpen,
    selected,
    toggle,
    toggleAll,
    clearSelection,
    busy,
    error,
    msg,
    doDelete,
    doRestore,
    doDeleteBatch,
    doRestoreBatch,
  };
}

export type SoftDeleteState = ReturnType<typeof useSoftDelete>;

// Filtre çubuğuna eklenen toplu işlem butonu: seçim varken görünür;
// normal görünümde SİL (onay modalı açar), Silinenler'de GERİ AL (direkt).
export function BulkActions({ sil, inDeleted }: { sil: SoftDeleteState; inDeleted: boolean }) {
  if (sil.selected.size === 0) return null;
  return inDeleted ? (
    <button disabled={sil.busy} onClick={sil.doRestoreBatch}>
      Seçilenleri geri al ({sil.selected.size})
    </button>
  ) : (
    <button className="danger" disabled={sil.busy} onClick={() => sil.setBatchOpen(true)}>
      Seçilenleri sil ({sil.selected.size})
    </button>
  );
}

// Başlık hücresi: tümünü seç. visibleIds o an listelenen (filtrelenmiş) satırlar.
export function SelectAllTh({ sil, visibleIds }: { sil: SoftDeleteState; visibleIds: number[] }) {
  const all = visibleIds.length > 0 && visibleIds.every((id) => sil.selected.has(id));
  return (
    <th className="check">
      <input
        type="checkbox"
        checked={all}
        onChange={() => sil.toggleAll(visibleIds)}
        title="Tümünü seç"
      />
    </th>
  );
}

// Satır hücresi: tekil seçim. Genişleyen satırlarda tıklama detayı açmasın.
export function SelectTd({ sil, id }: { sil: SoftDeleteState; id: number }) {
  return (
    <td className="check" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={sil.selected.has(id)} onChange={() => sil.toggle(id)} />
    </td>
  );
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
  onConfirm: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>
          <strong>{subject}</strong> listeden kaldırılacak. Kayıt kalıcı silinmez;
          Silinenler görünümünden geri alınabilir.
        </p>
        <div className="actions">
          <button onClick={onCancel}>Vazgeç</button>
          <button className="danger" disabled={busy} onClick={onConfirm}>
            Sil
          </button>
        </div>
      </div>
    </div>
  );
}
