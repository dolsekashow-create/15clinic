# Clinic Platform — Phase 0
## Architecture Overview + Folder Structure + Database Foundation Plan

> لا يوجد أي Code في هذه المرحلة. هذه وثيقة قرار (Decision Document) للمراجعة قبل التنفيذ.
> كل ما هو غير مؤكد من العميل مُعلَّم بـ `BUSINESS_RULE_PENDING` أو `DECISION_PENDING`.

---

# الجزء الأول — Architecture Overview

## 1.1 النمط المعماري: Modular Monolith داخل Monorepo

**القرار:** تطبيق واحد (Next.js) يحتوي على الـWeb Dashboard والـAPI معًا، لكن الكود مقسّم إلى **packages مستقلة بحدود صارمة**، بحيث يمكن استخراج أي module لخدمة منفصلة لاحقًا دون إعادة كتابة.

**السبب:**
- 15+ فرعًا لشركة واحدة = قاعدة بيانات واحدة ومنطق مترابط. الـMicroservices هنا تعقيد بلا مقابل في هذه المرحلة.
- الفريق (حاليًا) صغير. الـMonolith المنظم أسرع في التطوير وأسهل في الـDebugging.
- الحدود بين الطبقات (packages) هي التي تحمي من الفوضى، وليس فصل الخوادم.

**متى نخرج عن هذا؟** إذا احتاج module معيّن (مثل التقارير الثقيلة أو مزامنة المخازن) موارد أو دورة نشر مختلفة، يُستخرج إلى `services/` لأنه أصلًا package مستقل لا يعتمد على Next.js.

---

## 1.2 الطبقات (Layers)

```
┌─────────────────────────────────────────────────────────┐
│  Presentation                                            │
│  Next.js App Router — Server Components + Client UI      │
│  apps/web/src/app , apps/web/src/features                │
└──────────────────────┬──────────────────────────────────┘
                       │ (HTTP أو Server Action)
┌──────────────────────▼──────────────────────────────────┐
│  Transport / API Layer                                   │
│  Route Handlers /api/v1/* + withAuth guard + Zod validate│
│  apps/web/src/app/api                                    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Application Services (Use Cases)                        │
│  منطق العمل، حدود الـtransaction، إصدار Audit + Events   │
│  packages/services                                       │
└──────────────────────┬──────────────────────────────────┘
                       │ (Repository Interfaces فقط)
┌──────────────────────▼──────────────────────────────────┐
│  Domain                                                  │
│  Entities, Value Objects, Zod Schemas, Permission Catalog│
│  packages/core                                           │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Data Access                                             │
│  IUserRepository … + FirestoreUserRepository             │
│  packages/data                                           │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Infrastructure                                          │
│  Firebase Admin, Storage, Notification Providers, Logger │
│  packages/infra                                          │
└──────────────────────────────────────────────────────────┘
```

**القواعد الصارمة (تُفرض بـ ESLint `no-restricted-imports`):**

| الطبقة | مسموح لها تستورد | ممنوع عليها |
|---|---|---|
| Presentation | `api-contracts`, `ui`, `core` (types فقط) | `data`, `infra`, `firebase-admin` |
| API Layer | `services`, `auth`, `core` | `data` مباشرة |
| Services | `core`, `data` (interfaces) | `firebase-admin` مباشرة، أي شيء من Next.js |
| Data | `core`, `infra` | `services` |
| Core | لا شيء (zero dependencies عدا zod) | كل شيء |

**نقطة أساسية:** الـServer Actions مسموحة للنماذج داخل الـDashboard، **لكن يجب أن تستدعي نفس Application Service** الذي يستدعيه الـAPI Route. لا يوجد منطق عمل مكرر في مكانين. الـMobile App سيستهلك `/api/v1/*` وسيحصل على نفس السلوك بالضبط.

---

## 1.3 Authentication Strategy

**الهوية (Identity):** Firebase Authentication — Email/Password الآن، مع بقاء Phone/OTP مفتوحًا للـMobile App لاحقًا.

**الجلسة (Session):**
1. العميل يسجّل الدخول عبر Firebase Client SDK ويحصل على `idToken`.
2. يُرسل `idToken` إلى `POST /api/v1/auth/session`.
3. الخادم يتحقق منه بـ Firebase Admin ثم ينشئ **Session Cookie** (`httpOnly`, `secure`, `sameSite=lax`, مدة 5 أيام).
4. كل طلب لاحق يعتمد على الـCookie فقط — لا يُخزَّن أي token في `localStorage`.

**لماذا Session Cookie وليس Bearer Token في المتصفح؟** لأن الـ`httpOnly` cookie لا يمكن قراءته من JavaScript، فيحمي من XSS token theft، ويعمل بشكل طبيعي مع Server Components.

**الـMobile App:** يستخدم Bearer `idToken` مباشرة في الـheader (الأنسب لتطبيق native). طبقة `resolveAccessContext()` تقبل المصدرين وتُخرج نفس الـContext.

**Custom Claims:** تُخزَّن فيها فقط بيانات مستقرة وصغيرة:
```ts
{ organizationId: string, isSuperAdmin: boolean, tokenVersion: number }
```
**لا تُخزَّن الصلاحيات في الـClaims** — لأنها ستتقادم (stale) عند تغيير دور المستخدم، ولأن حجم الـtoken محدود (1KB). الصلاحيات تُحلّ من قاعدة البيانات في كل طلب مع Cache قصير الأجل.

**إبطال الجلسة (Revocation):** حقل `tokenVersion` على المستخدم؛ عند التعطيل أو تغيير كلمة المرور يُزاد الرقم ويُستدعى `revokeRefreshTokens()`، فتُرفض الجلسات القديمة.

**حالة الحساب:** `users.status ∈ { active, suspended, pending, disabled }` — يُفحص في كل طلب. المستخدم غير الـ`active` يُرفض حتى لو كان الـtoken صالحًا.

**ممنوع:** تخزين كلمات المرور يدويًا، أي تخزين لـSecrets في الـFrontend، أو تمرير Firebase Admin credentials إلى المتصفح.

---

## 1.4 Authorization Strategy

### AccessContext
كل طلب يُبنى له كائن واحد يمثّل هوية الطالب وصلاحياته:

```ts
interface AccessContext {
  userId: string;
  organizationId: string;
  isSuperAdmin: boolean;
  roleIds: string[];
  permissions: Set<string>;        // "appointments.update" ...
  branchIds: string[];             // الفروع المسموح بها فعليًا
  scope: 'GLOBAL' | 'ORGANIZATION' | 'BRANCH';
}
```

### مستويات النطاق (Scope Levels)
| المستوى | المعنى |
|---|---|
| `GLOBAL` | Super Admin — يتجاوز حدود المؤسسة (للصيانة فقط) |
| `ORGANIZATION` | يرى كل فروع الشركة (Company Admin, Accountant) |
| `BRANCH` | مقيّد بفروع محددة (Branch Manager, Receptionist, Doctor) |
| `DEPARTMENT` | مقيّد بقسم داخل فرع — `DECISION_PENDING` هل يحتاجه العميل فعلًا |
| `SELF` | بياناته فقط (مثال: الطبيب يرى مواعيده هو) |

### ربط الدور بالنطاق
`user_roles` يحمل `branchId` قابلًا لأن يكون `null`:
- `branchId = null` → الدور ممنوح على مستوى المؤسسة.
- `branchId = "br_3"` → نفس المستخدم يمكن أن يكون **Branch Manager في فرع 3** و**Receptionist في فرع 7**.

هذا يحل مشكلة واقعية في الشركات متعددة الفروع دون تغيير في الـSchema لاحقًا.

### كتالوج الصلاحيات
يُعرَّف كثابت مكتوب بـTypeScript في `packages/core/permissions.ts` (وليس كسجلات حرة في قاعدة البيانات فقط)، ثم يُزرع في مجموعة `permissions` لعرضه في واجهة إدارة الأدوار. الفائدة: أخطاء الكتابة تُكتشف وقت الـCompile.

```
users.view | users.create | users.update | users.delete | users.assign_role
branches.view | branches.create | branches.update
departments.view | departments.create | departments.update
roles.view | roles.create | roles.update | roles.delete
customers.view | customers.create | customers.update | customers.delete
doctors.view | doctors.create | doctors.update
services.view | services.create | services.update
appointments.view | appointments.view_all_branches | appointments.create
appointments.update | appointments.cancel | appointments.reschedule
notifications.view | notifications.send
audit_logs.view
reports.view
settings.view | settings.update
inventory.*   → BUSINESS_RULE_PENDING (لن تُنفّذ الآن، الكتالوج قابل للتوسعة)
accounting.*  → BUSINESS_RULE_PENDING
```

### الفرض على مستوى الخادم
```ts
export const POST = withAuth(handler, {
  permission: 'appointments.create',
  scope: 'BRANCH',           // يجب أن يكون branchId المستهدف ضمن ctx.branchIds
});
```
الـFrontend يخفي الأزرار باستخدام نفس `permissions` القادمة مع بيانات الجلسة — **لكن هذا تحسين تجربة استخدام فقط، ولا يُعتد به أمنيًا**.

---

## 1.5 Multi-Branch Data Isolation Strategy

هذه أخطر نقطة في النظام، ولذلك تُعالَج في مكان واحد فقط لا في كل query.

**القواعد:**

1. كل مستند قابل للعزل يحمل `organizationId`، ويحمل `branchId` إن كان تابعًا لفرع (يكون `null` للكيانات على مستوى الشركة).
2. **لا يُقبل `organizationId` أو `branchId` من جسم الطلب في عمليات القراءة إطلاقًا.** يُشتق من `AccessContext`.
3. في الكتابة، الـ`branchId` المرسل يُتحقق من انتمائه لـ`ctx.branchIds` قبل أي شيء آخر.
4. `BaseRepository` يفرض الفلترة تلقائيًا:
   ```ts
   query.where('organizationId', '==', ctx.organizationId)
        .where('branchId', 'in', ctx.branchIds)   // عند scope = BRANCH
   ```
   لا يوجد repository method يقبل استعلامًا خامًا بدون `AccessContext`.
5. **حد Firestore:** عامل `in` محدود بـ30 عنصرًا. مع 15 فرعًا الوضع آمن، لكن عند تجاوز 30 فرعًا للمستخدم الواحد يتحوّل الاستعلام تلقائيًا إلى `ORGANIZATION` scope مع فلترة بعدية، أو تقسيم الاستعلام (chunking). هذا مُوثَّق في `BaseRepository` مع اختبار يغطيه.
6. Firestore Security Rules = **طبقة دفاع ثانية**، وليست الأساس. الـClient SDK يُمنع من القراءة المباشرة للمجموعات الحساسة؛ كل شيء يمر عبر الخادم.
7. اختبارات إلزامية في Phase 11:
   - مستخدم فرع A لا يستطيع قراءة موعد في فرع B (بالـID المباشر).
   - مستخدم فرع A لا يستطيع تعديل/إلغاء موعد فرع B.
   - مستخدم فرع A لا يظهر له عميل مرتبط بفرع B فقط.
   - محاولة تمرير `branchId` مزيّف في الـbody تُرفض بـ403.

---

## 1.6 Audit Logging

- يُستدعى `AuditService.record()` من داخل **Application Service**، لا من الـRepository (لأن الـRepository لا يعرف نية العملية).
- المحتوى: `actorId, action, entityType, entityId, branchId, organizationId, before, after, ip, userAgent, requestId, timestamp`.
- `before/after` تمرّ على **redaction list** تحذف الحقول الحساسة (tokens, secrets, أي حقل مُعلَّم `@sensitive`).
- `audit_logs` مجموعة **append-only**: قواعد Firestore تمنع `update` و`delete` تمامًا، حتى للـAdmin.
- التسجيل لا يُفشل العملية الأساسية: يُنفّذ بعد نجاح الكتابة، وأي فشل فيه يُسجَّل كـerror log مع تنبيه.

---

## 1.7 Notifications Architecture

```ts
interface NotificationProvider {
  channel: 'push' | 'email' | 'sms' | 'whatsapp';
  send(msg: NotificationMessage): Promise<DeliveryResult>;
}
```
- المرحلة الحالية: `InAppProvider` (يكتب في مجموعة `notifications` فقط) + `NoopProvider` يسجّل في اللوج.
- FCM / Email / SMS / WhatsApp تُضاف لاحقًا بتنفيذ نفس الـinterface — **لن يُربط أي مزوّد مدفوع قبل تحديده من العميل** (`DECISION_PENDING`).
- سجل الإشعار يُحفظ دائمًا بغض النظر عن القناة، مع `readAt` لحالة مقروء/غير مقروء.

---

## 1.8 File Storage

- الرفع لا يمر عبر الخادم: الخادم يصدر **Signed Upload URL** بعد التحقق من الصلاحية ونوع الملف وحجمه.
- بيانات الملف الوصفية في مجموعة `files` مع `organizationId, branchId, ownerType, ownerId`.
- التحميل عبر Signed URL قصير الأجل (5 دقائق) يصدره الخادم بعد فحص الصلاحية. **لا يوجد bucket عام.**
- المسار: `orgs/{orgId}/branches/{branchId}/{ownerType}/{ownerId}/{fileId}`.

---

## 1.9 Error Handling

```ts
class AppError extends Error {
  code: string;        // 'FORBIDDEN_BRANCH_ACCESS'
  httpStatus: number;
  safeMessage: string; // رسالة عربية آمنة للعرض
  details?: unknown;   // للّوج فقط
}
```
شكل الاستجابة الموحّد:
```json
{ "error": { "code": "FORBIDDEN_BRANCH_ACCESS", "message": "لا تملك صلاحية الوصول لهذا الفرع", "requestId": "req_9f2..." } }
```
في الـProduction: لا Stack Trace، لا رسائل قاعدة بيانات، لا أسماء حقول داخلية. الـ`requestId` هو الجسر بين شكوى المستخدم وسجلات الخادم.

---

## 1.10 API Conventions

- REST تحت `/api/v1/` — الترقيم من اليوم الأول لأن الـMobile App سيُنشر بشكل مستقل عن الويب.
- التحقق بـZod على مستوى الـboundary؛ الـtypes مشتقة من الـschema (`z.infer`) فلا يوجد تعريف مزدوج.
- Pagination بـcursor (`?limit=25&cursor=...`) وليس offset — أنسب لـFirestore ولا يكسر عند إدراج سجلات جديدة.
- `Idempotency-Key` header إلزامي على إنشاء المواعيد لمنع الحجز المزدوج من التطبيق عند ضعف الشبكة.
- Rate limiting على مسارات الـauth والبحث. المزوّد `DECISION_PENDING` (Upstash Redis أو عدّاد Firestore) — الـinterface جاهز.
- كل الـcontracts تُصدَّر من `packages/api-contracts` ليستخدمها الـMobile App كـsource of truth.

---

## 1.11 ملاحظة هندسية مهمة أرجو قرارك فيها — `DECISION_PENDING`

Firestore ممتاز للـAuth والمواعيد والإشعارات والملفات. لكنه **ضعيف تحديدًا في الوحدات التي ذكرتها للمستقبل**: الحسابات، المخازن، والتقارير. الأسباب واقعية:

- لا JOIN ولا `GROUP BY`؛ كل تقرير مركّب يتطلب denormalization يدوي أو تصدير خارجي.
- لا قيود Foreign Key ولا Unique Constraints مفروضة من المحرك.
- الـTransactions محدودة (500 مستند)، وهذا مؤلم في ترحيل المخزون بين 15 فرعًا.
- التكلفة تُحسب بعدد القراءات — التقارير التي تمسح آلاف السجلات تصبح مكلفة بشكل غير خطي.

**ثلاثة خيارات:**
1. Firestore لكل شيء + تصدير دوري إلى BigQuery للتقارير. (أسرع بداية، تعقيد لاحق)
2. **Firestore للـAuth/Storage/Push + PostgreSQL للبيانات التشغيلية.** (الأقوى للحسابات والمخازن)
3. Firestore الآن، وترحيل الوحدات المالية إلى Postgres عند تأكيد متطلباتها.

**توصيتي:** الخيار 3 مع تنفيذ الخيار 2 عند الحاجة. الـArchitecture أعلاه يجعل هذا الترحيل ممكنًا لأن `packages/services` لا يعرف Firestore إطلاقًا — يعرف interfaces فقط. لكن القرار قرارك، وسيتضح أكثر بعد اجتماع المتطلبات. لهذا السبب الـSchema أدناه مكتوب بشكل **relational-friendly** (مفاتيح صريحة، لا تداخل عميق) حتى لو نُفّذ على Firestore.

---

# الجزء الثاني — Folder Structure

```
clinic-platform/
├─ apps/
│  ├─ web/                              # Next.js — Dashboard + API v1
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  │  ├─ (auth)/
│  │  │  │  │  ├─ login/page.tsx
│  │  │  │  │  └─ forgot-password/page.tsx
│  │  │  │  ├─ (dashboard)/
│  │  │  │  │  ├─ layout.tsx            # Sidebar + Topbar + BranchSwitcher
│  │  │  │  │  ├─ page.tsx              # نظرة عامة
│  │  │  │  │  ├─ customers/
│  │  │  │  │  ├─ appointments/
│  │  │  │  │  ├─ doctors/
│  │  │  │  │  ├─ services/
│  │  │  │  │  ├─ branches/
│  │  │  │  │  ├─ users/
│  │  │  │  │  ├─ roles/
│  │  │  │  │  ├─ notifications/
│  │  │  │  │  ├─ audit-logs/
│  │  │  │  │  └─ settings/
│  │  │  │  ├─ api/
│  │  │  │  │  └─ v1/
│  │  │  │  │     ├─ auth/{session,logout,me}/route.ts
│  │  │  │  │     ├─ branches/route.ts
│  │  │  │  │     ├─ branches/[id]/route.ts
│  │  │  │  │     ├─ users/…  roles/…  customers/…
│  │  │  │  │     ├─ doctors/…  services/…  appointments/…
│  │  │  │  │     ├─ notifications/…  files/…
│  │  │  │  │     └─ _lib/{withAuth,respond,handleError}.ts
│  │  │  │  ├─ layout.tsx               # dir="rtl" lang="ar"
│  │  │  │  └─ globals.css
│  │  │  ├─ features/                   # UI مقسّم حسب المجال
│  │  │  │  ├─ customers/{components,hooks,queries}
│  │  │  │  ├─ appointments/…
│  │  │  │  └─ …
│  │  │  ├─ components/                 # مكونات تخطيط مشتركة
│  │  │  │  ├─ layout/{Sidebar,Topbar,Breadcrumbs,BranchSwitcher}
│  │  │  │  └─ shared/{DataTable,PageHeader,EmptyState,ErrorState}
│  │  │  ├─ lib/{firebase-client,api-client,session,format}.ts
│  │  │  └─ middleware.ts               # حماية المسارات + requestId
│  │  ├─ public/
│  │  ├─ .env.example
│  │  └─ next.config.ts
│  │
│  └─ mobile/                           # placeholder — Expo لاحقًا
│     └─ README.md                      # يستهلك packages/api-contracts
│
├─ packages/
│  ├─ core/                             # Domain — بدون أي تبعيات خارجية عدا zod
│  │  ├─ entities/{organization,branch,department,user,role,permission,
│  │  │            customer,doctor,service,appointment,notification,
│  │  │            auditLog,file,systemSetting}.ts
│  │  ├─ schemas/                       # Zod schemas لكل كيان
│  │  ├─ permissions/{catalog.ts,scopes.ts}
│  │  ├─ errors/{AppError.ts,codes.ts}
│  │  └─ types/{AccessContext.ts,Paginated.ts,Result.ts}
│  │
│  ├─ data/                             # Data Access
│  │  ├─ repositories/                  # interfaces فقط
│  │  │  └─ {IUserRepository,IBranchRepository,…}.ts
│  │  ├─ firestore/
│  │  │  ├─ BaseFirestoreRepository.ts  # ← فرض العزل يحدث هنا
│  │  │  ├─ converters/
│  │  │  └─ {FirestoreUserRepository,…}.ts
│  │  └─ index.ts                       # container/registry
│  │
│  ├─ services/                         # Application Services (Use Cases)
│  │  ├─ auth/{SessionService,PermissionResolver}.ts
│  │  ├─ users/UserService.ts
│  │  ├─ branches/BranchService.ts
│  │  ├─ customers/CustomerService.ts
│  │  ├─ appointments/AppointmentService.ts
│  │  ├─ audit/AuditService.ts
│  │  └─ notifications/NotificationService.ts
│  │
│  ├─ auth/                             # حراسة الطلبات
│  │  ├─ withAuth.ts
│  │  ├─ resolveAccessContext.ts        # cookie أو bearer
│  │  └─ guards/{requirePermission,requireBranchAccess}.ts
│  │
│  ├─ infra/
│  │  ├─ firebase/{admin.ts,storage.ts,messaging.ts}
│  │  ├─ notifications/providers/{InAppProvider,NoopProvider}.ts
│  │  ├─ logging/logger.ts
│  │  └─ ratelimit/{RateLimiter.ts,MemoryLimiter.ts}
│  │
│  ├─ ui/                               # Design System
│  │  ├─ primitives/{Button,Input,Select,Checkbox,Badge,Card,
│  │  │              Modal,Dropdown,Table,Tabs,Toast,Skeleton}
│  │  ├─ patterns/{DataTable,FormField,ConfirmDialog,StatusPill}
│  │  ├─ tokens/{colors,typography,spacing,radius,shadows}.ts
│  │  └─ styles/rtl.css
│  │
│  ├─ api-contracts/                    # مشترك بين الويب والموبايل
│  │  ├─ v1/{auth,branches,customers,appointments,…}.ts
│  │  └─ envelope.ts
│  │
│  └─ config/
│     ├─ eslint/  (يتضمن قواعد منع الاستيراد بين الطبقات)
│     ├─ tsconfig/  (strict: true, noUncheckedIndexedAccess: true)
│     └─ tailwind/preset.ts
│
├─ services/                            # فارغ الآن — مكان الخدمات المستخرجة مستقبلًا
│  └─ .gitkeep
│
├─ tools/
│  ├─ seed/                             # بيانات Demo (كل سجل isDemo: true)
│  └─ scripts/
│
├─ docs/
│  ├─ README.md  ARCHITECTURE.md  DATABASE.md  SECURITY.md
│  ├─ API.md  DEPLOYMENT.md  ENVIRONMENT.md
│  └─ decisions/ADR-0001-monorepo.md …   # سجل القرارات المعمارية
│
├─ .github/workflows/ci.yml             # typecheck + lint + test
├─ firestore.rules  firestore.indexes.json  storage.rules
├─ pnpm-workspace.yaml  turbo.json  package.json
└─ .gitignore                           # .env* مستثناة، .env.example فقط مرفوع
```

**لماذا هذا التقسيم بالذات؟**
- `packages/core` بدون تبعيات = يمكن للـMobile App استيراد الـtypes والـschemas منه مباشرة.
- `packages/services` لا يعرف Next.js ولا Firestore = يمكن تشغيله من Next، أو من Cloud Function، أو من خادم Express مستقبلًا، بلا تعديل.
- `packages/api-contracts` منفصل عن `core` لأن شكل الـAPI قد يتطور بشكل مستقل عن الـDomain (النسخ v1/v2).
- `services/` موجود فارغًا عمدًا: يوثّق النية المعمارية ويمنع الجدل لاحقًا.

---

# الجزء الثالث — Database Foundation Plan

## 3.1 الحقول المشتركة في كل مستند

```ts
id: string
organizationId: string          // إلزامي على كل كيان قابل للعزل
branchId: string | null         // null = كيان على مستوى الشركة
createdAt: Timestamp
updatedAt: Timestamp
createdBy: string               // userId
updatedBy: string | null
isDeleted: boolean              // Soft delete — لا حذف فعلي للبيانات التشغيلية
deletedAt: Timestamp | null
isDemo?: boolean                // ← يميّز بيانات التطوير عن الإنتاج
```

**قرار التصميم:** مجموعات **top-level مسطّحة** مع حقل `organizationId`، وليس subcollections متداخلة تحت `organizations/{orgId}/`.

**السبب:** الاستعلامات المركزية عبر الفروع (لوحة الإدارة، التقارير) هي حالة الاستخدام الأساسية هنا، وهي تصبح مؤلمة مع `collectionGroup`. كما أن البنية المسطّحة تُترجم مباشرة إلى جداول SQL إن قررنا الترحيل لاحقًا.

---

## 3.2 مخطط العلاقات (نصي)

```
organizations (1)
   ├──< branches (N)
   │      ├──< departments (N)
   │      ├──< appointments (N)
   │      └──< files (N)
   ├──< users (N)
   │      ├──< user_roles (N)      → roles      [+ branchId اختياري]
   │      └──< user_branches (N)   → branches
   ├──< roles (N)
   │      └──< role_permissions (N) → permissions
   ├──< customers (N)  ── branchId (الفرع الأساسي)
   ├──< doctors (N)    ── branchIds[] (تعدد فروع)
   ├──< services (N)   ── branchIds[] (التوفر)
   ├──< notifications (N)
   ├──< audit_logs (N)
   └──< system_settings (1 لكل مفتاح)

appointments  ──> customer, doctor, service, branch, department?
files         ──> ownerType + ownerId (polymorphic)
```

---

## 3.3 المجموعات بالتفصيل

### `organizations`
| الحقل | النوع | ملاحظات |
|---|---|---|
| `name`, `nameEn` | string | |
| `slug` | string | فريد |
| `timezone` | string | افتراضي `Africa/Cairo` |
| `currency` | string | `EGP` — لا قواعد مالية الآن |
| `status` | enum | `active \| suspended` |
| `settings` | map | إعدادات عامة قابلة للتوسعة |

### `branches`
`name, code (فريد داخل المؤسسة), address, phone, email, timezone, managerId (nullable), status: active|inactive|under_maintenance, workingHours?`

> `workingHours` → `BUSINESS_RULE_PENDING`: مواعيد العمل والإجازات والاستثناءات لم تُحدَّد. يُترك الحقل map مرنًا ولا يُبنى عليه منطق حجز الآن.

### `departments`
`branchId, name, code, description, headUserId (nullable), status`

> `DECISION_PENDING`: هل القسم تابع لفرع (قسم أسنان في فرع 3) أم كيان مركزي له فروع؟ التصميم الحالي: **تابع لفرع**، وهو الأشيع. قابل للتغيير بجعل `branchId` قابلًا لـnull.

### `users`
`authUid (فريد — يربط بـFirebase Auth), fullName, email, phone, avatarFileId, jobTitle, primaryBranchId, status: active|pending|suspended|disabled, tokenVersion, lastLoginAt, locale (افتراضي ar)`

> لا يوجد أي حقل كلمة مرور. لا يوجد `isAdmin` boolean — الأدوار فقط.

### `roles`
`name, nameAr, key (فريد), description, isSystem (لا يُحذف), level (للترتيب في الواجهة فقط)`

الأدوار المبدئية المزروعة: `super_admin, company_admin, branch_manager, receptionist, doctor, accountant, warehouse_manager, employee`
> هذه **أدوار مبدئية للتطوير فقط**، وليست قواعد عمل نهائية. الواجهة تسمح بإنشاء أدوار جديدة.

### `permissions`
`key ("appointments.create"), resource, action, nameAr, group` — تُزرع من الكتالوج في الكود.

### `role_permissions`
`roleId, permissionId` — معرّف المستند `{roleId}_{permissionId}` لضمان عدم التكرار.

### `user_roles`
`userId, roleId, branchId (nullable), assignedBy, assignedAt` — معرّف المستند `{userId}_{roleId}_{branchId ?? 'org'}`.

### `user_branches`
`userId, branchId, isPrimary, assignedAt` — مصدر الحقيقة لـ`ctx.branchIds`.

### `customers`
`fullName, phone (مفهرس), altPhone, email, gender, birthDate, nationalId?, address, primaryBranchId, source (walk_in|web|mobile|referral), status (active|inactive|blocked), tags[], notes, mobileAuthUid (nullable)`

> **لا حقول طبية ولا ملف صحي** — لم يطلبها العميل ولم تُناقَش. `BUSINESS_RULE_PENDING`.
> `nationalId` اختياري ومُعلَّم `@sensitive` (لا يظهر في الـaudit diffs).
> `DECISION_PENDING`: هل العميل مشترك بين الفروع أم مملوك لفرع واحد؟ التصميم الحالي: **مشترك على مستوى الشركة مع فرع أساسي** — وهو الأكثر مرونة والأسهل تقييدًا لاحقًا.

### `doctors`
`userId (nullable — قد يكون الطبيب غير مستخدم للنظام), fullName, specialization, licenseNumber, phone, email, branchIds[], departmentId?, bio, avatarFileId, status (active|on_leave|inactive)`

> لا أتعاب، لا نسب، لا عمولات — `BUSINESS_RULE_PENDING`.
> جداول عمل الأطباء (availability) مؤجلة حتى تحديد Workflow الحجز.

### `services`
`name, nameEn, code, description, categoryId?, durationMinutes (nullable), branchIds[], status (active|inactive)`

> **لا أسعار ولا ضرائب ولا عمولات** — `BUSINESS_RULE_PENDING`. الحقول تُضاف بعد اجتماع المتطلبات دون كسر البنية.

### `appointments`
| الحقل | النوع | ملاحظات |
|---|---|---|
| `code` | string | رقم مرجعي للمريض |
| `customerId, doctorId, serviceId` | ref | |
| `branchId, departmentId?` | ref | العزل يعتمد على `branchId` |
| `scheduledStart, scheduledEnd` | Timestamp | |
| `status` | string | **نص وليس enum مقفل** |
| `statusHistory[]` | array | `{status, changedBy, changedAt, reason}` |
| `source` | enum | `dashboard \| mobile \| web \| phone` |
| `notes` | string | ملاحظة إدارية |
| `idempotencyKey` | string | لمنع الحجز المزدوج |

الحالات المبدئية: `scheduled, confirmed, checked_in, in_progress, completed, cancelled, no_show`
> تُقرأ من `system_settings.appointment_statuses` وليست مكتوبة في الكود، لأن العميل قد يغيّرها.
> `BUSINESS_RULE_PENDING`: قواعد الإلغاء (مهلة؟ رسوم؟)، إعادة الجدولة، الدفع، التداخل بين المواعيد، الحجز المزدوج للطبيب. **لن يُبنى أي منها الآن.**

### `notifications`
`recipientUserId | recipientCustomerId, title, body, type, channel[], entityType?, entityId?, readAt (nullable), sentAt, deliveryStatus, metadata`

### `audit_logs`
`actorId, actorName (snapshot), action, entityType, entityId, branchId, organizationId, before (map|null), after (map|null), changedFields[], ip, userAgent, requestId, createdAt` — **append only**.

### `files`
`fileName, storagePath, mimeType, sizeBytes, ownerType (customer|user|doctor|appointment|branch), ownerId, uploadedBy, isPublic (افتراضي false), checksum`

### `system_settings`
`key (فريد), value (any), scope (global|organization|branch), branchId?, updatedBy, description`
يُستخدم لحالات المواعيد، أسماء الأقسام الافتراضية، إعدادات الإشعارات… بدل الـhardcoding.

---

## 3.4 الفهارس المركّبة المطلوبة (Firestore)

```
appointments: (organizationId, branchId, scheduledStart)
appointments: (organizationId, branchId, status, scheduledStart)
appointments: (organizationId, doctorId, scheduledStart)
appointments: (organizationId, customerId, scheduledStart DESC)
customers:    (organizationId, primaryBranchId, fullName)
customers:    (organizationId, phone)
users:        (organizationId, status, fullName)
user_roles:   (userId, branchId)
user_branches:(userId)
audit_logs:   (organizationId, entityType, entityId, createdAt DESC)
audit_logs:   (organizationId, actorId, createdAt DESC)
notifications:(recipientUserId, readAt, createdAt DESC)
files:        (organizationId, ownerType, ownerId)
```

> **ملاحظة عن البحث:** بحث نصي جزئي (مثل جزء من اسم عميل) غير مدعوم أصلًا في Firestore. الحل المبدئي: حقل `searchTokens[]` مُطبَّع (بدون تشكيل، بدون همزات مختلفة) مع `array-contains`. إن احتاج العميل بحثًا حقيقيًا لاحقًا → Algolia أو Typesense. `DECISION_PENDING`.

---

## 3.5 بيانات الـDemo (Phase 4)

مؤسسة واحدة + 3 فروع + مستخدمون يغطون كل دور + 5 أطباء + 8 خدمات + 20 عميلًا + 30 موعدًا.
كل سجل يحمل `isDemo: true`، والـseed script يرفض العمل إذا كان `NODE_ENV=production`.

---

# ما أحتاج قرارك فيه قبل البدء في Phase 1

1. **قرار قاعدة البيانات** (قسم 1.11) — Firestore لكل شيء، أم Firestore + Postgres لاحقًا للوحدات المالية؟
2. **نطاق العميل (Customer)** — مشترك بين الفروع أم مملوك لفرع واحد؟
3. **القسم (Department)** — تابع لفرع أم كيان مركزي؟
4. **الطبيب** — هل هو دائمًا مستخدم للنظام، أم قد يكون سجلًا فقط؟
5. هل تعتمد **Folder Structure** أعلاه كما هي، أم تريد تعديلًا؟

بعد موافقتك أبدأ Phase 1: إعداد الـMonorepo، الـconfig packages، الـcore package، والـCI — ثم أشغّل المشروع وأتأكد من خلوّه من الأخطاء قبل الانتقال لـPhase 2.
