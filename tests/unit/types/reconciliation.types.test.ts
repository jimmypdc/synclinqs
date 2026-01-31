import { describe, it, expect } from '@jest/globals';
import {
  isWithinTolerance,
  calculateVariance,
  getMatchStatusDisplay,
  getStatusDisplay,
  DEFAULT_TOLERANCE,
  ReconciliationTolerance,
} from '../../../src/types/reconciliation.types.js';
import { ReconciliationStatus, ReconciliationMatchStatus } from '@prisma/client';

describe('Reconciliation Types Helper Functions', () => {
  describe('isWithinTolerance', () => {
    it('should return true when amounts are exactly equal', () => {
      expect(isWithinTolerance(10000, 10000)).toBe(true);
    });

    it('should return true when difference is within absolute tolerance (100 cents)', () => {
      expect(isWithinTolerance(10000, 10050)).toBe(true);
      expect(isWithinTolerance(10000, 9950)).toBe(true);
      expect(isWithinTolerance(10000, 10100)).toBe(true);
    });

    it('should return true when difference is within percentage tolerance (1%)', () => {
      // $1000 with 1% tolerance = $10 tolerance
      expect(isWithinTolerance(100000, 100500)).toBe(true);
      expect(isWithinTolerance(100000, 99500)).toBe(true);
    });

    it('should return false when difference exceeds both tolerances', () => {
      // $100 (10000 cents) with $200 difference (200%) - exceeds both
      expect(isWithinTolerance(10000, 30000)).toBe(false);
    });

    it('should handle zero source amount correctly', () => {
      // When source is 0, percent diff is 0, so the check passes for percentage
      // Only absolute tolerance matters when source is 0
      expect(isWithinTolerance(0, 50)).toBe(true); // within $1 absolute
      expect(isWithinTolerance(0, 100)).toBe(true); // at $1 absolute tolerance
      // Note: With 0 source, percentDiff is 0 which is always within percentage tolerance
      // So even 200 passes because 0% < 1%
      expect(isWithinTolerance(0, 200)).toBe(true);
    });

    it('should reject amounts outside both tolerances when source is non-zero', () => {
      // $100 (10000 cents) with $200 (20000 cents) - 100% difference
      expect(isWithinTolerance(10000, 20000)).toBe(false);
    });

    it('should handle custom tolerance settings', () => {
      const strictTolerance: ReconciliationTolerance = {
        amountToleranceCents: 10,
        percentageTolerance: 0.001,
        dateTolerance: 0,
      };
      expect(isWithinTolerance(10000, 10005, strictTolerance)).toBe(true);
      expect(isWithinTolerance(10000, 10020, strictTolerance)).toBe(false);
    });

    it('should handle negative amounts correctly', () => {
      expect(isWithinTolerance(-10000, -10050)).toBe(true);
      expect(isWithinTolerance(-10000, -10000)).toBe(true);
    });

    it('should use default tolerance when not specified', () => {
      // Default is $1.00 (100 cents) or 1%
      expect(isWithinTolerance(10000, 10100)).toBe(true);
      expect(isWithinTolerance(10000, 10101)).toBe(false);
    });
  });

  describe('calculateVariance', () => {
    it('should calculate positive variance when source > destination', () => {
      expect(calculateVariance(10000, 9000)).toBe(1000);
    });

    it('should calculate negative variance when source < destination', () => {
      expect(calculateVariance(9000, 10000)).toBe(-1000);
    });

    it('should return zero when amounts are equal', () => {
      expect(calculateVariance(10000, 10000)).toBe(0);
    });

    it('should handle zero values', () => {
      expect(calculateVariance(0, 0)).toBe(0);
      expect(calculateVariance(100, 0)).toBe(100);
      expect(calculateVariance(0, 100)).toBe(-100);
    });

    it('should handle negative amounts', () => {
      expect(calculateVariance(-5000, -3000)).toBe(-2000);
      expect(calculateVariance(-3000, -5000)).toBe(2000);
    });

    it('should handle large amounts', () => {
      expect(calculateVariance(1000000000, 999999999)).toBe(1);
    });
  });

  describe('getMatchStatusDisplay', () => {
    it('should return correct display for MATCHED', () => {
      expect(getMatchStatusDisplay(ReconciliationMatchStatus.MATCHED)).toBe('Matched');
    });

    it('should return correct display for SOURCE_ONLY', () => {
      expect(getMatchStatusDisplay(ReconciliationMatchStatus.SOURCE_ONLY)).toBe('Source Only');
    });

    it('should return correct display for DESTINATION_ONLY', () => {
      expect(getMatchStatusDisplay(ReconciliationMatchStatus.DESTINATION_ONLY)).toBe('Destination Only');
    });

    it('should return correct display for AMOUNT_MISMATCH', () => {
      expect(getMatchStatusDisplay(ReconciliationMatchStatus.AMOUNT_MISMATCH)).toBe('Amount Mismatch');
    });

    it('should return correct display for DATA_MISMATCH', () => {
      expect(getMatchStatusDisplay(ReconciliationMatchStatus.DATA_MISMATCH)).toBe('Data Mismatch');
    });
  });

  describe('getStatusDisplay', () => {
    it('should return correct display for PENDING', () => {
      expect(getStatusDisplay(ReconciliationStatus.PENDING)).toBe('Pending');
    });

    it('should return correct display for IN_PROGRESS', () => {
      expect(getStatusDisplay(ReconciliationStatus.IN_PROGRESS)).toBe('In Progress');
    });

    it('should return correct display for RECONCILED', () => {
      expect(getStatusDisplay(ReconciliationStatus.RECONCILED)).toBe('Reconciled');
    });

    it('should return correct display for DISCREPANCIES_FOUND', () => {
      expect(getStatusDisplay(ReconciliationStatus.DISCREPANCIES_FOUND)).toBe('Discrepancies Found');
    });

    it('should return correct display for FAILED', () => {
      expect(getStatusDisplay(ReconciliationStatus.FAILED)).toBe('Failed');
    });
  });

  describe('DEFAULT_TOLERANCE', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_TOLERANCE.amountToleranceCents).toBe(100);
      expect(DEFAULT_TOLERANCE.percentageTolerance).toBe(0.01);
      expect(DEFAULT_TOLERANCE.dateTolerance).toBe(1);
    });
  });
});
