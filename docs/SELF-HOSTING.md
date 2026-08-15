# رفع المشروع على GitHub والاستضافة على سيرفر العميل

---

# الجزء الأول — GitHub

## قبل أول `git init` — خطوة واحدة لا يمكن التراجع عنها

تأكد إن مفيش أي secret في الملفات:

```bash
grep -rn "BEGIN PRIVATE KEY" . --exclude-dir=node_modules
find . -name ".env*" -not -name ".env.example"
```

لو ظهر أي ناتج، امسحه **قبل** أول commit. الملف اللي بيتعمله commit مرة واحدة بيفضل في تاريخ الـgit للأبد، وحذفه بعدين مش بيمسحه.

## الرفع

```bash
cd clinic-platform

git init
git add .
git status                 # راجع القائمة — لازم .env.example بس، مفيش .env
git commit -m "Clinic platform foundation: auth, branches, attendance, accounting, inventory"

git branch -M main
git remote add origin git@github.com:<حسابك>/clinic-platform.git
git push -u origin main
```

## إعدادات المستودع بعد الرفع

| الإعداد | القيمة | ليه |
|---|---|---|
| Visibility | **Private** | فيه بنية نظام طبي كامل |
| Settings ← Branch protection على `main` | Require PR + require CI | يمنع دفع كود مكسور للإنتاج |
| Settings ← Secret scanning | مفعّل | ينبّه لو مفتاح اترفع بالغلط |
| Settings ← Dependabot alerts | مفعّل | ثغرات المكتبات |
| Actions ← Workflow permissions | Read only | يقلّل ضرر أي workflow مخترق |

الـCI موجود في `.github/workflows/ci.yml` وبيعمل typecheck + lint + tests + build، وبيفشل لو أي `.env` اتعمله tracking.

## فروع العمل

```
main       → الإنتاج. مقفول، بيتغير بـPR فقط
develop    → التطوير اليومي
feature/*  → كل ميزة لوحدها
```

---

# الجزء الثاني — الاستضافة على سيرفر العميل

## الأول: قرار لازم يتاخد

في حالتين مختلفتين تمامًا لما العميل يقول «عايز الاستضافة عندي»:

**(أ) عايز التطبيق عنده، والبيانات تفضل على Firebase**
سهل. اللي في الملفات دي كفاية: Docker + Nginx وخلاص. بس **البيانات لسه على سيرفرات Google**، وده غالبًا مش اللي العميل قاصده لما بيطلب استضافة داخلية لبيانات مرضى.

**(ب) عايز كل حاجة عنده — بيانات وكل شيء**
ده يعني الخروج من Firebase بالكامل: Firestore → PostgreSQL، Firebase Auth → بديل مستضاف (Keycloak أو Auth ذاتي)، Firebase Storage → MinIO.
المعمارية جاهزة للنقلة دي — `packages/services` مش عارفة Firestore أصلًا، بتتعامل مع interfaces بس. لكن دي **شغل حقيقي، مش تبديل إعدادات**: تقديري 3–5 أسابيع لكتابة طبقة Postgres والـmigrations والـauth البديل والاختبارات.

**اسأل العميل الأول.** ودي نفس النقطة اللي أنا مثيرها من أول رسالة عن Postgres — لو الإجابة (ب)، يبقى القرار اتحسم ونبدأ الترحيل بدل ما نكمل بناء على Firestore ونرجع بعدين.

الباقي هنا بيغطي الحالة (أ).

---

## متطلبات السيرفر

| العنصر | الحد الأدنى | المريح |
|---|---|---|
| المعالج | 2 vCPU | 4 vCPU |
| الذاكرة | 4 GB | 8 GB |
| القرص | 40 GB SSD | 80 GB SSD |
| النظام | Ubuntu 22.04 / 24.04 LTS | نفسه |

---

## خطوات التجهيز

### 1. تأمين السيرفر قبل أي حاجة

```bash
# مستخدم غير root
adduser deploy && usermod -aG sudo deploy

# مفاتيح SSH بدل الباسورد
ssh-copy-id deploy@<server-ip>
sudo nano /etc/ssh/sshd_config
#   PermitRootLogin no
#   PasswordAuthentication no
sudo systemctl restart ssh

# الجدار الناري — 22 و80 و443 بس
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443
sudo ufw enable

# حماية من محاولات الدخول المتكررة
sudo apt install -y fail2ban && sudo systemctl enable --now fail2ban

# تحديثات أمنية تلقائية
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

**السيرفر اللي فيه بيانات مرضى وSSH بباسورد = مسألة وقت.** الخطوة دي مش اختيارية.

### 2. Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
```

### 3. الكود والأسرار

```bash
sudo mkdir -p /srv/clinic && sudo chown deploy:deploy /srv/clinic
cd /srv/clinic
git clone git@github.com:<حسابك>/clinic-platform.git .

# ملف الأسرار — صلاحياته لازم تكون 600
cp .env.example .env.production
nano .env.production
chmod 600 .env.production
```

`.env.production` **مش** في الـgit. كل مرة تعمل فيها deploy جديد بيفضل مكانه.

### 4. التشغيل

```bash
docker compose up -d --build
docker compose logs -f web        # اتأكد إنه قام
curl -s localhost:3000/api/health # لازم يرجع {"status":"ok"}
```

### 5. Nginx و TLS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

sudo cp deploy/proxy_params /etc/nginx/proxy_params
sudo cp deploy/nginx.conf /etc/nginx/sites-available/clinic
sudo nano /etc/nginx/sites-available/clinic     # غيّر app.example.com
sudo ln -s /etc/nginx/sites-available/clinic /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo certbot --nginx -d app.example.com
sudo nginx -t && sudo systemctl reload nginx
```

شهادة Let's Encrypt بتتجدد تلقائيًا. تأكد: `sudo certbot renew --dry-run`.

> Nginx هنا بيعمل **rate limiting** اللي التطبيق لسه مش عامله: 5 محاولات دخول في الدقيقة و60 طلب API. ده أرخص وأصعب في التحايل عليه من التنفيذ داخل التطبيق.

### 6. التحديثات

```bash
cd /srv/clinic
git pull origin main
docker compose up -d --build
docker image prune -f
```

**بديل بدون Docker:** `deploy/clinic.service` فيه ملف systemd مع تقييدات أمنية (`ProtectSystem=strict`, `NoNewPrivileges`)، والأسرار في `/etc/clinic/env` بصلاحيات root.

---

## النسخ الاحتياطي

مهم تفهم: **البيانات مش على السيرفر ده** في الحالة (أ) — هي على Firestore. النسخ الاحتياطي بيتعمل من Firebase Console (Backups ← جدولة يومية، احتفاظ 30 يوم)، مش من السيرفر.

اللي على السيرفر محتاج نسخة منه:
- `.env.production` — مرة واحدة، في مكان آمن خارج السيرفر
- شهادات Nginx — بتتجدد تلقائي، مش محتاجة نسخ

**واختبر الاسترجاع مرة على الأقل.** نسخة احتياطية محدش جرّب يرجّعها مش نسخة احتياطية.

---

## المراقبة

الحد الأدنى:
- `docker compose logs` بيتدوّر تلقائيًا (مضبوط في compose: 10MB × 5)
- Uptime monitor خارجي على `/api/health` — أي خدمة مجانية تنفع
- تنبيه على مساحة القرص عند 80%

---

## checklist ما قبل التسليم للعميل

- [ ] SSH بمفاتيح فقط، root login مقفول
- [ ] `ufw` شغّال، 22/80/443 بس
- [ ] `fail2ban` شغّال
- [ ] HTTPS شغّال وHSTS ظاهر في الـheaders
- [ ] `.env.production` صلاحياته 600 ومش في git
- [ ] الحاويات مش شغالة كـroot (متحقق منه في الـDockerfile)
- [ ] `curl -I https://<domain>` بيرجع headers الأمان
- [ ] Firestore backups مجدولة، والاسترجاع متجرّب
- [ ] كل موظف له حساب باسمه — مفيش حساب استقبال مشترك
- [ ] **اختبار اختراق قبل دخول أي بيانات مرضى حقيقية**
