import { describe, it, expect } from '@jest/globals';
import {
  getStatusDisplay,
  getRecordTypeDisplay,
  getMatchTypeDisplay,
  calculateTotalMatchScore,
  isPotentialDuplicate,
  getMatchingConfig,
  levenshteinDistance,
  stringSimilarity,
  normalizeSSN,
  normalizePhone,
  normalizeName,
  DEFAULT_CONTRIBUTION_MATCHING,
  DEFAULT_EMPLOYEE_MATCHING,
  MatchFieldResult,
  MatchingConfig,
} from '../../../src/types/deduplication.types.js';
import { DeduplicationStatus } from '@prisma/client';

describe('Deduplication Types Helper Functions', () => {
  describe('getStatusDisplay', () => {
    it('should return correct display for POTENTIAL_DUPLICATE', () => {
      expect(getStatusDisplay(DeduplicationStatus.POTENTIAL_DUPLICATE)).toBe('Potential Duplicate');
    });

    it('should return correct display for CONFIRMED_DUPLICATE', () => {
      expect(getStatusDisplay(DeduplicationStatus.CONFIRMED_DUPLICATE)).toBe('Confirmed Duplicate');
    });

    it('should return correct display for NOT_DUPLICATE', () => {
      expect(getStatusDisplay(DeduplicationStatus.NOT_DUPLICATE)).toBe('Not a Duplicate');
    });

    it('should return correct display for MERGED', () => {
      expect(getStatusDisplay(DeduplicationStatus.MERGED)).toBe('Merged');
    });
  });

  describe('getRecordTypeDisplay', () => {
    it('should return correct display for contribution', () => {
      expect(getRecordTypeDisplay('contribution')).toBe('Contribution');
    });

    it('should return correct display for employee', () => {
      expect(getRecordTypeDisplay('employee')).toBe('Employee');
    });

    it('should return correct display for election', () => {
      expect(getRecordTypeDisplay('election')).toBe('Election');
    });

    it('should return correct display for loan', () => {
      expect(getRecordTypeDisplay('loan')).toBe('Loan');
    });
  });

  describe('getMatchTypeDisplay', () => {
    it('should return correct display for exact match', () => {
      expect(getMatchTypeDisplay('exact')).toBe('Exact Match');
    });

    it('should return correct display for fuzzy match', () => {
      expect(getMatchTypeDisplay('fuzzy')).toBe('Fuzzy Match');
    });

    it('should return correct display for normalized match', () => {
      expect(getMatchTypeDisplay('normalized')).toBe('Normalized Match');
    });

    it('should return correct display for phonetic match', () => {
      expect(getMatchTypeDisplay('phonetic')).toBe('Phonetic Match');
    });

    it('should return correct display for numeric_tolerance', () => {
      expect(getMatchTypeDisplay('numeric_tolerance')).toBe('Numeric (with tolerance)');
    });
  });

  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    it('should return string length for empty vs non-empty', () => {
      expect(levenshteinDistance('', 'hello')).toBe(5);
      expect(levenshteinDistance('hello', '')).toBe(5);
    });

    it('should return 0 for two empty strings', () => {
      expect(levenshteinDistance('', '')).toBe(0);
    });

    it('should return 1 for single character difference', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1);
    });

    it('should return 3 for "kitten" vs "sitting"', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });

    it('should handle case sensitivity', () => {
      expect(levenshteinDistance('Hello', 'hello')).toBe(1);
    });

    it('should return correct distance for insertion', () => {
      expect(levenshteinDistance('cat', 'cats')).toBe(1);
    });

    it('should return correct distance for deletion', () => {
      expect(levenshteinDistance('cats', 'cat')).toBe(1);
    });
  });

  describe('stringSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(stringSimilarity('hello', 'hello')).toBe(1);
    });

    it('should return 0 for empty vs non-empty strings', () => {
      // Two empty strings are identical, so similarity is 1
      // The function explicitly checks for empty and returns 0 after the identity check
      expect(stringSimilarity('hello', '')).toBe(0);
      expect(stringSimilarity('', 'hello')).toBe(0);
    });

    it('should return 1 for two empty strings (identical)', () => {
      // Two identical strings (even if empty) return 1
      expect(stringSimilarity('', '')).toBe(1);
    });

    it('should be case insensitive', () => {
      expect(stringSimilarity('Hello', 'hello')).toBe(1);
      expect(stringSimilarity('WORLD', 'world')).toBe(1);
    });

    it('should return high similarity for similar strings', () => {
      const similarity = stringSimilarity('John', 'Jon');
      expect(similarity).toBeGreaterThan(0.7);
    });

    it('should return low similarity for different strings', () => {
      const similarity = stringSimilarity('abc', 'xyz');
      expect(similarity).toBeLessThan(0.5);
    });

    it('should handle strings of different lengths', () => {
      const similarity = stringSimilarity('test', 'testing');
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('normalizeSSN', () => {
    it('should remove dashes from SSN format', () => {
      expect(normalizeSSN('123-45-6789')).toBe('123456789');
    });

    it('should handle SSN with spaces', () => {
      expect(normalizeSSN('123 45 6789')).toBe('123456789');
    });

    it('should return only digits', () => {
      expect(normalizeSSN('(123) 45-6789')).toBe('123456789');
    });

    it('should handle SSN without dashes', () => {
      expect(normalizeSSN('123456789')).toBe('123456789');
    });

    it('should return empty string for non-digit input', () => {
      expect(normalizeSSN('abc-de-fghi')).toBe('');
    });
  });

  describe('normalizePhone', () => {
    it('should remove all non-digit characters', () => {
      expect(normalizePhone('(555) 123-4567')).toBe('5551234567');
    });

    it('should handle phone with country code', () => {
      expect(normalizePhone('+1-555-123-4567')).toBe('15551234567');
    });

    it('should handle phone with dots', () => {
      expect(normalizePhone('555.123.4567')).toBe('5551234567');
    });

    it('should handle phone without formatting', () => {
      expect(normalizePhone('5551234567')).toBe('5551234567');
    });
  });

  describe('normalizeName', () => {
    it('should convert to lowercase', () => {
      expect(normalizeName('JOHN')).toBe('john');
    });

    it('should trim whitespace', () => {
      expect(normalizeName('  John  ')).toBe('john');
    });

    it('should remove punctuation', () => {
      expect(normalizeName("O'Brien")).toBe('obrien');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeName('John    Doe')).toBe('john doe');
    });

    it('should handle names with hyphens', () => {
      expect(normalizeName('Mary-Jane')).toBe('maryjane');
    });

    it('should handle complex names', () => {
      expect(normalizeName("  JOHN  O'CONNOR-SMITH  ")).toBe('john oconnorsmith');
    });
  });

  describe('calculateTotalMatchScore', () => {
    it('should return 0 when no matches', () => {
      const matches: MatchFieldResult[] = [];
      expect(calculateTotalMatchScore(matches, DEFAULT_CONTRIBUTION_MATCHING)).toBe(0);
    });

    it('should calculate weighted score correctly', () => {
      const matches: MatchFieldResult[] = [
        { fieldName: 'employeeId', originalValue: '1', duplicateValue: '1', matchType: 'exact', similarity: 1 },
        { fieldName: 'payrollDate', originalValue: '2024-01-01', duplicateValue: '2024-01-01', matchType: 'exact', similarity: 1 },
      ];
      // employeeId: weight 0.3, payrollDate: weight 0.25
      // Score = (1*0.3 + 1*0.25) / (0.3 + 0.25) = 0.55 / 0.55 = 1
      expect(calculateTotalMatchScore(matches, DEFAULT_CONTRIBUTION_MATCHING)).toBe(1);
    });

    it('should handle missing rules in config', () => {
      const matches: MatchFieldResult[] = [
        { fieldName: 'unknownField', originalValue: 'a', duplicateValue: 'a', matchType: 'exact', similarity: 1 },
      ];
      expect(calculateTotalMatchScore(matches, DEFAULT_CONTRIBUTION_MATCHING)).toBe(0);
    });

    it('should use similarity value when provided', () => {
      const matches: MatchFieldResult[] = [
        { fieldName: 'employeeId', originalValue: '1', duplicateValue: '1', matchType: 'exact', similarity: 0.8 },
      ];
      // Only one field with weight 0.3, similarity 0.8
      // Score = 0.8 * 0.3 / 0.3 = 0.8
      expect(calculateTotalMatchScore(matches, DEFAULT_CONTRIBUTION_MATCHING)).toBe(0.8);
    });

    it('should default exact match to 1 when no similarity provided', () => {
      const matches: MatchFieldResult[] = [
        { fieldName: 'employeeId', originalValue: '1', duplicateValue: '1', matchType: 'exact' },
      ];
      expect(calculateTotalMatchScore(matches, DEFAULT_CONTRIBUTION_MATCHING)).toBe(1);
    });

    it('should default non-exact match to 0 when no similarity provided', () => {
      const matches: MatchFieldResult[] = [
        { fieldName: 'employeeId', originalValue: '1', duplicateValue: '2', matchType: 'fuzzy' },
      ];
      expect(calculateTotalMatchScore(matches, DEFAULT_CONTRIBUTION_MATCHING)).toBe(0);
    });
  });

  describe('isPotentialDuplicate', () => {
    it('should return true when score >= minimumScore', () => {
      expect(isPotentialDuplicate(0.9, DEFAULT_CONTRIBUTION_MATCHING)).toBe(true);
      expect(isPotentialDuplicate(0.95, DEFAULT_CONTRIBUTION_MATCHING)).toBe(true);
    });

    it('should return false when score < minimumScore', () => {
      expect(isPotentialDuplicate(0.5, DEFAULT_CONTRIBUTION_MATCHING)).toBe(false);
      expect(isPotentialDuplicate(0.89, DEFAULT_CONTRIBUTION_MATCHING)).toBe(false);
    });

    it('should return true at exact threshold', () => {
      expect(isPotentialDuplicate(0.9, DEFAULT_CONTRIBUTION_MATCHING)).toBe(true);
    });

    it('should work with different configs', () => {
      expect(isPotentialDuplicate(0.85, DEFAULT_EMPLOYEE_MATCHING)).toBe(true);
      expect(isPotentialDuplicate(0.84, DEFAULT_EMPLOYEE_MATCHING)).toBe(false);
    });
  });

  describe('getMatchingConfig', () => {
    it('should return contribution config for contribution type', () => {
      const config = getMatchingConfig('contribution');
      expect(config.recordType).toBe('contribution');
      expect(config.minimumScore).toBe(0.9);
    });

    it('should return employee config for employee type', () => {
      const config = getMatchingConfig('employee');
      expect(config.recordType).toBe('employee');
      expect(config.minimumScore).toBe(0.85);
    });

    it('should return election config for election type', () => {
      const config = getMatchingConfig('election');
      expect(config.recordType).toBe('election');
    });

    it('should return loan config for loan type', () => {
      const config = getMatchingConfig('loan');
      expect(config.recordType).toBe('loan');
    });
  });

  describe('DEFAULT_CONTRIBUTION_MATCHING', () => {
    it('should have correct structure', () => {
      expect(DEFAULT_CONTRIBUTION_MATCHING.recordType).toBe('contribution');
      expect(DEFAULT_CONTRIBUTION_MATCHING.minimumScore).toBe(0.9);
      expect(DEFAULT_CONTRIBUTION_MATCHING.rules).toHaveLength(5);
      expect(DEFAULT_CONTRIBUTION_MATCHING.blockingFields).toContain('employeeId');
    });
  });

  describe('DEFAULT_EMPLOYEE_MATCHING', () => {
    it('should have correct structure', () => {
      expect(DEFAULT_EMPLOYEE_MATCHING.recordType).toBe('employee');
      expect(DEFAULT_EMPLOYEE_MATCHING.minimumScore).toBe(0.85);
      expect(DEFAULT_EMPLOYEE_MATCHING.rules).toHaveLength(5);
      expect(DEFAULT_EMPLOYEE_MATCHING.blockingFields).toContain('organizationId');
    });
  });
});
