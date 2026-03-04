# 🎵 RAADIO TR - Profesyonel Discord Müzik ve Radyo Botu

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-v16.9.0+-green.svg?style=for-the-badge&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/Discord.js-v14-5865F2.svg?style=for-the-badge&logo=discord" alt="Discord.js" />
  <img src="https://img.shields.io/badge/DisTube-v5-FF0000.svg?style=for-the-badge&logo=youtube" alt="DisTube" />
  <img src="https://img.shields.io/badge/Lisans-Telife_Tabi-red.svg?style=for-the-badge" alt="Lisans" />
</div>

<br />

**RAADIO TR**, Discord sunucunuz için özenle geliştirilmiş, yüksek performanslı, tamamen Türkçe ve zengin özelliklere sahip modern bir müzik ve radyo botudur. Gelişmiş slash komutları, interaktif buton yapısı ve çoklu platform desteği ile her sunucunun ihtiyacını karşılayabilecek kalite standartlarında tasarlanmıştır.

## 📑 İçindekiler

- [🌟 Öne Çıkan Özellikler](#-öne-çıkan-özellikler)
- [🛑 Gereksinimler](#-gereksinimler)
- [🚀 Kurulum ve Başlangıç](#-kurulum-ve-başlangıç)
  - [Yerel Geliştirme (Local)](#yerel-geliştirme-local)
  - [Üretim Ortamı (PM2 ile Production)](#üretim-ortamı-pm2-ile-production)
- [⚙️ Yapılandırma (.env)](#️-yapılandırma-env)
- [</> Komutlar](#-komutlar)
  - [Müzik Komutları](#müzik-komutları)
  - [Radyo & Sistem Komutları](#radyo--sistem-komutları)
- [🛠️ Teknolojiler](#️-teknolojiler)
- [📜 Lisans](#-lisans)

---

## 🌟 Öne Çıkan Özellikler

- **Geniş Platform Desteği**: YouTube, Spotify, SoundCloud ve daha fazlasından yüksek kalitede müzik oynatma ayrıcalığı.
- **Özel Radyo Sistemi**: Kendi favori radyo istasyonlarınızı (-Stream URL) ekleyin, düzenleyin veya silin; 7/24 kesintisiz müzik keyfi yaşayın.
- **Gelişmiş Buton Kontrolleri**: Şarkı çalarken anlık olarak beliren etkileşimli butonlarla müziğinizi kolayca yönetin:
  - 🛑 Durdur, ⏸️ Duraklat/Devam Et, ⏭️ Geç, 👋 Terket
  - 🔉 Ses Azalt/Artır, 🔀 Karıştır, 🔁 Döngü
- **Akıllı Kanal Yönetimi**: Bot ayrıldığında veya son şarkı bittiğinde otomatik kuyruk temizliği gerçekleştirilir, gereksiz mesajlar engellenir.
- **Modern Slash (`/`) Komutları**: Tüm etkileşimler en hızlı reaksiyonu verecek şekilde yeni nesil Discord Slash komutlarıyla optimize edilmiştir.
- **Çoklu Bot Desteği**: Güçlü PM2 entegrasyonu sayesinde tek makinede birden fazla botu (`raadiotr` ve `raadiotr2`) aktif olarak yönetebilme yeteneği.

---

## � Gereksinimler

Projeyi kendi ortamınızda çalıştırmak için aşağıdaki altyapı bileşenlerinin kurulu olması gereklidir:

- [Node.js](https://nodejs.org/) (v16.9.0 veya daha güncel, stabil performans için **v20+** veya **v22+** önerilir)
- [npm](https://www.npmjs.com/) (Node.js ile birlikte gelir)
- Git (Sürüm kontrolü için)
- Aktif bir Discord Bot Tokeni (ve kayıtlı Application ID'si)
- _(Opsiyonel)_ PM2 (`npm i -g pm2` ile yüklenebilir)

---

## 🚀 Kurulum ve Başlangıç

### 1. Projeyi İndirin

```bash
git clone https://github.com/TalhaTufanN/discord-bot.git
cd discord-bot
```

### 2. Gerekli Kütüphaneleri Yükleyin

```bash
npm install
```

### 3. Yapılandırma Dosyasını Oluşturun

Ana dizinde bir `.env` dosyası oluşturun ve bot bilgilerinizi girin (Detaylar [Yapılandırma](#️-yapılandırma-env) başlığında verilmiştir).

### 4. Slash Komutlarını Discord'a Bildirin (Deploy)

Botun slash komutlarının Discord API'sine kaydedilmesi **zorunludur**. Botu başlatmadan önce sadece bir kere (ya da yeni komut eklendiğinde) şu komutu çalıştırın:

```bash
npm run deploy
```

### 🔹 Yerel Geliştirme (Local)

Botu geliştirme aşamasında konsol üzerinden normal olarak başlatmak veya değişiklikleri anlık görmek için:

```bash
# Sadece başlatma
npm start

# Değişiklikleri anlık izleyerek (nodemon ile) başlatma
npm run dev
```

### 🔹 Üretim Ortamı (PM2 ile Production)

Uygulamanın sunucuda 7/24 kapanmadan kesintisiz çalışması için PM2 altyapısı kullanabilirsiniz. Projede çoklu botları kolaylıkla yönetmek üzere `ecosystem.config.js` dosyası yapılandırılmıştır.

```bash
# PM2'yi global olarak yükleyin (eğer yoksa)
npm install -g pm2

# Tüm botları (-veya tekini) başlat
pm2 start ecosystem.config.js

# Botları monitörlemek ve performans izlemek için
pm2 monit
```

---

## ⚙️ Yapılandırma (.env)

Projenin kök dizininde gizli bir `.env` dosyası oluşturun ve içine uygulama bağlantı değişkenlerinizi tanımlayın:

```env
# -> 1. Ana Bot Değişkenleri
TOKEN=SİZİN_DİSCORD_BOT_TOKENİNİZ
CLIENT_ID=BOTUN_CLIENT_ID_SI

# -> 2. Opsiyonel İkinci Bot Değişkenleri (Çoklu bot kullanacaksanız)
TOKEN2=İKİNCİ_BOT_TOKEN
CLIENT_ID2=İKİNCİ_BOT_CLIENT_ID

# -> 3. Sunucu (Guild) ID (Sadece bu sunucuya hızlı komut yüklemek için önerilir)
GUILD_ID=SUNUCU_ID_NIZ
```

---

## </> Komutlar

Bot, işlevlerine göre ayrılarak gruplandırılmış yüksek performanslı komut setleri sunar.

### Müzik Komutları

| Komut          | Parametre     | Açıklama                                                                                                |
| -------------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| `/çal`         | `<şarkı/url>` | Belirtilen şarkıyı, YouTube/Spotify/Soundcloud çalma listesini veya bir URL'yi yüksek kalitede oynatır. |
| `/durdur`      | Yok           | Tüm müziği anında durdurur ve beklemedeki kuyruğu kalıcı olarak temizler.                               |
| `/duraklat`    | Yok           | Çalmakta olan geçerli şarkıyı sessizce duraklatır.                                                      |
| `/devam`       | Yok           | Daha önce duraklatılmış olan müzik yayınına kaldığı yerden devam eder.                                  |
| `/geç`         | Yok           | O an çalan şarkıyı atlar ve sıradakine geçer. (Eğer sıra boşsa bağlantıyı sonlandırır)                  |
| `/terket`      | Yok           | Botun bulunduğu ses kanalından anında ayrılmasını zorlar.                                               |
| `/ses`         | `<düzey>`     | Etkin dinleyiciler için botun ses seviyesini ayarlar (`0` ile `100` arası).                             |
| `/kuyruk`      | Yok           | Mevcut çalma listesine alınmış şarkıları özel bir sayfa yapısıyla sunar.                                |
| `/mevcutşarkı` | Yok           | Şu an çalan şarkı hakkında (ilerleme süresi, sanatçı, platform vs.) detaylı istatistik ve bilgi verir.  |
| `/karıştır`    | Yok           | Çalma kuyruğundaki şarkıların mevcut sırasını rastgele olacak şekilde karıştırır.                       |
| `/döngü`       | Yok           | Belirlenen döngü modunu geçişli ayarlar (`Kapalı`, `Mevcut Şarkı`, `Tüm Kuyruk`).                       |

### Radyo & Sistem Komutları

| Komut           | Parametre      | Açıklama                                                                                  |
| --------------- | -------------- | ----------------------------------------------------------------------------------------- |
| `/radyo`        | `<istasyon>`   | Önceden kaydedilmiş canlı radyo istasyonlarından (Listeden) birini anında çalmaya başlar. |
| `/radyoekle`    | `<isim> <url>` | Sisteme size özel yeni bir canlı radyo istasyonu (`Steam URL`) ekler.                     |
| `/radyoduzenle` | `<isim> <url>` | Var olan bir radyo istasyonunun adını koruyarak yayın bağlantısını (URL) günceller.       |
| `/radyosil`     | `<isim>`       | Daha önceden kayıtlı bir radyo istasyonunu sistemden kalıcı olarak siler ve temizler.     |
| `/kur`          | Yok            | Sunucunuzun bot kontrol paneli için gelişmiş bir müzik kanal kurulumu gerçekleştirir.     |
| `/yardım`       | Yok            | Botun tüm komutlarını ve mevcut özellikleri barındıran profesyonel yardım menüsünü açar.  |

---

## 🛠️ Teknolojiler

Bu uygulamanın altyapısında aşağıdaki güncel ve güçlü teknolojiler kullanılmaktadır:

- **[Discord.js (v14.19+)](https://discord.js.org/)**: Modern ve hatasız Discord API bağlantısı.
- **[DisTube (v5.2.3)](https://distube.js.org/)**: Ses işlemlerini otonom çözen stabil müzik kütüphanesi.
- **[@discordjs/voice](https://discord.js.org/docs/packages/voice/readme)**: Yüksek donanım verimliliği sunan ses çekirdeği.
- **[FFmpeg](https://ffmpeg.org/)** (`ffmpeg-static`): Medya dönüştürme ve hızlı paket işleme kabiliyetleri.

---

## 📜 Lisans

**© 2026 TalhaTufanN - Tüm Hakları Saklıdır.**

Bu projenin kaynak kodlarının, izinsiz bir şekilde kopyalanması, başka bir isimle paylaşılması, herhangi bir açık/kapalı mecrada dağıtılması veya üzerinde çalışılarak tamamen _sizin eserinizmiş_ gibi gösterilmesi **kesinlikle yasaktır**.

- ❌ **Yasak Olanlar:** Projeyi klonlayıp hiçbir değişiklik yapmadan veya çok az değişiklik göstererek sahiplenmek, kodları alıp başka platformlarda izinsiz dağıtımını gerçekleştirmek.
- ✅ **İzin Verilenler:** Projenin gelişimine destek sağlamak amacıyla hata düzeltmeleri (bug fix) oluşturmak veya özellik eklemek için _Commit/Pull Request_ yapmanız serbesttir ve takdir edilir.

Geliştirici: `TalhaTufanN`. Herhangi bir özel kullanım veya ek talebiniz için doğrudan geliştiriciyle iletişime geçiniz.
