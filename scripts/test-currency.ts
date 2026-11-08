import assert from 'node:assert/strict';
import { formatCents, fromCents, parseCurrencyInput, toCents } from '../src/lib/currency.ts';

const cases: Array<{ name: string; run: () => void }> = [
  {
    name: 'converts decimal strings without floating-point artifacts',
    run: () => {
      assert.equal(toCents('19.99'), 1999);
      assert.equal(toCents('0.1'), 10);
      assert.equal(toCents('100'), 10000);
      assert.equal(toCents('-50.25'), -5025);
    },
  },
  {
    name: 'rounds numeric inputs using decimal half-up semantics',
    run: () => {
      assert.equal(toCents(1.005), 101);
      assert.equal(toCents(-1.005), -101);
      assert.equal(toCents(19.999), 2000);
      assert.equal(toCents(19.994), 1999);
    },
  },
  {
    name: 'rejects malformed strings and values outside the safe integer range',
    run: () => {
      assert.equal(toCents('1.234'), 0);
      assert.equal(toCents('₪19.99'), 0);
      assert.equal(toCents('1,000.00'), 0);
      assert.equal(toCents('90071992547410'), 0);
      assert.equal(toCents(Number.POSITIVE_INFINITY), 0);
      assert.equal(toCents(null), 0);
    },
  },
  {
    name: 'parses only correctly grouped thousands separators',
    run: () => {
      assert.deepEqual(parseCurrencyInput('1,234.56'), { valid: true, cents: 123456 });
      assert.deepEqual(parseCurrencyInput('-12.5'), { valid: true, cents: -1250 });
      assert.equal(parseCurrencyInput('1,23').valid, false);
      assert.equal(parseCurrencyInput('12.345').valid, false);
      assert.equal(parseCurrencyInput('1,234,56').valid, false);
    },
  },
  {
    name: 'round-trips integer cents and formats negative values consistently',
    run: () => {
      assert.equal(fromCents(12345), 123.45);
      assert.equal(formatCents(12345, 'ILS'), '₪123.45');
      assert.equal(formatCents(-12345, 'USD'), '-$123.45');
      assert.equal(formatCents(0, 'EUR'), '€0.00');
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
process.stdout.write('\n' + (cases.length - failed) + '/' + cases.length + ' currency tests passed\n');
if (failed > 0) process.exitCode = 1;
