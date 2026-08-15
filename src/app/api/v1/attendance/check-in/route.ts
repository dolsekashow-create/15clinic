import { AppError, checkInInputSchema } from '@/server/core';
import { withAuth } from '@/server/auth';
import { attendanceService } from '@/server/services';

export const runtime = 'nodejs';

/**
 * POST /api/v1/attendance/check-in
 * Authorisation is enforced here on the server. Hiding the button in the UI is
 * cosmetic; this guard is the actual control.
 */
export const POST = withAuth(
  async (req, ctx) => {
    const parsed = checkInInputSchema.safeParse(await req.json());
    if (!parsed.success) throw AppError.validation(parsed.error.flatten());

    const visit = await attendanceService.checkIn(ctx, parsed.data);
    return Response.json({ data: visit }, { status: 201 });
  },
  { permission: 'attendance.check_in' },
);
