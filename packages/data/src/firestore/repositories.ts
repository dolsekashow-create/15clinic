import type {
  Account, Appointment, AuditLog, Branch, CashSession, Customer, Department,
  Doctor, FiscalPeriod, Invoice, JournalEntry, Notification, Organization,
  Payment, Permission, Role, RolePermission, Service, StoredFile,
  SystemSetting, TaxRate, User, UserBranch, UserRole, Visit,
} from '@clinic/core';
import { BaseFirestoreRepository } from './base-repository.js';
import { COLLECTIONS } from './collections.js';

/**
 * Concrete repositories. Each declares whether its documents are branch-scoped,
 * which is what drives the isolation filter in the base class.
 */

export class OrganizationRepository extends BaseFirestoreRepository<Organization> {
  constructor() { super(COLLECTIONS.organizations, false); }
}
export class BranchRepository extends BaseFirestoreRepository<Branch> {
  constructor() { super(COLLECTIONS.branches, true); }
}
export class DepartmentRepository extends BaseFirestoreRepository<Department> {
  constructor() { super(COLLECTIONS.departments, true); }
}
export class UserRepository extends BaseFirestoreRepository<User> {
  constructor() { super(COLLECTIONS.users, false); }
}
export class RoleRepository extends BaseFirestoreRepository<Role> {
  constructor() { super(COLLECTIONS.roles, false); }
}
export class PermissionRepository extends BaseFirestoreRepository<Permission> {
  constructor() { super(COLLECTIONS.permissions, false); }
}
export class RolePermissionRepository extends BaseFirestoreRepository<RolePermission> {
  constructor() { super(COLLECTIONS.rolePermissions, false); }
}
export class UserRoleRepository extends BaseFirestoreRepository<UserRole> {
  constructor() { super(COLLECTIONS.userRoles, false); }
}
export class UserBranchRepository extends BaseFirestoreRepository<UserBranch> {
  constructor() { super(COLLECTIONS.userBranches, false); }
}
export class CustomerRepository extends BaseFirestoreRepository<Customer> {
  constructor() { super(COLLECTIONS.customers, false); }
}
export class DoctorRepository extends BaseFirestoreRepository<Doctor> {
  constructor() { super(COLLECTIONS.doctors, false); }
}
export class ServiceRepository extends BaseFirestoreRepository<Service> {
  constructor() { super(COLLECTIONS.services, false); }
}
export class AppointmentRepository extends BaseFirestoreRepository<Appointment> {
  constructor() { super(COLLECTIONS.appointments, true); }
}
export class VisitRepository extends BaseFirestoreRepository<Visit> {
  constructor() { super(COLLECTIONS.visits, true); }
}
export class AccountRepository extends BaseFirestoreRepository<Account> {
  constructor() { super(COLLECTIONS.accounts, false); }
}
export class FiscalPeriodRepository extends BaseFirestoreRepository<FiscalPeriod> {
  constructor() { super(COLLECTIONS.fiscalPeriods, false); }
}
export class TaxRateRepository extends BaseFirestoreRepository<TaxRate> {
  constructor() { super(COLLECTIONS.taxRates, false); }
}
export class JournalEntryRepository extends BaseFirestoreRepository<JournalEntry> {
  constructor() { super(COLLECTIONS.journalEntries, true); }
}
export class InvoiceRepository extends BaseFirestoreRepository<Invoice> {
  constructor() { super(COLLECTIONS.invoices, true); }
}
export class PaymentRepository extends BaseFirestoreRepository<Payment> {
  constructor() { super(COLLECTIONS.payments, true); }
}
export class CashSessionRepository extends BaseFirestoreRepository<CashSession> {
  constructor() { super(COLLECTIONS.cashSessions, true); }
}
export class NotificationRepository extends BaseFirestoreRepository<Notification> {
  constructor() { super(COLLECTIONS.notifications, true); }
}
export class AuditLogRepository extends BaseFirestoreRepository<AuditLog> {
  constructor() { super(COLLECTIONS.auditLogs, true); }
}
export class FileRepository extends BaseFirestoreRepository<StoredFile> {
  constructor() { super(COLLECTIONS.files, true); }
}
export class SystemSettingRepository extends BaseFirestoreRepository<SystemSetting> {
  constructor() { super(COLLECTIONS.systemSettings, false); }
}
