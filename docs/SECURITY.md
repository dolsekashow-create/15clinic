# الأمان

## الضوابط المطبقة

| الضابط | المكان |
|---|---|
| الجلسة في httpOnly cookie لا في localStorage | `apps/web/.../auth/session/route.ts` |
| رفض id token أقدم من 5 دقائق عند إنشاء الجلسة | نفس الملف |
| `checkRevoked: true` عند التحقق — الحساب المعطَّل تسقط جلسته فورًا | `resolve-access-context.ts` |
| `tokenVersion` لإبطال كل جلسات مستخدم | `users` + `PermissionResolver` |
| فحص حالة الحساب في كل طلب | `resolve-access-context.ts` |
| الصلاحيات تُفرض على الخادم لا في الواجهة | `withAuth` |
| عزل المؤسسة والفرع في نقطة واحدة | `BaseFirestoreRepository` |
| رفض `organizationId` القادم من العميل | نفس الملف |
| Soft delete — لا حذف فعلي للبيانات التشغيلية | نفس الملف |
| سجل عمليات append-only مع حجب الحقول الحساسة | `AuditService` + `firestore.rules` |
| لا Stack Trace ولا تفاصيل داخلية في استجابة الخطأ | `toErrorResponse` |
| حجب الأسرار في اللوج | `logger` |
| Firestore/Storage rules: deny by default | `firestore.rules`, `storage.rules` |
| لا Secrets في المستودع | `.gitignore` + `.env.example` |

## ملاحظات

**قواعد Firestore ليست طبقة التفويض.** كل حركة التطبيق تمر عبر Admin SDK الذي يتجاوز القواعد بالكامل. القواعد موجودة لمنع استغلال إعدادات العميل المسرّبة للوصول المباشر لقاعدة البيانات.

**الملفات:** لا يوجد bucket عام. الرفع والتحميل عبر Signed URLs قصيرة الأجل يصدرها الخادم بعد فحص الصلاحية.

**بيانات حساسة:** `nationalId` مُعلَّم `@sensitive` ويُحجب من فروق سجل العمليات. لا تُخزَّن أي بيانات طبية حتى الآن — لم يطلبها العميل ولم تُحدَّد متطلباتها.

## غير منفّذ بعد

- Rate limiting: الـinterface جاهز، المزوّد `DECISION_PENDING` (Upstash Redis أو عدّاد Firestore)
- 2FA لحسابات الإدارة
- App Check لتطبيق الجوّال
- اختبارات قواعد Firestore على المحاكي
