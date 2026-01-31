import { TransformationFn, TransformationDefinition, TransformationTestResult } from '../types/mapping.types.js';
import { FieldDataType, TransformationFunctionType } from '@prisma/client';

import {
  stringTransformations,
  stringTransformationDefinitions,
} from './string.transformations.js';

import {
  numericTransformations,
  numericTransformationDefinitions,
} from './numeric.transformations.js';

import {
  dateTransformations,
  dateTransformationDefinitions,
} from './date.transformations.js';

import {
  validationTransformations,
  validationTransformationDefinitions,
} from './validation.transformations.js';

import {
  lookupTransformations,
  lookupTransformationDefinitions,
} from './lookup.transformations.js';

// ============================================
// All Transformations Combined
// ============================================

export const allTransformations: Record<string, TransformationFn> = {
  ...stringTransformations,
  ...numericTransformations,
  ...dateTransformations,
  ...validationTransformations,
  ...lookupTransformations,
};

export const allTransformationDefinitions: TransformationDefinition[] = [
  ...stringTransformationDefinitions,
  ...numericTransformationDefinitions,
  ...dateTransformationDefinitions,
  ...validationTransformationDefinitions,
  ...lookupTransformationDefinitions,
];

// ============================================
// Transformation Service
// ============================================

export class TransformationService {
  private transformations: Map<string, TransformationFn> = new Map();
  private definitions: Map<string, TransformationDefinition> = new Map();

  constructor() {
    this.registerBuiltInTransformations();
  }

  /**
   * Register all built-in transformation functions
   */
  private registerBuiltInTransformations(): void {
    for (const [name, fn] of Object.entries(allTransformations)) {
      this.transformations.set(name, fn);
    }

    for (const def of allTransformationDefinitions) {
      this.definitions.set(def.name, def);
    }
  }

  /**
   * Execute a transformation by name
   */
  transform(name: string, value: unknown, params?: Record<string, unknown>): unknown {
    const fn = this.transformations.get(name);
    if (!fn) {
      throw new Error(`Unknown transformation: ${name}`);
    }
    return fn(value, params);
  }

  /**
   * Test a transformation with sample input
   */
  testTransformation(
    name: string,
    input: unknown,
    params?: Record<string, unknown>
  ): TransformationTestResult {
    try {
      const output = this.transform(name, input, params);
      return {
        success: true,
        input,
        output,
      };
    } catch (error) {
      return {
        success: false,
        input,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Register a custom transformation
   */
  registerTransformation(
    name: string,
    fn: TransformationFn,
    definition?: Omit<TransformationDefinition, 'name'>
  ): void {
    this.transformations.set(name, fn);

    if (definition) {
      this.definitions.set(name, { name, ...definition });
    }
  }

  /**
   * Check if a transformation exists
   */
  hasTransformation(name: string): boolean {
    return this.transformations.has(name);
  }

  /**
   * Get all available transformations
   */
  listTransformations(): TransformationDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Get transformations by type
   */
  getTransformationsByType(type: TransformationFunctionType): TransformationDefinition[] {
    return Array.from(this.definitions.values()).filter(
      (def) => def.functionType === type
    );
  }

  /**
   * Get transformation definition by name
   */
  getTransformation(name: string): TransformationDefinition | undefined {
    return this.definitions.get(name);
  }

  /**
   * Get transformation function by name
   */
  getTransformationFn(name: string): TransformationFn | undefined {
    return this.transformations.get(name);
  }

  /**
   * Apply a chain of transformations
   */
  chain(
    value: unknown,
    transformations: Array<{ name: string; params?: Record<string, unknown> }>
  ): unknown {
    let result = value;
    for (const { name, params } of transformations) {
      result = this.transform(name, result, params);
    }
    return result;
  }

  /**
   * Validate transformation test cases
   */
  validateTestCases(
    name: string,
    testCases: Array<{ input: unknown; expectedOutput: unknown; params?: Record<string, unknown> }>
  ): Array<{ passed: boolean; input: unknown; expected: unknown; actual: unknown }> {
    const results: Array<{ passed: boolean; input: unknown; expected: unknown; actual: unknown }> = [];

    for (const testCase of testCases) {
      const result = this.testTransformation(name, testCase.input, testCase.params);
      const passed = result.success && result.output === testCase.expectedOutput;

      results.push({
        passed,
        input: testCase.input,
        expected: testCase.expectedOutput,
        actual: result.success ? result.output : result.error,
      });
    }

    return results;
  }
}

// Export a singleton instance for convenience
export const transformationService = new TransformationService();

// Re-export individual modules
export * from './string.transformations.js';
export * from './numeric.transformations.js';
export * from './date.transformations.js';
export * from './validation.transformations.js';
export * from './lookup.transformations.js';

// Re-export types
export type { TransformationFn, TransformationDefinition, TransformationTestResult };
export { FieldDataType, TransformationFunctionType };
