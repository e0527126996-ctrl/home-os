import assert from 'node:assert/strict';
import type { Household, HouseholdMembership, HouseholdPermissionRule } from '../src/types.ts';
import {
  canApproveHouseholdDomain,
  canReadHouseholdDomain,
  canWriteHouseholdDomain,
  filterHouseholdsByMembership,
  isHouseholdManager,
} from '../src/lib/accessControl.ts';

const households: Household[] = [
  { id: 'h1', name: 'בית ראשון', currency: '₪', createdAt: '2026-01-01T00:00:00Z', settings: { theme: 'warm_editorial', density: 'balanced', viewMode: 'executive' } },
  { id: 'h2', name: 'בית שני', currency: '₪', createdAt: '2026-01-01T00:00:00Z', settings: { theme: 'warm_editorial', density: 'balanced', viewMode: 'executive' } },
  { id: 'h3', name: 'בית שלישי', currency: '₪', createdAt: '2026-01-01T00:00:00Z', settings: { theme: 'warm_editorial', density: 'balanced', viewMode: 'executive' } },
];

const membership = (householdId: string, userId = 'user_a'): HouseholdMembership => ({
  id: 'mem_' + householdId,
  householdId,
  userId,
  role: 'member',
  joinedAt: '2026-01-01T00:00:00Z',
});

const rule = (
  domain: HouseholdPermissionRule['domain'],
  canRead: boolean,
  canWrite: boolean,
  canApprove = false,
): HouseholdPermissionRule => ({
  id: 'rule_' + domain,
  membershipId: 'mem_h1',
  householdId: 'h1',
  domain,
  canRead,
  canWrite,
  canApprove,
});

const cases: Array<{ name: string; run: () => void }> = [
  {
    name: 'shows only households with a membership for the active user',
    run: () => {
      const visible = filterHouseholdsByMembership(households, [membership('h2')]);
      assert.deepEqual(visible.map(household => household.id), ['h2']);
    },
  },
  {
    name: 'does not expose any household when the user has no membership',
    run: () => {
      assert.deepEqual(filterHouseholdsByMembership(households, []), []);
    },
  },
  {
    name: 'owner and admin roles receive full domain read and write access',
    run: () => {
      for (const role of ['owner', 'admin'] as const) {
        assert.equal(isHouseholdManager(role), true);
        assert.equal(canReadHouseholdDomain(role, [], 'finance'), true);
        assert.equal(canWriteHouseholdDomain(role, [], 'finance'), true);
      }
    },
  },
  {
    name: 'read-only member rules never grant write access',
    run: () => {
      const rules = [rule('finance', true, false)];
      assert.equal(canReadHouseholdDomain('member', rules, 'finance'), true);
      assert.equal(canWriteHouseholdDomain('member', rules, 'finance'), false);
    },
  },
  {
    name: 'write permission implies read access only within the same domain',
    run: () => {
      const rules = [rule('documents', false, true)];
      assert.equal(canReadHouseholdDomain('member', rules, 'documents'), true);
      assert.equal(canWriteHouseholdDomain('member', rules, 'documents'), true);
      assert.equal(canReadHouseholdDomain('member', rules, 'finance'), false);
      assert.equal(canWriteHouseholdDomain('member', rules, 'finance'), false);
    },
  },
  {
    name: 'approval permission is separate from ordinary admin-domain read and write',
    run: () => {
      const readWriteOnly = [rule('admin', true, true, false)];
      assert.equal(canWriteHouseholdDomain('member', readWriteOnly, 'admin'), true);
      assert.equal(canApproveHouseholdDomain('member', readWriteOnly, 'admin'), false);
      assert.equal(canApproveHouseholdDomain('member', [rule('admin', true, false, true)], 'admin'), true);
    },
  },
  {
    name: 'read-only role relies on explicit rules and cannot elevate by role alone',
    run: () => {
      assert.equal(isHouseholdManager('read_only'), false);
      assert.equal(canReadHouseholdDomain('read_only', [], 'finance'), false);
      assert.equal(canWriteHouseholdDomain('read_only', [], 'finance'), false);
      assert.equal(canReadHouseholdDomain('read_only', [rule('finance', true, false)], 'finance'), true);
    },
  },
];

let failed = 0;
for (const testCase of cases) {
  try {
    testCase.run();
    process.stdout.write('✓ ' + testCase.name + '\n');
  } catch (error) {
    failed += 1;
    process.stderr.write('✗ ' + testCase.name + '\n');
    process.stderr.write(String(error) + '\n');
  }
}
process.stdout.write('\n' + (cases.length - failed) + '/' + cases.length + ' access-control tests passed\n');
if (failed > 0) process.exitCode = 1;
