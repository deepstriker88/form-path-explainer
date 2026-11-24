/** Rules supported by Form Path Explainer; intentionally not full JSON Schema. */
export type PrimitiveValue = string | number | boolean | null;
export interface BaseRule { enum?: readonly PrimitiveValue[] }
export interface StringRule extends BaseRule { type: 'string'; minLength?: number; maxLength?: number; format?: 'email' | 'hostname' }
export interface NumberRule extends BaseRule { type: 'number' | 'integer'; minimum?: number; maximum?: number }
export interface BooleanRule extends BaseRule { type: 'boolean' }
export interface ArrayRule extends BaseRule { type: 'array'; items?: SchemaRule; minItems?: number; maxItems?: number }
export interface ObjectRule extends BaseRule { type: 'object'; required?: readonly string[]; properties?: Readonly<Record<string, SchemaRule>>; additionalProperties?: boolean }
export type SchemaRule = StringRule | NumberRule | BooleanRule | ArrayRule | ObjectRule;
export type ValueType = SchemaRule['type'];
export interface ValidationError { path: string; pointer: string; code: string; expected?: ValueType; limit?: number }
export interface ValidationResult { valid: boolean; errors: ValidationError[] }
export interface BatchResult { valid: boolean; count: number; passed: number; failed: number; results: Array<ValidationResult & {index: number}> }
export interface BatchOptions { maxItems?: number }
export declare function validateForm(value: unknown, schema: SchemaRule): ValidationResult;
export declare function validateJson(valueText: string, schemaText: string): ValidationResult;
export declare function createValidator(schema: SchemaRule): (value: unknown) => ValidationResult;
export declare function validateBatch(values: readonly unknown[], schema: SchemaRule, options?: BatchOptions): BatchResult;
/** Converts a field path to an RFC 6901 pointer. */
export declare function pathToPointer(path: string): string;

export declare function explainError(error: Partial<ValidationError> | null | undefined, locale?: 'en' | 'ko'): string;

/** Checks the complete supported rule tree before examining any input records. */
export declare function inspectFormSchema(schema: unknown): ValidationResult;
