import { Button, Card, PageHeader } from '@/components/ui/primitives';
import { stock } from '@/data/demo';

/**
 * Stock by warehouse.
 *
 * Quantities are never edited directly here — every change is a movement
 * (receipt, issue, transfer, count adjustment) so the stock card always answers
 * "who changed this, when, and why". Editing a number in place would answer
 * none of those.
 */
export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="المخزن"
        subtitle="كل تغيير في الكمية بيتسجل كحركة — مفيش تعديل مباشر على الأرصدة."
        action={
          <div className="flex gap-2">
            <Button variant="ghost">تحويل بين الفروع</Button>
            <Button>استلام بضاعة</Button>
          </div>
        }
      />

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper-sunk text-ink-muted">
            <tr>
              <th className="px-4 py-3 text-start font-medium">الصنف</th>
              <th className="px-4 py-3 text-start font-medium">الكود</th>
              <th className="px-4 py-3 text-start font-medium">المخزن</th>
              <th className="px-4 py-3 text-start font-medium">الرصيد</th>
              <th className="px-4 py-3 text-start font-medium">حد الطلب</th>
              <th className="px-4 py-3 text-start font-medium">‎</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {stock.map((item) => {
              const low = item.qty <= item.reorder;
              return (
                <tr key={item.id} className={low ? 'bg-clay-light/40' : undefined}>
                  <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-faint">{item.sku}</td>
                  <td className="px-4 py-3 text-ink-muted">{item.warehouse}</td>
                  <td className={`num px-4 py-3 font-medium ${low ? 'text-clay' : 'text-ink'}`}>
                    {item.qty} {item.unit}
                  </td>
                  <td className="num px-4 py-3 text-ink-faint">{item.reorder}</td>
                  <td className="px-4 py-3 text-end">
                    <button className="text-sm text-clinic-deep hover:underline">كارت الصنف</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
