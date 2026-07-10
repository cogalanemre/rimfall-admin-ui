# Rimfall Admin UI

React + TypeScript + Vite admin paneli. Backend'i:
`/Users/emre.cogalan/Rimfall/admin-backend` (port 8096). UI metinleri Türkçe.

## Çalıştırma

```bash
npm run dev      # geliştirme: http://localhost:5173 (API'ye CORS ile gider)
npm run build    # tsc + vite build → dist/ (admin backend dist'i 8096'den sunar)
```

Node Homebrew'dan kurulu (`/opt/homebrew/bin/node`, v26). Build sonrası ayrı
sunucuya gerek yok: http://127.0.0.1:8096 hem API hem UI.

## Yapı

- `src/api.ts` — API istemcisi + tipler (dev'de 127.0.0.1:8096'e mutlak, build'de aynı origin)
- `src/usePoll.ts` — aralıklı veri çekme kancası; eldeki görünüm yenilemede korunur
- `src/pages/Dashboard.tsx` — stat kartları + 7 günlük sütun grafiği, **5 sn'de bir** poll
- `src/pages/Players.tsx` — arama, ban (sebep modalı) / unban, çevrimiçi rozetleri, 10 sn poll
- `src/pages/BugReports.tsx` — satıra tıklayınca bağlam/cihaz/son loglar açılır
- `src/pages/Maps.tsx` — harita listesi
- `src/styles.css` — koyu tema; renk token'ları dataviz referans paletinden
  (yüzey #1a1a19, seri mavisi #3987e5, durum renkleri sabit)

## Grafik kuralları (dataviz skill'inden)

Tek seri → lejant yok (başlık adlandırır); sütun ≤24px, tepesi 4px yuvarlak,
taban düz; hairline gridline; seçici etiket (yalnız en yüksek gün + bugün);
her sütunun şerit genişliğinde hover alanı + tooltip; ekran okuyucu için
sr-only tablo. SVG viewBox (1120x250) render boyutuna yakın tutuldu ki
yazı/sütun ölçüleri gerçek piksele otursun.
