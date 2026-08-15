import { AppError } from '@/server/core';
import { withAuth } from '@/server/auth';
import { attendanceService } from '@/server/services';

export const runtime = 'nodejs';

/** GET /api/v1/attendance/queue?branchId=... — today's queue for one branch. */
export const GET = withAuth(
  async (req, ctx) => {
    const branchId = new URL(req.url).searchParams.get('branchId');
    if (!branchId) throw AppError.validation({ reason: 'branchId is required' });

    return Response.json({ data: await attendanceService.todayQueue(ctx, branchId) });
  },
  { permission: 'attendance.view' },
);
