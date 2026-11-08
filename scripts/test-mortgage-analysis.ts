import assert from 'node:assert/strict';
import { parseMortgageText } from '../src/lib/mortgageAnalysis.ts';
const sample = [
  'דוח פרטי הלוואה לדיור','נכון ליום 31/10/2026',
  'יתרת המשכנתא לסילוק 742,350.50 ₪','החזר חודשי 4,820.00 ₪',
  'מסלול פריים יתרה 245,000.00 ריבית 5.75%',
  'מסלול קבועה לא צמודה יתרה 312,350.50 ריבית 4.10%',
  'מסלול משתנה צמודה יתרה 185,000.00 ריבית 3.20%',
  'תשלום הבא 10/11/2026',
].join('\n');
const result = parseMortgageText(sample);
assert.equal(result.reportDate, '2026-10-31');
assert.equal(result.outstandingBalanceCents, 74235050);
assert.equal(result.monthlyPaymentCents, 482000);
assert.equal(result.nextPaymentDate, '2026-11-10');
assert.equal(result.tracks.length, 3);
assert.equal(result.tracks[0].type, 'PRIME');
assert.equal(result.tracks[0].annualInterestRate, 5.75);
assert.equal(result.tracks[1].type, 'FIXED_UNLINKED');
assert.equal(result.confidence, 'high');
const sparse = parseMortgageText('דוח משכנתא ללא נתונים מזוהים');
assert.equal(sparse.confidence, 'low');
assert.equal(sparse.outstandingBalanceCents, undefined);
process.stdout.write('✓ mortgage statement extraction regression tests passed\n');
