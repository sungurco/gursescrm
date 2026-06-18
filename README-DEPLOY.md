# Gürses CRM — Docker ile Kurulum (Ubuntu 22.04 LXC / VM)

> Bu doküman programı **tek komutla** Docker üzerinde çalıştırmanızı sağlar.
> Önkoşul: Proxmox veya başka bir hipervizör üzerinde **Ubuntu 22.04 LXC veya VM**.

---

## 1) Docker + Docker Compose Kurulumu

Container/VM içine SSH ile bağlanın (`root@CONTAINER_IP`), sonra:

```bash
apt update && apt upgrade -y
apt install -y curl git

# Docker resmi kurulum scripti
curl -fsSL https://get.docker.com | sh

# Çalıştığını doğrula
docker --version
docker compose version
```

Eğer **root değilseniz**, kullanıcıyı `docker` grubuna ekleyin:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

---

## 2) Uygulamayı İndir

```bash
cd /opt
git clone https://github.com/KULLANICI_ADINIZ/REPO_ADI.git gurses-crm
cd gurses-crm
```

> Kodu GitHub'a yedeklemek için Emergent sohbet kutusundaki **"Save to GitHub"** butonunu kullanın.

---

## 3) Yapılandırma

```bash
cp .env.example .env
nano .env
```

`.env` içinde **mutlaka** `JWT_SECRET` değerini değiştirin (rastgele uzun bir string):
```bash
# Hızlıca rastgele üret:
openssl rand -base64 48
```

Çıkan değeri `.env` içindeki `JWT_SECRET=` satırına yapıştırın.

Diğer alanlar opsiyonel (varsayılanlar yeterlidir):
- `DB_NAME=gurses_crm`
- `HTTP_PORT=80` (80 doluysa 8080 yapın)

---

## 4) Çalıştır 🚀

```bash
docker compose up -d --build
```

İlk seferde imajları indirip build eder (~5 dakika). Sonraki başlatmalarda saniyeler içinde açılır.

**Durum kontrolü:**
```bash
docker compose ps
docker compose logs -f backend
```

**Tarayıcıdan erişim:**
```
http://CONTAINER_IP
```

İlk giriş:
- E-posta: `admin@crm.local`
- Şifre: `Admin123!`

⚠️ İlk girişten sonra admin şifresini değiştirin!

---

## 5) Yönetim Komutları

| Amaç | Komut |
|---|---|
| Durumu görüntüle | `docker compose ps` |
| Logları izle | `docker compose logs -f` |
| Sadece backend logu | `docker compose logs -f backend` |
| Durdur | `docker compose down` |
| Yeniden başlat | `docker compose restart` |
| Güncelle ve yeniden build | `git pull && docker compose up -d --build` |
| Veritabanı yedeği | `docker exec gurses_mongo mongodump --archive=/data/db/backup.archive` |

---

## 6) Yedekleme

Tüm kalıcı veri **2 Docker volume**'da:

```bash
# Volume'leri listele
docker volume ls | grep gurses

# Yedek almak için (örnek)
docker run --rm -v gurses-crm_mongo_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/mongo-backup-$(date +%F).tar.gz -C /data .

docker run --rm -v gurses-crm_uploads_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/uploads-backup-$(date +%F).tar.gz -C /data .
```

Bu iki `.tar.gz` dosyasını saklarsanız tüm sistemi geri yükleyebilirsiniz.

---

## 7) Domain ve SSL (Opsiyonel)

Domain bağlamak ve HTTPS aktif etmek için container önüne **Caddy** veya **Nginx Proxy Manager** koyabilirsiniz. En kolay yol:

```bash
# Hosta Caddy kur
apt install -y caddy

# /etc/caddy/Caddyfile içine:
crm.sirketiniz.com {
    reverse_proxy localhost:80
}

systemctl reload caddy
```

Caddy otomatik olarak Let's Encrypt SSL alır. Bitti.

---

## ❓ Sorun Giderme

**Backend başlamıyor:**
```bash
docker compose logs backend
```
Genelde `JWT_SECRET` ayarlanmadığı için olur — `.env`'i kontrol edin.

**MongoDB bağlanmıyor:**
```bash
docker compose logs mongo
docker exec -it gurses_mongo mongosh
```

**Port 80 dolu:**
`.env` içinde `HTTP_PORT=8080` yapın, `docker compose up -d` ile tekrar başlatın.

**Dosya yüklenmiyor:**
Upload boyutu 25MB ile sınırlıdır. Daha büyük dosya için `frontend/nginx.conf` içinde `client_max_body_size` değerini artırın ve yeniden build edin.

---

## 📞 Test Hesapları (ilk açılışta otomatik oluşturulur)

| Rol | E-posta | Şifre |
|---|---|---|
| IT Admin | admin@crm.local | Admin123! |
| Yönetici | manager@crm.local | Manager123! |
| Onay | approval@crm.local | Approval123! |
| Mağaza (Arçelik) | arcelik@crm.local | Store123! |
| Mağaza (Bellona) | bellona@crm.local | Store123! |
| Mağaza (Mondi) | mondi@crm.local | Store123! |

**İlk girişten sonra tüm şifreleri değiştirin!**
