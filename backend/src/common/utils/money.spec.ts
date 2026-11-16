import { centsToDecimal, fromCents, toCents } from './money.js';

describe('money utilities', () => {
  it('converts ARS values to integer cents without floating point arithmetic', () => {
    expect(toCents(0.29)).toBe(29n);
    expect(toCents('99999999.99')).toBe(9_999_999_999n);
    expect(centsToDecimal(9_999_999_999n)).toBe('99999999.99');
    expect(fromCents(-29n)).toBe(-0.29);
  });

  it('rejects monetary values with unsupported precision or notation', () => {
    expect(() => toCents(1.001)).toThrow(RangeError);
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
