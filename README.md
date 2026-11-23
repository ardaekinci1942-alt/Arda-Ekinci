# ardaekinci.com

Kişisel fotoğraf / portfolyo sitesi. GitHub Pages üzerinde **ücretsiz** çalışır,
sunucu ya da veritabanı gerektirmez. Fotoğraflar `/admin` panelinden yüklenir.

## Yapı

```
index.html            Ana sayfa
assets/               Stil, script, ikon
admin/                Yönetim paneli (ardaekinci.com/admin)
data/site.json        İsim, slogan, hakkımda, iletişim bilgileri
data/photos.json      Fotoğraf listesi (sıra, başlık, kategori…)
photos/               Yüklenen fotoğraflar (+ thumbs/ küçük önizlemeler)
images/               Portre fotoğrafı
CNAME                 Özel alan adı: ardaekinci.com
```

## Kurulum (tek seferlik)

### 1. Kodu `main` dalına al
Bu dalı (`claude/...`) `main`'e birleştir (GitHub'da Pull Request → Merge).

### 2. GitHub Pages'i aç
Repo → **Settings → Pages** →
- **Source:** Deploy from a branch
- **Branch:** `main` / `(root)` → **Save**
- **Custom domain:** `ardaekinci.com` → Save
- DNS doğrulandıktan sonra **Enforce HTTPS** kutusunu işaretle.

> Repo **public** olmalı (ücretsiz GitHub hesabında Pages için gerekli).

### 3. Alan adının DNS ayarları
Alan adını aldığın firmanın (GoDaddy, Natro, İsimtescil, Cloudflare…) DNS panelinde:

| Tür   | Ad (Host) | Değer                    |
|-------|-----------|--------------------------|
| A     | @         | 185.199.108.153          |
| A     | @         | 185.199.109.153          |
| A     | @         | 185.199.110.153          |
| A     | @         | 185.199.111.153          |
| CNAME | www       | ardaekinci1942-alt.github.io |

Yayılması birkaç dakika ile birkaç saat sürebilir.

### 4. Admin anahtarı (token) oluştur
1. https://github.com/settings/personal-access-tokens/new
2. **Repository access → Only select repositories →** `Arda-Ekinci`
3. **Repository permissions → Contents → Read and write**
4. **Generate token** → kodu kopyala.

## Kullanım
1. `https://ardaekinci.com/admin` adresine git, anahtarı yapıştırıp giriş yap.
2. **Fotoğraflar:** sürükle-bırak ile yükle. Karta tıkla → başlık, kategori, açıklama.
   ★ işaretliler ana sayfa kapağında döner. Sürükleyerek veya oklarla sırala.
3. **Profil:** isim, slogan, hakkımda yazısı, e-posta, sosyal medya, portre.
4. Alttaki **Yayınla** butonuna bas → 1–2 dakika içinde site güncellenir.

Fotoğraflar tarayıcıda otomatik olarak küçültülür (en uzun kenar 2400px) — telefondan
direkt yükleyebilirsin. Sitedeki kategoriler, fotoğraflara verdiğin kategori adlarından
otomatik oluşur.
