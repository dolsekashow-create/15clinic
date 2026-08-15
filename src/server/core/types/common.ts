/**
 * Shared primitives used across every entity in the platform.
 * Dependency-free on purpose: importable from the web app, the future
 * mobile app, and any standalone service.
 */

/** ISO-8601 string. Firestore Timestamp objects never leave the data layer. */
export type IsoDate = string;

export type Id = string;

/** Fields present on every persisted document. */
export interface BaseEntity {
  id: Id;
  /** Tenant boundary. Always present, always enforced server-side. */
  organizationId: Id;
  /** `null` means the record lives at company level rather than inside a branch. */
  branchId: Id | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  createdBy: Id | null;
  updatedBy: Id | null;
  /** Soft delete. Operational data is never physically removed. */
  isDeleted: boolean;
  deletedAt: IsoDate | null;
  /** Marks seeded development data so it can never be mistaken for production data. */
  isDemo?: boolean;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PageRequest {
  limit?: number;
  cursor?: string | null;
}

/** Money is stored in minor units (piasters) as an integer. Never a float. */
export type Minor = number;

export interface Money {
  /** Integer amount in minor units, e.g. 12550 === 125.50 EGP */
  amount: Minor;
  currency: string;
}
