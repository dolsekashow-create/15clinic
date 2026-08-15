import type { CollectionReference, Firestore, Query } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { AppError, canAccessBranch, type AccessContext, type BaseEntity, type PageRequest, type Paginated } from '@/server/core';
import { getDb } from '@/server/infra';
import { fromDoc, toFirestore } from './converters';

/**
 * ── The single choke point for multi-branch data isolation ──────────────
 *
 * Every read and write in the platform goes through this class, and every
 * method requires an AccessContext. Two rules are enforced here and nowhere
 * else, so no future feature can forget them:
 *
 *   1. organizationId is ALWAYS taken from the context, never from the caller.
 *   2. When the caller is branch-scoped, results are restricted to their
 *      branches, and any write to a branch outside that set is rejected.
 *
 * Firestore's `in` operator caps at 30 values. With 15 branches we are far
 * inside that, but the chunked path below keeps the system correct if the
 * company grows past it.
 */

const IN_OPERATOR_LIMIT = 30;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface QueryFilter {
  field: string;
  op: FirebaseFirestore.WhereFilterOp;
  value: unknown;
}

export interface ListOptions extends PageRequest {
  filters?: QueryFilter[];
  orderBy?: { field: string; direction?: 'asc' | 'desc' };
  /** Include soft-deleted records. Requires an explicit opt-in. */
  includeDeleted?: boolean;
}

export abstract class BaseFirestoreRepository<T extends BaseEntity> {
  protected readonly db: Firestore;

  constructor(
    protected readonly collectionName: string,
    /** Whether documents in this collection carry a real branchId. */
    protected readonly branchScoped: boolean,
    db?: Firestore,
  ) {
    this.db = db ?? getDb();
  }

  protected collection(): CollectionReference {
    return this.db.collection(this.collectionName);
  }

  /** Applies tenant + branch isolation. No query may bypass this. */
  protected scopedQuery(ctx: AccessContext, options: ListOptions = {}): Query[] {
    let base: Query = this.collection().where('organizationId', '==', ctx.organizationId);

    if (!options.includeDeleted) base = base.where('isDeleted', '==', false);

    for (const f of options.filters ?? []) {
      if (f.field === 'organizationId') {
        throw AppError.forbidden({ reason: 'organizationId cannot be overridden by a caller' });
      }
      base = base.where(f.field, f.op, f.value);
    }

    if (options.orderBy) {
      base = base.orderBy(options.orderBy.field, options.orderBy.direction ?? 'asc');
    }

    const needsBranchFilter =
      this.branchScoped && !ctx.isSuperAdmin && ctx.scope === 'BRANCH';

    if (!needsBranchFilter) return [base];

    if (ctx.branchIds.length === 0) {
      // Branch-scoped user with no branches assigned sees nothing. Fail closed.
      return [base.where('branchId', '==', '__no_branch__')];
    }

    // Split into chunks of 30 and merge the results in the caller.
    const chunks: Query[] = [];
    for (let i = 0; i < ctx.branchIds.length; i += IN_OPERATOR_LIMIT) {
      chunks.push(base.where('branchId', 'in', ctx.branchIds.slice(i, i + IN_OPERATOR_LIMIT)));
    }
    return chunks;
  }

  async findById(ctx: AccessContext, id: string): Promise<T | null> {
    const snap = await this.collection().doc(id).get();
    if (!snap.exists) return null;

    const data = snap.data() as Record<string, unknown>;

    // Defence in depth: even a direct id lookup is checked against the context.
    if (data.organizationId !== ctx.organizationId && !ctx.isSuperAdmin) return null;
    if (!canAccessBranch(ctx, (data.branchId as string | null) ?? null)) {
      throw AppError.branchForbidden(String(data.branchId));
    }
    if (data.isDeleted === true) return null;

    return fromDoc<T>(snap.id, data);
  }

  async requireById(ctx: AccessContext, id: string): Promise<T> {
    const found = await this.findById(ctx, id);
    if (!found) throw AppError.notFound(this.collectionName, id);
    return found;
  }

  async list(ctx: AccessContext, options: ListOptions = {}): Promise<Paginated<T>> {
    const limit = Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const queries = this.scopedQuery(ctx, options);

    // Cursor pagination is only valid on a single query. When branch chunking
    // kicks in (>30 branches) we fetch each chunk and merge in memory.
    if (queries.length === 1) {
      let q = queries[0]!.limit(limit + 1);
      if (options.cursor) {
        // startAfter needs the actual document snapshot so it works with any orderBy.
        const cursorSnap = await this.collection().doc(decodeCursor(options.cursor)).get();
        if (cursorSnap.exists) q = q.startAfter(cursorSnap);
      }
      const snap = await q.get();
      const docs = snap.docs.slice(0, limit);
      return {
        items: docs.map((d) => fromDoc<T>(d.id, d.data())),
        nextCursor: snap.docs.length > limit ? encodeCursor(docs[docs.length - 1]!.id) : null,
        hasMore: snap.docs.length > limit,
      };
    }

    const results = await Promise.all(queries.map((q) => q.limit(limit).get()));
    const merged = results.flatMap((s) => s.docs.map((d) => fromDoc<T>(d.id, d.data())));
    return { items: merged.slice(0, limit), nextCursor: null, hasMore: merged.length > limit };
  }

  async create(
    ctx: AccessContext,
    data: Omit<T, keyof BaseEntity> & { branchId?: string | null; id?: string },
  ): Promise<T> {
    const branchId = (data.branchId ?? null) as string | null;
    this.assertBranchWritable(ctx, branchId);

    const ref = data.id ? this.collection().doc(data.id) : this.collection().doc();
    const now = new Date().toISOString();

    const payload = {
      ...data,
      id: undefined,
      organizationId: ctx.organizationId, // never taken from the caller
      branchId,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.userId,
      updatedBy: null,
      isDeleted: false,
      deletedAt: null,
    };

    await ref.set(toFirestore(stripUndefined(payload)) as Record<string, unknown>);
    return { ...payload, id: ref.id } as unknown as T;
  }

  async update(ctx: AccessContext, id: string, patch: Partial<T>): Promise<T> {
    const existing = await this.requireById(ctx, id);

    if (patch.branchId !== undefined && patch.branchId !== existing.branchId) {
      this.assertBranchWritable(ctx, patch.branchId as string | null);
    }

    const safePatch = stripUndefined({
      ...patch,
      id: undefined,
      organizationId: undefined, // immutable
      createdAt: undefined,
      createdBy: undefined,
      updatedAt: new Date().toISOString(),
      updatedBy: ctx.userId,
    });

    await this.collection().doc(id).update(toFirestore(safePatch) as Record<string, unknown>);
    return { ...existing, ...safePatch } as T;
  }

  /** Soft delete. Operational records are never physically removed. */
  async softDelete(ctx: AccessContext, id: string): Promise<void> {
    await this.requireById(ctx, id);
    await this.collection().doc(id).update({
      isDeleted: true,
      deletedAt: FieldValue.serverTimestamp(),
      updatedBy: ctx.userId,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  protected assertBranchWritable(ctx: AccessContext, branchId: string | null): void {
    if (!this.branchScoped || branchId === null) return;
    if (!canAccessBranch(ctx, branchId)) throw AppError.branchForbidden(branchId);
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
}

function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8');
}
