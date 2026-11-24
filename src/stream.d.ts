import type {SchemaRule, ValidationResult} from './index.js';
export interface StreamOptions {
  maxRecords?: number;
  maxLineBytes?: number;
  skipBlank?: boolean;
}
export interface StreamRecord extends ValidationResult {
  index: number;
  line: number;
}
/** Validates bounded UTF-8 JSONL records without buffering the whole input. */
export declare function validateJsonlStream(
  chunks: AsyncIterable<string | Uint8Array>,
  schema: SchemaRule,
  options?: StreamOptions
): AsyncGenerator<StreamRecord, void, unknown>;
