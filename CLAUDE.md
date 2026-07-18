# Rimfall Admin UI

React + TypeScript + Vite admin paneli. Backend'i:
`/Users/cgln/Projects/Rimfall/admin-backend` (port 8096). UI metinleri Türkçe.

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
- `src/SoftDelete.tsx` — dört liste sayfasında ortak **soft delete** akışı:
  `useSoftDelete` kancası + sebepsiz tek tık SİL onay modalı + **satır seçimi**
  (`SelectAllTh` başlıkta tümünü seç, `SelectTd` satır kutusu, `BulkActions`
  filtre çubuğunda "Seçilenleri sil (N)" — Silinenler'de "Seçilenleri geri al";
  toplu silme de onay modalından geçer, uçlar delete-batch/restore-batch).
  Sayfalarda "Kayıtlar / Silinenler" seçici var; Silinenler görünümü sunucudan
  `?deleted=true` ile gelir (seçici değişince `useEffect` → `refetch` + seçim
  temizlenir, poll turu beklenmez), GERİ AL kaydı geri döndürür. Silme sebebi
  girilmez; haritada denetim kaydını (map_deletions) sunucu sebepsiz yazar.
- `src/pages/Dashboard.tsx` — stat kartları + 7 günlük sütun grafiği, **5 sn'de bir** poll
- `src/pages/Players.tsx` — arama, ban (sebep modalı) / unban, çevrimiçi rozetleri, 10 sn poll;
  satıra tıklayınca **cüzdan paneli**: bakiye + son 50 transaction + elle düzeltme
  (miktar+sebep zorunlu, negatif bakiye sunucuda reddedilir)
- `src/pages/BugReports.tsx` — satıra tıklayınca bağlam/cihaz/son loglar açılır
- `src/pages/Maps.tsx` — harita yönetimi: ad/kod/yapımcı araması + yayında/taslak
  filtresi (istemci tarafı, anında), satır detayı (bölüm sayısı, doğrulama koşusu),
  SİL/GERİ AL (ortak SoftDelete akışı) ve YAYINDAN KALDIR (havuz iptali) modalı,
  Silinenler görünümünde silinme tarihi
- `src/pages/Weekly.tsx` — haftalar listesi (katılımcı sayıları, kapanış durumu),
  mod sekmeleriyle ilk 10 koşu incelemesi (skor/süre/tap, İNCELE işareti),
  kapalı haftada ödül dağıtım tablosu, HAFTAYI KAPAT (409 mesajı aynen gösterilir).
  DİKKAT: `usePoll` fetcher değişince kendiliğinden yeniden çekmez — RunsTable
  `key={hafta:mod}` ile yeniden kurulur.
- `src/pages/Economy.tsx` — economy_config formu (kategori başlıkları; alan tipine
  göre sayı girişi / virgüllü liste / fiyat grid'i / JSON textarea), kaydette
  version+1, altta değişiklik geçmişi (alan bazlı fark özeti `diffConfig` ile).
  Denge uyarısı: ad_topup_pul > (2/1000)/0.000825×10 ≈ 24.2 ise sarı bant (04-EKONOMI).
- `src/styles.css` — koyu tema; renk token'ları dataviz referans paletinden
  (yüzey #1a1a19, seri mavisi #3987e5, durum renkleri sabit)

## Grafik kuralları (dataviz skill'inden)

Tek seri → lejant yok (başlık adlandırır); sütun ≤24px, tepesi 4px yuvarlak,
taban düz; hairline gridline; seçici etiket (yalnız en yüksek gün + bugün);
her sütunun şerit genişliğinde hover alanı + tooltip; ekran okuyucu için
sr-only tablo. SVG viewBox (1120x250) render boyutuna yakın tutuldu ki
yazı/sütun ölçüleri gerçek piksele otursun.
