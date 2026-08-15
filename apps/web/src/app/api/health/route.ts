/**
 * Liveness probe for the container and the load balancer.
 * Deliberately returns nothing about the database, the version or the
 * environment — a health endpoint is public, so it must not become a free
 * reconnaissance tool.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok' });
}
