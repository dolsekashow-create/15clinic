/**
 * DEMO DATA — development only.
 *
 * Every page below reads from here so the site runs before Firebase is
 * configured. Replace each call with the matching API route once the seed has
 * run; the shapes already match the real entities.
 */
export const DEMO = true;

export const branches = [
  { id: 'branch_maadi', name: 'فرع المعادي', area: 'المعادي', phone: '02 2358 0000', open: '9ص — 9م' },
  { id: 'branch_nasr', name: 'فرع مدينة نصر', area: 'مدينة نصر', phone: '02 2270 0000', open: '10ص — 10م' },
  { id: 'branch_giza', name: 'فرع الجيزة', area: 'الدقي', phone: '02 3336 0000', open: '9ص — 8م' },
];

export const specialties = [
  { id: 'internal', name: 'باطنة' },
  { id: 'derma', name: 'جلدية' },
  { id: 'dental', name: 'أسنان' },
];

export const doctors = [
  { id: 'doc_1', name: 'د. أحمد سمير', specialty: 'باطنة', branchId: 'branch_maadi', nextSlot: 'اليوم 4:30م', years: 12 },
  { id: 'doc_2', name: 'د. منى عبد الله', specialty: 'جلدية', branchId: 'branch_nasr', nextSlot: 'غدًا 11:00ص', years: 9 },
  { id: 'doc_3', name: 'د. كريم فؤاد', specialty: 'أسنان', branchId: 'branch_giza', nextSlot: 'اليوم 6:00م', years: 15 },
];

export const offers = [
  { id: 'o1', title: 'كشف باطنة + تحاليل أساسية', note: 'يشمل المتابعة خلال أسبوعين', price: '450 ج.م' },
  { id: 'o2', title: 'جلسة تنظيف أسنان', note: 'تشمل الكشف والتشخيص', price: '600 ج.م' },
];

export const todayQueue = [
  { id: 'v1', queueNumber: 12, customer: 'محمود عادل', doctor: 'د. أحمد سمير', status: 'in_service', checkedInAt: '10:04', waited: 18 },
  { id: 'v2', queueNumber: 13, customer: 'سارة حسن', doctor: 'د. أحمد سمير', status: 'waiting', checkedInAt: '10:22', waited: 31 },
  { id: 'v3', queueNumber: 14, customer: 'عمر خالد', doctor: 'د. أحمد سمير', status: 'waiting', checkedInAt: '10:40', waited: 13 },
  { id: 'v4', queueNumber: 11, customer: 'هالة إبراهيم', doctor: 'د. منى عبد الله', status: 'completed', checkedInAt: '9:35', waited: 22 },
];

export const demoUsers = [
  { id: 'u1', name: 'ياسمين طارق', email: 'yasmin@example.com', role: 'مدير فرع', branches: ['فرع المعادي'], status: 'active' },
  { id: 'u2', name: 'محمد عز', email: 'mohamed@example.com', role: 'موظف استقبال', branches: ['فرع المعادي'], status: 'active' },
  { id: 'u3', name: 'نهى سعيد', email: 'noha@example.com', role: 'محاسب', branches: ['كل الفروع'], status: 'active' },
  { id: 'u4', name: 'أحمد لطفي', email: 'ahmed@example.com', role: 'مسؤول المخزن', branches: ['فرع الجيزة'], status: 'suspended' },
];

export const stock = [
  { id: 's1', name: 'قفازات نيتريل مقاس M', sku: 'GLV-M', warehouse: 'مخزن المعادي', qty: 24, reorder: 50, unit: 'علبة' },
  { id: 's2', name: 'سرنجات 5 مل', sku: 'SYR-5', warehouse: 'مخزن المعادي', qty: 310, reorder: 100, unit: 'قطعة' },
  { id: 's3', name: 'كحول طبي 70%', sku: 'ALC-70', warehouse: 'مخزن مدينة نصر', qty: 8, reorder: 20, unit: 'لتر' },
];
