# ardaekinci.com

Arda Ekinci'nin kişisel anı sitesi: fotoğraflar, yolculuklar, notlar, hakkımda ve CV bir arada.
Site **GitHub Pages** üzerinde ücretsiz çalışır. Sunucu, veritabanı ya da aylık ücret yok, sadece alan adı ücreti var.
Bütün içerik `/admin` panelinden yönetilir.

## Sitede neler var?

| Sayfa | İçerik |
|---|---|
| **Ana sayfa** | Açılış animasyonu, dönen kapak fotoğrafları, kayan yazılar, yatay kayan “En yeni anılar”, hikâyeler, sayılar, gezilen yerleri gösteren dönen dünya küresi, notlar, hakkımda tanıtımı, iletişim |
| **Anılar** (`#/anilar`) | Instagram tarzı profil + ızgara / akış / zaman tüneli görünümleri, arama, sonsuz kaydırma |
| **Koleksiyonlar** (`#/koleksiyonlar`) | Albümler (elle oluşturulan), ülkeler ve yıllar (kendiliğinden oluşur) |
| **Koleksiyon sayfası** | Kapak, tarih aralığı, yerler, galeri, “Hikâye olarak izle” |
| **Hakkımda** (`#/hakkimda`) | Hikâye, “Şu sıralar”, kısaca bilgiler, deneyim, eğitim, yetenekler, diller, projeler, CV indirme |
| **Anı görüntüleyici** | Tam ekran, kaydırmalı çoklu fotoğraf, konum/tarih, paylaş, önceki/sonraki |
| **Hikâye izleyici** | Instagram hikâyesi gibi: ilerleme çubukları, dokun-geç, basılı tut-durdur, aşağı kaydır-kapat |

Her anının kendine ait bir bağlantısı var (ör. `ardaekinci.com/#/ani/…`), “Paylaş” ile WhatsApp vb. yerlere gönderilebilir.

## Yönetim paneli (`/admin`)

- **Anılar:** Fotoğrafları seç → konum ve çekim tarihi fotoğrafın içinden otomatik okunur → ister her biri ayrı anı, ister hepsi tek kaydırmalı anı olsun.
  “✎ Not” ile yazı paylaşımı. Bir anıya dokununca düzenleme: başlık, açıklama, konum, tarih, albüm, kapak ★, sabitle 📌, gizle, fotoğraf ekle/çıkar/sırala.
- **Toplu işlem:** “Seç” (ya da bir anıya uzun bas) → albüme ekle, konum, tarih, gizle/göster, sabitle, kapağa ekle, birleştir, ayır, **toplu sil**.
- **Albümler:** oluştur, kapak seç, anı ekle/çıkar, sırala.
- **Profil:** profil fotoğrafı, portre, isim, kullanıcı adı, tanıtım cümlesi, hakkımda yazısı, “şu sıralar”, sosyal medya, kısaca bilgiler.
- **CV:** deneyim, eğitim, yetenekler, diller, projeler (görselli), PDF CV yükleme.
- **Ayarlar:** vurgu rengi, açılış animasyonu, ana sayfa bölümlerini aç/kapa, dönen ve kayan kelimeler.

Değişiklikler önce panelde birikir, **Yayınla** deyince tek seferde kaydedilir. Site 1–2 dakika içinde güncellenir.
Fotoğraflar tarayıcıda otomatik küçültülür (en uzun kenar 2400 px), telefondan direkt yüklenebilir.
Gizlilik için fotoğrafın tam GPS konumu kaydedilmez, sadece şehir ve ülke adı (yaklaşık konum) saklanır.

### Panele giriş anahtarı
1. https://github.com/settings/personal-access-tokens/new
2. **Repository access → Only select repositories →** `Arda-Ekinci`
3. **Permissions → Contents → Read and write**
4. **Generate token** → çıkan `github_pat_…` kodunu panelde yapıştır.

## ardaekinci.com alan adını bağlamak

1. Alan adını satın al (Cloudflare, Porkbun ya da bir Türk firması). Sadece alan adı yeterli, **hosting paketi alma**.
2. Alan adı firmasının DNS ayarlarına şu kayıtları ekle:

   | Tür | Ad | Değer |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | ardaekinci1942-alt.github.io |

3. GitHub'da repo → **Settings → Pages → Custom domain** → `ardaekinci.com` → **Save**
   (GitHub otomatik olarak bir `CNAME` dosyası ekler; silme.)
4. DNS doğrulanınca aynı sayfada **Enforce HTTPS** kutusunu işaretle.

Ziyaretçiler sadece `ardaekinci.com` adresini görür, GitHub arka planda dosyaları saklar.
Panel de `ardaekinci.com/admin` adresinden aynen çalışır.

## Dosya yapısı

```
index.html              Site iskeleti (tek sayfa, içerik JavaScript ile çizilir)
assets/css/app.css      Tüm tasarım
assets/js/core.js       Veri, yardımcılar, ortak parçalar
assets/js/shell.js      Açılış animasyonu, menü, sayfa geçişleri, yönlendirme
assets/js/home.js       Ana sayfa
assets/js/pages.js      Anılar, koleksiyonlar, hakkımda
assets/js/overlays.js   Anı görüntüleyici ve hikâye izleyici
assets/js/globe.js      Dünya küresi
assets/vendor/          GSAP, d3-geo, topojson, dünya haritası (dışarıya bağımlılık yok)
admin/                  Yönetim paneli
data/site.json          Profil, CV, görünüm ayarları
data/posts.json         Anılar ve albümler
photos/                 Fotoğraflar (+ thumbs/ küçük önizlemeler)
images/, files/         Profil/proje görselleri, CV PDF
```

## Notlar
- GitHub Pages yaklaşık 1 GB'a kadar rahat çalışır (aşağı yukarı 1000+ fotoğraf).
- Bir seferde çok fazla fotoğraf yayınlanırsa GitHub kısa molalar isteyebilir; panel bekleyip kendisi devam eder.
- Kod tarafında bir şey değişirse tarayıcı eski sürümü en fazla ~10 dakika hafızasında tutabilir; sayfayı yenilemek yeterli.
