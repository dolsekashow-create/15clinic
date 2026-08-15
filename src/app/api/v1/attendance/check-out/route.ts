import { AppError, checkOutInputSchema } from '@/server/core';
import { withAuth } from '@/server/auth';
import { attendanceService } from '@/server/services';

export const runtime = 'nodejs';

export const POST = withAuth(
  async (req, ctx) => {
    const parsed = checkOutInputSchema.safeParse(await req.json());
    if (!parsed.success) throw AppError.validation(parsed.error.flatten());

    const visit = await attendanceService.checkOut(ctx, parsed.data);
    return Response.json({ data: visit });
  },
  { permission: 'attendance.check_out' },
);
