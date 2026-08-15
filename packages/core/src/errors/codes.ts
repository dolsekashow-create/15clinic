/**
 * Stable, machine-readable error codes. The Arabic message shown to the user
 * is derived from the code, so wording can change without breaking clients.
 */
export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  ACCOUNT_NOT_ACTIVE: 'ACCOUNT_NOT_ACTIVE',
  FORBIDDEN: 'FORBIDDEN',
  FORBIDDEN_BRANCH_ACCESS: 'FORBIDDEN_BRANCH_ACCESS',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  UNBALANCED_JOURNAL_ENTRY: 'UNBALANCED_JOURNAL_ENTRY',
  PERIOD_CLOSED: 'PERIOD_CLOSED',
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  NOT_CHECKED_IN: 'NOT_CHECKED_IN',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ERROR_MESSAGES_AR: Record<ErrorCodeValue, string> = {
  UNAUTHENTICATED: 'يجب تسجيل الدخول للمتابعة',
  SESSION_EXPIRED: 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى',
  ACCOUNT_NOT_ACTIVE: 'الحساب غير مفعّل، تواصل مع الإدارة',
  FORBIDDEN: 'لا تملك صلاحية تنفيذ هذا الإجراء',
  FORBIDDEN_BRANCH_ACCESS: 'لا تملك صلاحية الوصول لبيانات هذا الفرع',
  NOT_FOUND: 'العنصر المطلوب غير موجود',
  VALIDATION_FAILED: 'البيانات المُرسلة غير صحيحة',
  CONFLICT: 'العملية تتعارض مع بيانات موجودة بالفعل',
  RATE_LIMITED: 'عدد المحاولات كبير، حاول بعد قليل',
  UNBALANCED_JOURNAL_ENTRY: 'القيد غير متوازن: مجموع المدين لا يساوي مجموع الدائن',
  PERIOD_CLOSED: 'الفترة المحاسبية مقفلة ولا يمكن التعديل عليها',
  ALREADY_CHECKED_IN: 'تم تسجيل حضور هذا العميل بالفعل',
  NOT_CHECKED_IN: 'لا يوجد تسجيل حضور مفتوح لهذا العميل',
  INTERNAL: 'حدث خطأ غير متوقع، تم تسجيل المشكلة',
};
