# AquaBuddy

SiteWrapper Electron App
========================

Geliştirilen bu yapı, mevcut bir web sitesini masaüstü uygulamasına dönüştürmek için Electron kullanır. Varsayılan yapılandırmalar `app/app.config.json` dosyasında bulunur.

Hızlı Başlangıç
---------------

1) Gereksinimler: Node.js 18+ ve npm

2) Kurulum:

```bash
cd app
npm install
```

3) Geliştirme (hedef URL ile):

```bash
APP_TARGET_URL="https://ornek.site" npm run dev
```

4) Üretim paketleri:

```bash
npm run build
```

Yapılandırma
------------
- `APP_TARGET_URL`: Çalışma zamanında yüklenecek site URL’si.
- `app/app.config.json`: Pencere boyutu, başlık, arka plan rengi, kullanıcı aracısı eki, güvenli gezinme alan adları.

Güvenlik
--------
- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` etkin.
- Pencere açma ve gezinme, beyaz liste alan adları ile sınırlandırılır; harici linkler varsayılan tarayıcıda açılır.

## Yayınlama (Landing Site)

- `site/` klasörü statik olarak barındırılabilir (GitHub Pages, Vercel, Netlify).
- Alan adı için `site/CNAME` dosyasını düzenleyin (örn. `app.aquabuddy.com`).
- Yayın adresi: `https://app.aquabuddy.com/` (örnek). `Uygulamayı Aç` bağlantısı `/app/` yoluna yönlenir.