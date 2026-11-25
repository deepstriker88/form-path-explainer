# Compact landing review — 2026-11-26 KST

Owner's first-screen, minimal-scroll rule recovered from the November 21
WebURL discussion. Previous landing QA checked horizontal overflow but not
document height. This is a layout/interaction regression, not a reason to
add unrelated product features.

Design: shared existing EZTOOLGO dark-neutral/mint visual vocabulary;
system fonts; first-screen product outcome, free browser action, comparison
action, concrete differentiation, published npm/source and actual local
example. Details and prices open in native dialogs. Legal/support links
remain visible. 44px main controls, readable inputs. Tiny/zoomed viewports
may scroll rather than clip. The initial page must fit 360x740, 390x844,
768x1024, 1024x768, 1280x720, 1440x900 and 1920x1080; 320x568 must keep the
primary and review actions visible. No body overflow hiding.

Actual browser sample invokes the existing product core with synthetic
fixtures. No external request or POST before checkout. Real inputs use
separate /try and /review routes with strict CSP. The server demo is explicitly
labeled and available only in View more. Paddle script is not loaded in
sandbox and is loaded only after live configuration and a plans click.
Sandbox checkout remains disabled. Configured prices are previews, not
verified charges; live provider approval is not inferred.

Reference review: existing first-party WebURL landing, Apple HIG layout and
design principles (https://developer.apple.com/design/human-interface-guidelines/layout),
DevUtils offline workflow (https://devutils.com/docs/json-formatter-validator/),
Postman schema-validation workflow (https://learning.postman.com/flows/reference/blocks/validate).
No third-party code, visual assets or branding copied. No claim of superior
conversion or full schema compatibility.

QA: hosted tests and real Chromium CI gate on exact commit. Screenshots,
document height, controls, sample pass/fail, no-input network transmission,
sandbox billing refusal and modal keyboard dismissal. No Chromium installed
on the Oracle host. Results pending until exact CI passes. No npm version
change, public package republication or live billing switch.

## Evidence correction and 320px compact review (2026-11-26)

View More distinguishes actual supported validation and regression scope from Ajv and Zod without unsupported superiority claims. The review CLI instructions identify the published npm 0.1.0 package, whose registry integrity and tar inventory were checked. At 320x568, redundant proof badges and summary copy move into the detail section; primary actions, sample, price and legal links remain. The exact browser CI now gates initial vertical overflow at this size. Results pending exact-revision CI. No pricing, payment or npm republish changes.
