# API — v1

كل المسارات تحت `/api/v1/`. الويب بيستخدم الـsession cookie، وتطبيق الجوّال بيستخدم `Authorization: Bearer <idToken>` — والاتنين بيمرّوا على نفس `resolveAccessContext` فالسلوك متطابق.

## الشكل الموحد

نجاح: `{ "data": ... }`
خطأ: `{ "error": { "code": "FORBIDDEN_BRANCH_ACCESS", "message": "..." } }`

الأخطاء بتحمل كود ثابت + رسالة عربية آمنة. **مفيش stack trace ولا تفاصيل قاعدة بيانات** في أي استجابة.

## المسارات المنفّذة

| المسار | الميثود | الصلاحية | الوظيفة |
|---|---|---|---|
| `/auth/session` | POST | — | تبديل idToken بجلسة cookie |
| `/auth/session` | DELETE | — | خروج |
| `/auth/me` | GET | جلسة صالحة | الهوية والفروع والصلاحيات |
| `/users` | GET | `users.view` | المستخدمون مع أدوارهم وفروعهم |
| `/users` | POST | `users.create` | إنشاء موظف (Auth + سجل + أدوار) |
| `/users/status` | POST | `users.update` | إيقاف/تفعيل + إبطال الجلسات |
| `/roles` | GET | `roles.view` | الأدوار + كتالوج الصلاحيات |
| `/roles` | PUT | `roles.update` | تعديل صلاحيات دور |
| `/attendance/check-in` | POST | `attendance.check_in` | تسجيل حضور + رقم دور |
| `/attendance/check-out` | POST | `attendance.check_out` | تسجيل انصراف + حساب الأزمنة |
| `/attendance/queue` | GET | `attendance.view` | طابور اليوم لفرع |
| `/accounting/invoices` | POST | `accounting.invoices.create` | إصدار فاتورة + قيدها |
| `/accounting/payments` | POST | `accounting.payments.create` | تحصيل + قيده |
| `/accounting/reports/trial-balance` | GET | `accounting.reports.view` | ميزان المراجعة |
| `/inventory/movements` | POST | حسب نوع الحركة | استلام/صرف/تسوية |
| `/inventory/transfers` | POST | `inventory.transfer` | إرسال تحويل |
| `/inventory/transfers` | PUT | `inventory.transfer.receive` | استلام تحويل |
| `/health` | GET | — | فحص حياة (لا يكشف أي معلومة) |

## قواعد ثابتة

- `organizationId` **لا يُقبل من العميل أبدًا** — يُشتق من الجلسة.
- `branchId` في الكتابة يُتحقق من انتمائه لنطاق المستخدم قبل أي شيء.
- المبالغ كلها `Minor` (أعداد صحيحة بالقروش). إرسال `12.50` يُرفض.
- التصعيد ممنوع: لا يمكن منح صلاحية لا تملكها، ولا إسناد دور على فرع خارج نطاقك.

## لسه ناقص

`/customers`, `/appointments`, `/branches`, `/doctors`, `/services`, `/audit-logs`, `/files` — الـrepositories والخدمات جاهزة، فاضل طبقة الـroute بس.
