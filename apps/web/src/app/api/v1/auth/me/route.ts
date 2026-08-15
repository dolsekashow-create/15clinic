import { withAuth } from '@clinic/auth';

export const runtime = 'nodejs';

/**
 * Session payload for the UI: identity, branches, and the resolved permission
 * set so the client can hide what the user cannot do.
 *
 * Hiding is a courtesy, not a control — every route re-checks server-side.
 */
export const GET = withAuth(async (_req, ctx) =>
  Response.json({
    data: {
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      isSuperAdmin: ctx.isSuperAdmin,
      scope: ctx.scope,
      branchIds: ctx.branchIds,
      permissions: [...ctx.permissions],
    },
  }),
);
