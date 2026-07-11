import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchEconHistory,
  fetchEconomyConfig,
  fmtDate,
  saveEconomyConfig,
  type EconHistoryEntry,
} from "../api";

// economy_config canlı ayar formu (04-EKONOMI.md): kategori başlıklı alanlar,
// kaydette version+1 + econ_config_history kaydı, altta değişiklik geçmişi.
// Alanlar tipine göre çizilir: sayı → input, sayı dizisi → virgüllü metin,
// sayı sözlüğü → mini grid, karmaşık yapılar → JSON metin alanı.

// Kategori başlıkları; listelenmeyen anahtarlar "Diğer"e düşer.
const GROUPS: { title: string; keys: string[] }[] = [
  {
    title: "Bölüm ödülleri",
    keys: [
      "level_first_base",
      "level_first_per_world",
      "star_reward",
      "sinav_base",
      "world_bonus_per_star",
      "endless_milestones",
      "endless_step",
      "endless_step_pul",
    ],
  },
  {
    title: "Günlük",
    keys: ["daily_table", "daily_items", "daily_cycle_growth", "daily_growth_cap"],
  },
  {
    title: "Reklam",
    keys: [
      "ad_topup_pul",
      "ad_topup_daily_max",
      "interstitial_min_deaths",
      "interstitial_min_gap_s",
      "interstitial_session_cap",
    ],
  },
  {
    title: "Fiyatlar",
    keys: [
      "revive_pul",
      "username_change_pul",
      "consumable_prices",
      "editor_prices",
      "skin_prices",
      "trail_prices",
    ],
  },
  { title: "Haftalık", keys: ["weekly_prizes", "weekly_finish_pul"] },
  {
    title: "Harita havuzu",
    keys: [
      "map_pool_per_30s",
      "map_pool_ad",
      "map_pool_consumable_pct",
      "map_finisher_pct",
      "map_creator_pct",
      "map_pool_cap",
      "map_daily_player_cap",
      "map_min_payout",
    ],
  },
  { title: "IAP", keys: ["iap_packages"] },
];

// Denge kuralı (04-EKONOMI.md): RewardedPul ≤ (eCPM/1000) / PulUSD × K.
// Katsayılar sabit: eCPM=$2 (TR ödüllü), 1 Pul=$0.000825, K=10.
const AD_TOPUP_LIMIT = (2 / 1000) / 0.000825 * 10; // ≈ 24.2

type FieldValue = unknown;

const isNumArray = (v: FieldValue): v is number[] =>
  Array.isArray(v) && v.every((x) => typeof x === "number");
const isNumMap = (v: FieldValue): v is Record<string, number> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.values(v as object).every((x) => typeof x === "number");

// İki config arasındaki alan bazlı farklar ("anahtar: eski → yeni").
export function diffConfig(
  oldC: Record<string, unknown>,
  newC: Record<string, unknown>
): string[] {
  const out: string[] = [];
  const walk = (a: unknown, b: unknown, path: string) => {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    const aObj = a && typeof a === "object" && !Array.isArray(a);
    const bObj = b && typeof b === "object" && !Array.isArray(b);
    if (aObj && bObj) {
      const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
      for (const k of keys)
        walk(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
          path ? `${path}.${k}` : k
        );
      return;
    }
    const show = (v: unknown) => (v === undefined ? "—" : JSON.stringify(v));
    out.push(`${path}: ${show(a)} → ${show(b)}`);
  };
  walk(oldC, newC, "");
  return out;
}

export default function Economy() {
  const [version, setVersion] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [invalid, setInvalid] = useState<Set<string>>(new Set()); // bozuk JSON alanları
  const [history, setHistory] = useState<EconHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [cfg, hist] = await Promise.all([fetchEconomyConfig(), fetchEconHistory()]);
      setVersion(cfg.version);
      setUpdatedAt(cfg.updated_at);
      setDraft(structuredClone(cfg.config));
      setHistory(hist);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (key: string, value: unknown) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  const markInvalid = (key: string, bad: boolean) =>
    setInvalid((s) => {
      const n = new Set(s);
      if (bad) n.add(key);
      else n.delete(key);
      return n;
    });

  const doSave = async () => {
    if (!draft) return;
    setBusy(true);
    setSaved(null);
    try {
      const res = await saveEconomyConfig(draft);
      setSaved(`v${res.version} kaydedildi — oyun backend'i yeni sürümü hemen görür.`);
      setError(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Kategorilere girmeyen anahtarlar (ör. qbox_good_pct) "Diğer" altında.
  const otherKeys = useMemo(() => {
    if (!draft) return [];
    const known = new Set(GROUPS.flatMap((g) => g.keys));
    return Object.keys(draft).filter((k) => !known.has(k)).sort();
  }, [draft]);

  const adTopup = typeof draft?.ad_topup_pul === "number" ? draft.ad_topup_pul : null;
  const adWarning = adTopup !== null && adTopup > AD_TOPUP_LIMIT;

  return (
    <>
      <div className="page-head">
        <h1>Ekonomi</h1>
        {version !== null && (
          <div className="filters">
            <span className="live">
              v{version} · {fmtDate(updatedAt)}
            </span>
            <button
              className="primary"
              disabled={busy || !draft || invalid.size > 0}
              onClick={doSave}
            >
              Kaydet (v{version} → v{version + 1})
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-banner">Hata: {error}</div>}
      {saved && <div className="ok-banner">{saved}</div>}
      {invalid.size > 0 && (
        <div className="error-banner">
          Geçersiz JSON alanları var, kaydetmeden önce düzelt: {[...invalid].join(", ")}
        </div>
      )}
      {adWarning && (
        <div className="warn-banner">
          Denge uyarısı: ödüllü reklam Pul'u ({adTopup}) önerilen tavanın (
          {AD_TOPUP_LIMIT.toFixed(1)}) üzerinde — 04-EKONOMI denge kuralı: RewardedPul ≤
          (eCPM/1000) / PulUSD × K (eCPM $2, 1 Pul $0.000825, K=10). Reklam izleme, Pul
          satışını yamyamlaştırabilir.
        </div>
      )}

      {draft &&
        [...GROUPS, { title: "Diğer", keys: otherKeys }].map(
          (g) =>
            g.keys.some((k) => k in draft) && (
              <section className="card econ-section" key={g.title}>
                <h2>{g.title}</h2>
                <div className="econ-grid">
                  {g.keys
                    .filter((k) => k in draft)
                    .map((k) => (
                      <Field
                        key={k}
                        name={k}
                        value={draft[k]}
                        onChange={(v) => setField(k, v)}
                        onValidity={(bad) => markInvalid(k, bad)}
                      />
                    ))}
                </div>
              </section>
            )
        )}

      {history && (
        <section className="card econ-section">
          <h2>Değişiklik geçmişi</h2>
          {history.length === 0 && <p className="hint">Henüz değişiklik yapılmadı.</p>}
          {history.map((h) => (
            <HistoryRow key={h.id} h={h} />
          ))}
        </section>
      )}
    </>
  );
}

// Tek alan editörü: değer tipine göre uygun giriş çizer.
function Field({
  name,
  value,
  onChange,
  onValidity,
}: {
  name: string;
  value: unknown;
  onChange: (v: unknown) => void;
  onValidity: (bad: boolean) => void;
}) {
  if (typeof value === "number") {
    return (
      <label className="field">
        <span>{name}</span>
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />
      </label>
    );
  }
  if (isNumArray(value)) {
    return <NumListField name={name} value={value} onChange={onChange} onValidity={onValidity} />;
  }
  if (isNumMap(value)) {
    return (
      <div className="field field-wide">
        <span>{name}</span>
        <div className="econ-subgrid">
          {Object.entries(value).map(([k, v]) => (
            <label className="field" key={k}>
              <span>{k}</span>
              <input
                type="number"
                step="any"
                value={v}
                onChange={(e) =>
                  onChange({ ...value, [k]: e.target.value === "" ? 0 : Number(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
      </div>
    );
  }
  return <JsonField name={name} value={value} onChange={onChange} onValidity={onValidity} />;
}

// Sayı listesi: "10, 15, 20" biçiminde düzenlenir (daily_table, weekly_prizes).
function NumListField({
  name,
  value,
  onChange,
  onValidity,
}: {
  name: string;
  value: number[];
  onChange: (v: unknown) => void;
  onValidity: (bad: boolean) => void;
}) {
  const [text, setText] = useState(value.join(", "));
  const [bad, setBad] = useState(false);
  const lastEmitted = useRef(JSON.stringify(value));
  useEffect(() => {
    // Yalnız DIŞARIDAN gelen değişimde (yeniden yükleme) metni tazele;
    // kendi yazdığımızın yankısında imleci bozma.
    if (JSON.stringify(value) !== lastEmitted.current) {
      lastEmitted.current = JSON.stringify(value);
      setText(value.join(", "));
      setBad(false);
    }
  }, [value]);
  return (
    <label className="field">
      <span>{name}</span>
      <input
        type="text"
        className={bad ? "invalid" : ""}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const parts = e.target.value.split(",").map((s) => s.trim());
          const nums = parts.map(Number);
          const ok = parts.length > 0 && parts.every((s) => s !== "") && nums.every((n) => !isNaN(n));
          setBad(!ok);
          onValidity(!ok);
          if (ok) {
            lastEmitted.current = JSON.stringify(nums);
            onChange(nums);
          }
        }}
      />
    </label>
  );
}

// Karmaşık değerler (iç içe nesne, karışık dizi): ham JSON düzenleme.
function JsonField({
  name,
  value,
  onChange,
  onValidity,
}: {
  name: string;
  value: unknown;
  onChange: (v: unknown) => void;
  onValidity: (bad: boolean) => void;
}) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [bad, setBad] = useState(false);
  const lastEmitted = useRef(JSON.stringify(value));
  useEffect(() => {
    if (JSON.stringify(value) !== lastEmitted.current) {
      lastEmitted.current = JSON.stringify(value);
      setText(JSON.stringify(value, null, 2));
      setBad(false);
    }
  }, [value]);
  return (
    <label className="field field-wide">
      <span>{name} (JSON)</span>
      <textarea
        rows={Math.min(10, text.split("\n").length)}
        className={bad ? "invalid" : ""}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            setBad(false);
            onValidity(false);
            lastEmitted.current = JSON.stringify(parsed);
            onChange(parsed);
          } catch {
            setBad(true);
            onValidity(true);
          }
        }}
      />
    </label>
  );
}

// Geçmiş satırı: kim, ne zaman + alan bazlı fark özeti.
function HistoryRow({ h }: { h: EconHistoryEntry }) {
  const diffs = useMemo(() => diffConfig(h.old_json, h.new_json), [h]);
  return (
    <div className="history-row">
      <div className="history-head">
        <strong>{h.admin}</strong> · {fmtDate(h.created_at)}
        <span className="hint-inline">
          {diffs.length} alan değişti
        </span>
      </div>
      <ul className="diff-list">
        {diffs.slice(0, 20).map((d, i) => (
          <li key={i}>
            <code>{d}</code>
          </li>
        ))}
        {diffs.length > 20 && <li className="hint-inline">… ve {diffs.length - 20} alan daha</li>}
        {diffs.length === 0 && <li className="hint-inline">İçerik farkı yok (aynı JSON).</li>}
      </ul>
    </div>
  );
}
