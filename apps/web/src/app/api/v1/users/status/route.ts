import { z } from 'zod';
import { AppError } from '@clinic/core';
import { withAuth } from '@clinic/auth';
import { userService } from '@clinic/services';

export const runtime = 'nodejs';

const schema = z.object({
  userId: z.string().min(1),
  status: z.enum(['active', 'suspended', 'disabled']),
  reason: z.string().max(500).optional(),
});

/**
 * Suspending a user revokes their live sessions too — otherwise a dismissed
 * employee keeps working until their cookie expires.
 */
export const POST = withAuth(
  async (req, ctx) => {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw AppError.validation(parsed.error.flatten());

    await userService.setStatus(ctx, parsed.data.userId, parsed.data.status, parsed.data.reason);
    return Response.json({ data: { ok: true } });
  },
  { permission: 'users.update' },
);
