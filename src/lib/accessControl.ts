import type {
  DomainPermission,
  Household,
  HouseholdMembership,
  HouseholdPermissionRule,
  Role,
} from '../types.ts';

export function filterHouseholdsByMembership(
  households: Household[],
  memberships: HouseholdMembership[],
): Household[] {
  const allowedHouseholdIds = new Set(memberships.map(membership => membership.householdId));
  return households.filter(household => allowedHouseholdIds.has(household.id));
}

export function isHouseholdManager(role: Role | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canReadHouseholdDomain(
  role: Role | undefined,
  rules: HouseholdPermissionRule[],
  domain: DomainPermission,
): boolean {
  return isHouseholdManager(role) ||
    rules.some(rule => rule.domain === domain && (rule.canRead || rule.canWrite));
}

export function canWriteHouseholdDomain(
  role: Role | undefined,
  rules: HouseholdPermissionRule[],
  domain: DomainPermission,
): boolean {
  return isHouseholdManager(role) ||
    rules.some(rule => rule.domain === domain && rule.canWrite);
}
