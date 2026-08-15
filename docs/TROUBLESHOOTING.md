# مشاكل النشر الشائعة

## `ERR_PNPM_META_FETCH_FAIL` / `ERR_INVALID_THIS` على كل حزمة

**السبب:** Vercel بيشغّل **pnpm 6** (شوف مسار `/pnpm6/` في اللوج). pnpm 6 مع Node 20+ بيرمي `ERR_INVALID_THIS` على كل طلب للـregistry، والنتيجة `ERR_PNPM_META_FETCH_FAIL`.

دي **مش** مشكلة إنترنت ولا حزمة ناقصة — نسخة pnpm قديمة بس.

**وليه اختار نسخة قديمة؟** Vercel بيحدد نسخة pnpm من `lockfileVersion` في `pnpm-lock.yaml`. لما الملف مش موجود، بيرجع لأقدم نسخة. وحقل `packageManager` في `package.json` بيتجاهله من غير corepack.

**الحل — واحد من التلاتة، بالترتيب:**

### 1. الأفضل: ارفع الـlockfile

```bash
cd clinic-platform
corepack enable
pnpm install                    # ينشئ pnpm-lock.yaml بنسخة 9
git add pnpm-lock.yaml && git commit -m "Add pnpm lockfile" && git push
```

Vercel هيقرا `lockfileVersion: '9.0'` ويستخدم pnpm 9 تلقائيًا. وده كمان بيخلي البناء **قابل للتكرار** — من غيره كل deploy ممكن يجيب نسخ مختلفة من المكتبات.

### 2. من غير lockfile: ثبّت النسخة في `vercel.json`

موجود بالفعل في الملف:

```json
"installCommand": "npx --yes pnpm@9.12.0 install --no-frozen-lockfile",
"buildCommand": "npx --yes pnpm@9.12.0 --filter @clinic/web build"
```

`npx` بيجيب pnpm 9.12.0 مباشرة ويتخطى نسخة Vercel المدمجة تمامًا.

> **مهم:** لو في Vercel ← Settings ← General فيه Install/Build Command متكتوبين يدويًا، هما بيغلبوا `vercel.json`. **امسحهم** وسيبهم فاضيين.

### 3. البديل: corepack

Settings ← Environment Variables ← ضيف:

```
ENABLE_EXPERIMENTAL_COREPACK = 1
```

ساعتها Vercel بيحترم `packageManager: pnpm@9.12.0`.

---

## `next: command not found` + `node_modules missing` على Vercel

**السبب:** Vercel شغّل `npm run build` بدل `pnpm`، فالتبعيات ما اتنصبتش أصلًا في `apps/web` وبالتالي مالقاش أمر `next`.

وسبب إن Vercel لجأ لـnpm: **مفيش `pnpm-lock.yaml` في المستودع.** Vercel بيحدد مدير الحزم من ملف الـlock؛ لما ما يلاقيش، بيفترض npm — وnpm ما بيفهمش `workspace:*` اللي كل الـpackages مربوطة بيها.

**الحل — بالترتيب:**

```bash
# 1) على جهازك: أنشئ ملف الـlock (لازم مرة واحدة)
cd clinic-platform
corepack enable
pnpm install

# 2) ارفعه
git add pnpm-lock.yaml .npmrc vercel.json package.json apps/web/next.config.ts
git commit -m "Add pnpm lockfile and Vercel build config"
git push
```

**3) في Vercel** → Settings ← General:

| الإعداد | القيمة |
|---|---|
| Root Directory | `.` (جذر المستودع، **مش** `apps/web`) |
| Framework Preset | Next.js |
| Install Command | `pnpm install` |
| Build Command | `pnpm --filter @clinic/web build` |
| Output Directory | `apps/web/.next` |

الإعدادات دي موجودة في `vercel.json` وVercel بيقراها تلقائيًا، لكن لو الواجهة فيها قيم يدوية قديمة فهي بتغلب على الملف — امسحها.

**4) Settings ← Environment Variables** — ضيف الـ`NEXT_PUBLIC_FIREBASE_*` الستة على الأقل. من غيرهم الـbuild بينجح لكن تسجيل الدخول بيقع وقت التشغيل.

---

## `No Next.js version detected`

**السبب:** Root Directory مضبوط على جذر المستودع، و`next` مش في `package.json` بتاع الجذر — هو في `apps/web/package.json`. Vercel بيدوّر على `next` في نفس المجلد اللي أنت مأشر عليه بالظبط.

**الحل (طريقة Vercel الرسمية للـmonorepo):**

Settings ← General ← **Root Directory** = `apps/web`

وملف `apps/web/vercel.json` بيتكفّل بالباقي:

```json
{
  "framework": "nextjs",
  "installCommand": "cd ../.. && npx --yes pnpm@9.12.0 install --no-frozen-lockfile",
  "buildCommand": "npx --yes pnpm@9.12.0 build"
}
```

الـinstall بيرجع للجذر عشان pnpm يشوف الـworkspace كله وينصّب كل الـpackages، والـbuild بيتنفّذ جوه `apps/web`.

> لما Root Directory بيتظبط، Vercel بيقرا `vercel.json` من **نفس المجلد ده** مش من الجذر. عشان كده الملف اتنقل لـ`apps/web/`، والقديم في الجذر اتشال عشان ما يبقاش فيه ملفين متعارضين.

---

## `Module not found: Can't resolve '@clinic/core'`

الـpackages مربوطة بـ`workspace:*`. لو ظهر الخطأ ده:
- تأكد إن Root Directory هو جذر المستودع مش `apps/web`
- تأكد إن `pnpm-workspace.yaml` مرفوع
- `node-linker=hoisted` في `.npmrc` بيحل أغلب حالات فشل الـresolution على المنصات المستضافة

---

## الـbuild بينجح والصفحات بتقع بـ500

غالبًا `FIREBASE_PRIVATE_KEY`. القيمة لازم تتلصق **بالكامل** مع `\n` كنص حرفي:

```
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvg...\n-----END PRIVATE KEY-----\n
```

لو اتلصق بأسطر حقيقية بدل `\n`، Vercel بيقصّه عند أول سطر جديد والتحقق بيفشل بصمت.

---

## `output: standalone` وVercel

`standalone` للـDocker بس. على Vercel بيغيّر شكل المخرجات ويكسر النشر. في `next.config.ts` بقى مشروطًا بـ`BUILD_TARGET=docker`، والـDockerfile بيحطه بنفسه.

---

## قبل أي push للإنتاج

```bash
pnpm install
pnpm typecheck
pnpm build      # لازم ينجح محليًا الأول
```

الكود ده **لسه ما اتعملش له build ناجح ولا مرة**. أول `pnpm install` هيطلّع غالبًا أخطاء TypeScript في الـimports بين الـpackages — دي متوقعة وطبيعية في أول تشغيل، وتتصلح واحدة واحدة.
