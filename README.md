# RAADIO TR 🎵

**RAADIO TR**, Discord sunucunuz için geliştirilmiş, yüksek performanslı ve tamamen Türkçe arayüze sahip gelişmiş bir müzik botudur.

## 🌟 Özellikler

- **Türkçe Arayüz**: Tüm komutlar, mesajlar ve butonlar tamamen Türkçe.
- **Gelişmiş Kontrol Paneli**: Şarkı çalarken beliren butonlarla müziği kolayca yönetin.
  - 🛑 Durdur, ⏸️ Duraklat/Devam Et, ⏭️ Geç, 👋 Terket
  - 🔉 Ses Azalt/Artır, 🔀 Karıştır, 🔁 Döngü
- **Akıllı Butonlar**:
  - "Geç" butonu, sırada şarkı yoksa müziği sonlandırır.
  - "Terket" butonu, müzik çalsa da çalmasa da botu kanaldan ayırır.
- **Slash Komutları**: Modern Discord `/` komutları ile kolay kullanım.

## 🚀 Kurulum

Bu projeyi kendi sunucunuzda çalıştırmak için aşağıdaki adımları izleyin.

### Gereksinimler

- [Node.js](https://nodejs.org/) (v16.9.0 veya üzeri)
- Bir Discord Bot Tokeni

### Adımlar

1. **Projeyi indirin:**
   ```bash
   git clone https://github.com/TalhaTufanN/discord-bot.git
   cd discord-bot
   ```

2. **Gerekli paketleri yükleyin:**
   ```bash
   npm install
   ```

3. **Ayarları yapılandırın:**
   - `.env` dosyasını oluşturun (örnek `.env.example` dosyasına bakabilirsiniz) ve içine tokeninizi ekleyin:
     ```
     TOKEN=SİZİN_DİSCORD_BOT_TOKENİNİZ
     CLIENT_ID=BOTUNUZUN_ID_Sİ
     ```

4. **Botu başlatın:**
   ```bash
   npm start
   ```

## 🎮 Komutlar

| Komut | Açıklama |
|-------|----------|
| `/çal <şarkı>` | Bir şarkı veya çalma listesi çalar. |
| `/durdur` | Müziği durdurur ve kuyruğu temizler. |
| `/duraklat` | Çalan şarkıyı duraklatır. |
| `/devam` | Duraklatılan şarkıyı devam ettirir. |
| `/geç` | Sıradaki şarkıya geçer. |
| `/terket` | Botu ses kanalından ayırır. |
| `/ses <düzey>` | Ses seviyesini ayarlar (0-100). |
| `/kuyruk` | Çalma kuyruğunu gösterir. |
| `/mevcutşarkı` | Çalan şarkı hakkında bilgi verir. |
| `/karıştır` | Kuyruğu karıştırır. |
| `/döngü` | Döngü modunu değiştirir (Kapalı/Şarkı/Kuyruk). |
| `/yardım` | Yardım menüsünü gösterir. |

## 🛠️ Geliştirici

Bu bot, Distube kütüphanesi kullanılarak geliştirilmiştir.
