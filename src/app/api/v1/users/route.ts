import { z } from 'zod';
import { AppError } from '@/server/core';
import { withAuth } from '@/server/auth';
import { userService } from '@/server/services';

export const runtime = 'nodejs';

export const GET = withAuth(
  async (_req, ctx) => Response.json({ data: await userService.listWithAccess(ctx) }),
  { permission: 'users.view' },
);

const createSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  // Minimum length only. Firebase Auth handles hashing; we never see or store it.
  password: z.string().min(10, 'كلمة المرور لا تقل عن 10 حروف'),
  phone: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  roles: z.array(z.object({ roleId: z.string(), branchId: z.string().nullable() })).min(1),
  branchIds: z.array(z.string()).min(1),
  primaryBranchId: z.string().nullable().optional(),
});

export const POST = withAuth(
  async (req, ctx) => {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw AppError.validation(parsed.error.flatten());

    const user = await userService.createUser(ctx, parsed.data);
    // The password is never echoed back, not even to the admin who set it.
    return Response.json({ data: { ...user, password: undefined } }, { status: 201 });
  },
  { permission: 'users.create' },
);
