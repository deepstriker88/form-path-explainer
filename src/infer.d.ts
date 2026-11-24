import type {SchemaRule} from './index.js';
export declare class SchemaInferenceError extends Error {
  readonly code: string;
  readonly path: string;
}
export interface InferenceOptions {
  /** Set additionalProperties: false recursively on inferred objects. */
  closedObjects?: boolean;
}
/** Conservative draft from 1–100 representative samples; no input value retention. */
export declare function inferFormSchema(samples: readonly unknown[], options?: InferenceOptions): {
  schema: SchemaRule;
  records: number;
};
