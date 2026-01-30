import { describe, it, expect } from '@jest/globals';
import { encrypt, decrypt, hashSensitiveData } from '../../src/utils/encryption.js';

describe('Encryption Utilities', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const plaintext = 'Same text';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?`~"\'';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '你好世界 🌍 مرحبا';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle SSN format', () => {
      const ssn = '123456789';
      const encrypted = encrypt(ssn);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(ssn);
    });
  });

  describe('hashSensitiveData', () => {
    it('should produce consistent hash for same input', () => {
      const data = 'sensitive data';
      const hash1 = hashSensitiveData(data);
      const hash2 = hashSensitiveData(data);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', () => {
      const hash1 = hashSensitiveData('data1');
      const hash2 = hashSensitiveData('data2');

      expect(hash1).not.toBe(hash2);
    });

    it('should return a 64-character hex string (SHA-256)', () => {
      const hash = hashSensitiveData('test');

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });
});
