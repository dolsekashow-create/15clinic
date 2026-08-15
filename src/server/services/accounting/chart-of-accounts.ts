import type { AccountType } from '@/server/core';

/**
 * A conventional starter chart of accounts.
 *
 * This is deliberately generic — it follows standard double-entry structure and
 * invents no company policy. The client's accountant will rename, add and
 * restructure these from the UI after the requirements meeting. Only the
 * accounts marked `systemKey` are referenced by code, and even those are
 * remapped through system_settings rather than hardcoded ids.
 */

export interface AccountSeed {
  code: string;
  name: string;
  type: AccountType;
  isGroup?: boolean;
  parentCode?: string;
  /** Referenced by automated postings. Remappable in settings. */
  systemKey?: string;
}

export const DEFAULT_CHART_OF_ACCOUNTS: readonly AccountSeed[] = [
  // 1 — Assets
  { code: '1000', name: 'الأصول', type: 'asset', isGroup: true },
  { code: '1100', name: 'الأصول المتداولة', type: 'asset', isGroup: true, parentCode: '1000' },
  { code: '1110', name: 'النقدية بالخزينة', type: 'asset', parentCode: '1100', systemKey: 'cash_on_hand' },
  { code: '1120', name: 'النقدية بالبنك', type: 'asset', parentCode: '1100', systemKey: 'bank' },
  { code: '1130', name: 'ذمم العملاء', type: 'asset', parentCode: '1100', systemKey: 'accounts_receivable' },
  { code: '1140', name: 'مدفوعات بطاقات تحت التحصيل', type: 'asset', parentCode: '1100', systemKey: 'card_clearing' },
  { code: '1150', name: 'ذمم شركات التأمين', type: 'asset', parentCode: '1100', systemKey: 'insurance_receivable' },
  { code: '1160', name: 'المخزون', type: 'asset', parentCode: '1100', systemKey: 'inventory' },
  { code: '1170', name: 'بضاعة في الطريق', type: 'asset', parentCode: '1100', systemKey: 'inventory_in_transit' },
  { code: '1200', name: 'الأصول الثابتة', type: 'asset', isGroup: true, parentCode: '1000' },

  // 2 — Liabilities
  { code: '2000', name: 'الالتزامات', type: 'liability', isGroup: true },
  { code: '2100', name: 'الالتزامات المتداولة', type: 'liability', isGroup: true, parentCode: '2000' },
  { code: '2110', name: 'ذمم الموردين', type: 'liability', parentCode: '2100', systemKey: 'accounts_payable' },
  { code: '2120', name: 'ضرائب مستحقة', type: 'liability', parentCode: '2100', systemKey: 'tax_payable' },
  { code: '2130', name: 'دفعات مقدمة من العملاء', type: 'liability', parentCode: '2100', systemKey: 'customer_advances' },

  // 3 — Equity
  { code: '3000', name: 'حقوق الملكية', type: 'equity', isGroup: true },
  { code: '3100', name: 'رأس المال', type: 'equity', parentCode: '3000' },
  { code: '3200', name: 'الأرباح المرحّلة', type: 'equity', parentCode: '3000', systemKey: 'retained_earnings' },

  // 4 — Revenue
  { code: '4000', name: 'الإيرادات', type: 'revenue', isGroup: true },
  { code: '4100', name: 'إيرادات الخدمات الطبية', type: 'revenue', parentCode: '4000', systemKey: 'service_revenue' },
  { code: '4900', name: 'خصومات ومسموحات', type: 'revenue', parentCode: '4000', systemKey: 'sales_discounts' },

  // 5 — Expenses
  { code: '5000', name: 'المصروفات', type: 'expense', isGroup: true },
  { code: '5100', name: 'الرواتب والأجور', type: 'expense', parentCode: '5000' },
  { code: '5200', name: 'إيجارات', type: 'expense', parentCode: '5000' },
  { code: '5300', name: 'مرافق', type: 'expense', parentCode: '5000' },
  { code: '5400', name: 'مستلزمات طبية مستهلكة', type: 'expense', parentCode: '5000', systemKey: 'inventory_consumption' },
  { code: '5450', name: 'عجز/زيادة المخزون', type: 'expense', parentCode: '5000', systemKey: 'inventory_variance' },
  { code: '5900', name: 'عجز/زيادة الخزينة', type: 'expense', parentCode: '5000', systemKey: 'cash_variance' },
];

/** Keys the posting engine looks up. Mapped to real account ids in system_settings. */
export const SYSTEM_ACCOUNT_KEYS = [
  'cash_on_hand', 'bank', 'accounts_receivable', 'card_clearing', 'insurance_receivable',
  'accounts_payable', 'tax_payable', 'customer_advances', 'retained_earnings',
  'service_revenue', 'sales_discounts', 'cash_variance',
  'inventory', 'inventory_in_transit', 'inventory_consumption', 'inventory_variance',
] as const;

export type SystemAccountKey = (typeof SYSTEM_ACCOUNT_KEYS)[number];

export const ACCOUNT_MAP_SETTING_KEY = 'accounting.system_accounts';
