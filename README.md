# Form Path Explainer

Offline, dependency-free validation for nested forms and JSON. Explains errors using precise field paths, such as `$.items[1]`. No remote API.

## Install and try
Requires Node.js 18 or newer.

```sh
npm install form-path-explainer
```

```js
import {validateForm} from 'form-path-explainer';
console.log(validateForm({email:'bad'},{type:'object',required:['email'],properties:{email:{type:'string',format:'email'}}}));
```

## API
`validateForm(value,schema)` returns `{valid,errors}`.
`validateJson(valueText,schemaText)` parses JSON strings and validates them.

## Supported subset
Types: object, array, string, number, boolean. Required fields, properties, array items, email and basic hostname syntax, string lengths, numeric bounds, integer checks, array cardinality, primitive enums, and optional strict object fields (`additionalProperties: false`). Not a JSON Schema implementation.

## Optional hosted API
The MIT npm package remains fully usable offline with no account. An optional hosted layer is maintained in hosted/ for managed API keys, quotas and Paddle-backed subscription entitlement.

- Pro preview: $3.99/month — 20,000 hosted calls
- Team preview: $8.99/month — 200,000 hosted calls
- Paddle environment defaults to sandbox and live billing requires a separate explicit gate
- Product-specific Paddle sandbox catalog is not connected yet, so payment buttons remain disabled
- Hosted Docker budget: 0.25 vCPU / 256 MiB RAM / 64 PIDs

Sandbox preview: https://form-path.eztoolgo.duckdns.org

See [hosted/README.md](hosted/README.md) for the current implementation and verified safety model.

## Security and limitations
Local-only with no dependencies or network calls. JSON text is limited to 1 MiB each, nesting to 12 levels, arrays to 100 elements, and at most 10,000 visited nodes per validation. Shared schema objects are checked once and independently referenced object values are bounded by the visit budget. Only the first 100 errors are returned. Email syntax checking does not verify mailbox existence. Schema property count is limited to 100; duplicate required keys and cyclic input objects are rejected. Schemas are checked for cycles and accessor properties but are not a substitute for authorization rules. Prototype-related keys are flagged, not executed.

## Troubleshooting
Check the error path and code. Malformed JSON throws SyntaxError; oversized JSON throws RangeError. Run `npm test`.

## What it does
Checks nested objects, arrays, and required fields, returning structured error paths.

## Quick start
Install with `npm install form-path-explainer`, then use the library API or the `form-path-explainer` CLI.

## Common examples
Use `validateForm({items:[true,3]}, {type:'object',properties:{items:{type:'array',items:{type:'boolean'}}}})` to locate an invalid array element.

## Requirements
Node.js 18+, no external dependencies.

## Batch validation and reusable schema
`createValidator(schema)` snapshots the rules once, returns a `value => {valid,errors}` function and does not re-inspect the schema for every record. This is useful for repeated form submissions and avoids later rule mutations silently changing checks. `validateBatch(values, schema, {maxItems:100})` checks up to 100 records and returns `{valid,count,passed,failed,results}` with each record's `index` and field-path errors. Neither API sends data to a server.

## Local CLI and exports (no hosted service required)
After installing the package, run: `form-path-explainer --schema schema.json --input form.json`
Or send stdin: `cat form.json | form-path-explainer --schema schema.json`
Use `--batch` when the input is an array of independent forms; use `--jsonl` for one JSON form per line. Use `--format csv` to export an error table, or `--format jsonl` to export one result per record. Redirect stdout to save a report. The CLI reads at most 1 MiB of input and 1 MiB of schema, and limits batches to 100 records. Exit codes: 0 all valid, 1 validation error(s), 2 invalid input/arguments. Errors are written to stderr without echoing input data.

Rules support `integer`, `minimum`, `maximum`, `minItems`, `maxItems`, primitive `enum`, and `additionalProperties:false`, in addition to the original subset. Full JSON Schema compatibility is not claimed. Unsupported schema keywords and rules used with the wrong type are rejected instead of silently skipped. Dotted field names are escaped as bracket-quoted paths; ordinary identifiers use familiar `$.name` paths.

## TypeScript
Type declarations are included with the package (`src/index.d.ts`), with no compiler or runtime dependency. The package remains ESM-only.

Every validation error also includes an RFC 6901 JSON Pointer field named `pointer`. The `pathToPointer` helper converts field paths, including escaped names, to pointers. CSV output includes this machine-readable pointer column.

## Actionable errors in English and Korean
`explainError(result.errors[0], 'en')` and `explainError(result.errors[0], 'ko')` return human-readable descriptions without exposing submitted values. Numeric and length-rule errors include `limit`, for example the configured minimum. The CLI supports `--locale ko` for CSV export.

## Optional HTTP handler for existing serverless infrastructure
The library exports `createFormHttpHandler` from `form-path-explainer/http`. It accepts a standard Web `Request` and returns a standard `Response` without opening a socket, starting a worker, storing data, or changing the free local API. It is not a deployed service. Supply your own **server-side** `authorize(request)` and **atomic** `consumeQuota(request)` callbacks. If omitted, the handler cannot be created. Passing `true` unconditionally is suitable only for isolated tests, **not for production**.

Only JSON POST bodies are accepted: either `{ "schema": { ... }, "value": { ... } }` or `{ "schema": { ... }, "values": [{ ... }] }`. Default body limit is 64 KiB (configurable up to 1 MiB). Invalid field values return HTTP 200 with `{valid:false,errors}` so clients can display field errors; malformed requests and policy errors use HTTP 400/413/415. Responses disable caching, omit permissive CORS, and avoid echoing untrusted request text on failures.

**Release blocker:** never publicly deploy or charge for this handler until independently verified authentication, atomic quotas, traffic-abuse limits, authorization checks, applicable legal policies, backout and restore tests, and approved pricing/payment are complete. No production credentials, payment entitlement, rate-limit database or public hosting are included in this package.

## Inferring a conservative schema from real samples
When onboarding an existing form, `inferFormSchema([{name:'A',age:3},{name:'B'}])` from `form-path-explainer/infer` returns `{schema,records}`. This supports nested records, optional fields that occur in only some samples, homogenous arrays, and integer/number promotion. It does **not** infer email syntax, numeric bounds, field privacy, permissions, or real business requirements. Conflicting types and null/undefined values fail closed instead of generating a misleading rule.

For the CLI, run `form-path-explainer --infer --input examples.json > draft-schema.json`, where `examples.json` is an array of up to 100 sample form records. Use `--closed` to set `additionalProperties: false` on inferred objects; the default permits unknown fields. `--jsonl` can be combined with `--infer` to read one training example per line. Inspect the generated rules before using them in authorization or production validation. Samples remain local and are never embedded verbatim in the schema.

## Privacy-minimized field failure summary
`import {summarizeFormBatch} from 'form-path-explainer/report'` produces a deterministic aggregated breakdown of field-level errors from up to 100 form submissions. It reports counts, rates, error codes, short explanations, and at most five record indices per group. Raw values are never included. Use `form-path-explainer --schema rules.json --input submissions.json --batch --summary --locale ko` to generate a Korean JSON error summary. `--summary` is limited to batch/JSONL input and JSON output.

CLI input decoding uses strict UTF-8. Invalid byte sequences cause input errors instead of silent replacement; standard UTF-8 BOM-prefixed JSON is accepted.

## Validate rule sets before processing data
`inspectFormSchema(schema)` checks every nested supported rule, including optional fields not present in the current form. Invalid limits, unsupported keywords, malformed nested item/property rules, cycles and unsafe getters are reported even if no matching input exists. This avoids accidentally shipping a rule that is silently skipped. Errors from this preflight describe the rule type at the root path; they do not include submitted data. Use `--check-schema --schema rules.json` in the CLI for a standalone preflight (exit 0 for valid, 1 for invalid). This is not a full JSON Schema vocabulary validator.

## Bounded streaming JSON Lines validation

For offline datasets larger than the CLI's 100-record batch cap, use
`validateJsonlStream` from `form-path-explainer/stream`. The async generator
accepts UTF-8 byte chunks or string chunks, returns one privacy-minimized result
per record, and does not buffer the entire input. It has no server or network dependency.

```js
import {createReadStream} from 'node:fs';
import {validateJsonlStream} from 'form-path-explainer/stream';
const schema = {type:'object',required:['ok'],properties:{ok:{type:'boolean'}}};
for await (const result of validateJsonlStream(createReadStream('forms.jsonl'),schema)) {
  console.log(JSON.stringify(result));
}
```

Defaults: at most 10,000 records and 1 MiB per line; configurable hard caps
100,000 records and 1 MiB per line. Invalid UTF-8 rejects processing, malformed
JSON produces `INVALID_JSON` without exposing submitted text, and record
results include 0-based `index` and 1-based `line`. No record contents are
retained by the validator. Do not treat this validation as authentication.


## Compare real fixture acceptance across rule revisions (next-release candidate)

Run one local command with previous and proposed rule files and an array of 1–100 JSON fixtures:

    form-path-regression previous.json proposed.json fixtures.json

The report distinguishes newly rejected, newly accepted and unchanged records by zero-based fixture index. It does not echo values, paths or schema keys. Exit 1 means an observed acceptance change in either direction; exit 2 means invalid input or a validation limit/indeterminate result. Each input file is capped at 1 MiB. Only the existing supported rule subset is accepted, not arbitrary JSON Schema. No claim of universal schema compatibility: results apply only to supplied fixtures. This source includes the feature. Check the npm registry for the published version before installation; a staging placeholder is not a usable release.


### Optional managed automation runner (next hosted release)

Compare before and after validation rules against the same JSON fixtures. Two calls per fixture. A changed or indeterminate verdict blocks CI.

Download the runner and synthetic input from /automation. Run node automation.mjs automation-example.json locally to preview the call count; pass --send with EZTOOLGO_API_KEY configured to submit checks to the existing managed API. No subscription price, authentication, entitlement, or billing changes. The runner does not persist user input or keys and outputs a redacted release verdict. Default 100 calls, explicit maximum 500. No automatic retries. Review candidate; not deployed.
