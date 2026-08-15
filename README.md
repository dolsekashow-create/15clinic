# Clinic Platform — منصة إدارة العيادات متعددة الفروع

نظام Enterprise لإدارة أكثر من 15 فرعًا: الحجوزات، حضور وانصراف العملاء، المحاسبة، الصلاحيات، وسجل العمليات.
Arabic-first / RTL · Next.js · TypeScript · Firebase.

> **حالة المشروع:** Foundation + وحدات الحضور والمحاسبة والمخازن + الموقع العام ولوحة التحكم (هيكل وشاشات أساسية).
> التطبيق الجوّال لم يُبنَ بعد. الشاشات تقرأ حاليًا من `src/data/demo.ts` حتى ربط الـAPI.
> **لم يُشغَّل على مشروع Firebase حقيقي بعد** — راجع `docs/DEPLOYMENT.md`.
> كل ما يعتمد على قرار من العميل مُعلَّم `BUSINESS_RULE_PENDING` أو `DECISION_PENDING` ولم يُخترع.

---

## البنية

تطبيق Next.js واحد. الطبقات مجلدات تحت `src/server/` وليست حزم منفصلة — بنية بسيطة تُنشر على أي منصة بصفر إعدادات.

```
src/app/            الصفحات + API routes تحت /api/v1
src/components/     الواجهة والـdesign system
src/lib/            Firebase client، جلسة الخادم
src/data/           بيانات demo مؤقتة للشاشات
src/server/core     الكيانات، Zod schemas، كتالوج الصلاحيات، الأخطاء
src/server/data     Repositories — نقطة فرض عزل الفروع الوحيدة
src/server/services منطق العمل: الحضور، المحاسبة، المخازن، المستخدمون، سجل العمليات
src/server/auth     الجلسة، حل الصلاحيات، withAuth guard
src/server/infra    Firebase Admin، اللوج، مزوّدو الإشعارات
scripts/seed.ts     بيانات التطوير (isDemo: true)
```

الفصل بين الطبقات اتفاق هندسي: `src/app` لا يستورد من `src/server/data` مباشرة — يمر على `src/server/services`.

> الحزم المنفصلة (pnpm workspaces) اتشالت عمدًا: كانت بتكلّف أخطاء نشر متكررة من غير فايدة حقيقية قبل ما يبقى فيه تطبيق موبايل يشارك الكود. لو اتبنى لاحقًا، `src/server/core` جاهز للاستخراج كحزمة.

---

## التشغيل

```bash
npm install

cp .env.example .env.local     # ثم املأ القيم
# FIREBASE_PRIVATE_KEY يُلصق كسطر واحد مع الإبقاء على \n

npm run seed                   # ينشئ المؤسسة والفروع والصلاحيات وشجرة الحسابات
npm run dev
```

**النشر على Vercel:** استورد المستودع واضغط Deploy. Root Directory = `./`، مفيش أوامر مخصصة، مفيش `vercel.json`.

نشر قواعد Firestore والفهارس:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage:rules
```

---

## نقاط تصميم مهمة

**العزل بين الفروع** يُفرض في `packages/data/src/firestore/base-repository.ts` وحده.
`organizationId` يُؤخذ دائمًا من `AccessContext` ولا يُقبل من العميل إطلاقًا، وأي كتابة على فرع خارج نطاق المستخدم تُرفض بـ403.

**الصلاحيات لا تُخزَّن في Firebase Custom Claims.** الـToken يعيش ساعة كاملة، وتغيير دور المستخدم يجب أن يسري من الطلب التالي لا بعد ساعة. تُحلّ من قاعدة البيانات مع Cache قصير (30 ثانية) قابل للإبطال.

**المحاسبة قيد مزدوج (Double Entry).** كل قيد مُرحَّل متوازن، وغير قابل للتعديل — التصحيح يتم بقيد عكسي. المبالغ أعداد صحيحة بالقروش؛ لا يوجد `float` في أي مكان بالنظام المالي.

**الحضور منفصل عن الحجز.** الزيارة (`visits`) كيان مستقل: العميل الـwalk-in له زيارة بلا حجز، والحجز الذي لم يحضر صاحبه يبقى بلا زيارة — فيصبح تقرير الـno-show استعلامًا مباشرًا لا تخمينًا. رقم الدور يُخصَّص داخل Transaction حتى لا يحصل موظفان على نفس الرقم.

**قواعد Firestore طبقة دفاع ثانية**، لا الأساس. كل الحركة تمر عبر الخادم بـAdmin SDK؛ القواعد تمنع الوصول المباشر من العميل.

---

## التوثيق

| الملف | المحتوى |
|---|---|
| `docs/00-FOUNDATION-PLAN.md` | القرارات المعمارية وخطة قاعدة البيانات |
| `docs/API.md` | مسارات الـAPI والقواعد الثابتة |
| `docs/ACCOUNTING.md` | نموذج المحاسبة والقيود الآلية |
| `docs/ATTENDANCE.md` | دورة حياة الزيارة |
| `docs/INVENTORY.md` | نموذج المخزون والحركات |
| `docs/SECURITY.md` | نموذج التهديدات والضوابط |
| `docs/DEPLOYMENT.md` | **التشغيل والنشر خطوة بخطوة + تأمين ما قبل الإطلاق** |
| `docs/SELF-HOSTING.md` | الرفع على GitHub والاستضافة على سيرفر العميل |
| `docs/TROUBLESHOOTING.md` | مشاكل النشر الشائعة وحلولها |

---

## ما تبقّى

- [x] شاشتا المستخدمين والاستقبال مربوطتان بالخدمات فعليًا (fallback لـdemo قبل الإعداد)
- [ ] باقي الشاشات: العملاء، الحجوزات، الفواتير، القيود، سجل العمليات، الإعدادات
- [ ] routes ناقصة: customers, appointments, branches, doctors, services, audit-logs, files
- [ ] الإشعارات: ربط مزوّد فعلي — `DECISION_PENDING`
- [ ] تطبيق العميل (Mobile)
- [ ] Rate limiting: الـinterface جاهز، المزوّد `DECISION_PENDING`
- [ ] أول `pnpm install` وتشغيل فعلي على staging
