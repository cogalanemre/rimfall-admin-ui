import { useCallback, useEffect, useRef, useState } from "react";

// Belirli aralıkla veri çeker; yeni veri gelene dek eldeki görünüm korunur
// (yenilemede boşluk/titreme olmaz). Hata geçicidir: sonraki tur düzelirse silinir.
export function usePoll<T>(fn: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const refetch = useCallback(async () => {
    try {
      const d = await fnRef.current();
      setData(d);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refetch();
    const t = setInterval(refetch, intervalMs);
    return () => clearInterval(t);
  }, [refetch, intervalMs]);

  return { data, error, updatedAt, refetch };
}
