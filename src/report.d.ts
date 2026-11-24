import type {SchemaRule,ValueType} from './index.js';
export interface IssueSummary {
  path: string;
  pointer: string;
  code: string;
  affectedRows: number;
  exampleIndices: number[];
  message: string;
  percentOfRows: number;
  expected?: ValueType;
  limit?: number;
}
export interface FormBatchReport {
  rows: number;
  passed: number;
  failed: number;
  totalErrors: number;
  issues: IssueSummary[];
}
export declare function summarizeFormBatch(
  values: readonly unknown[],
  schema: SchemaRule,
  options?: {maxItems?:number;locale?:'en'|'ko'}
): FormBatchReport;
