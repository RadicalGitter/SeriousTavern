# Local-model foundation — 14 September 2026

Status: implemented and checked offline; not deployed or model-qualified.

The owner authorized this separate development clone at
`Z:/Programmering/Projects/Roleplay/SeriousTavern`, from
`https://github.com/RadicalGitter/SeriousTavern.git`, baseline
`519401f7a7e4b566c11ab31dd256bde0bed75678`, on branch
`development/local-model-foundation`. One independent instance per world is
settled. Existing worlds, launcher, weights and running services were untouched.

## Changes and evidence

The native preset in `default/content/presets/openai/` supplies a provisional
llama.cpp connection and sampling parameters through the actual custom request
body. It requests `enable_thinking: true`, `preserve_thinking: false`, temperature
1, top-p .95, top-k 20, min-p 0, repetition penalty 1, and an 8,192-token response
allowance. Native budget arithmetic leaves 119,808 tokens for prompt content.
This is not an exact tokenizer measurement or evidence that these are optimal
creative settings. Card prompt preference and native prompt markers remain.

Roleplay settings v3 merge `power_user.reasoning.add_to_prompts: false`. Existing
reasoning display/storage preferences are retained; there is no chat-history
deletion or global filtering of intentional reasoning continuation. Existing
bootstrap backup/drift behavior remains in force.

The companion WorldCreator source now builds portable SemanticPlay modules,
JSON cards/lorebooks and supplied backgrounds without the old host configuration
or PNG parser/avatar. The fresh generated bundle is in ignored
`cache/semantic-play`, not a user extension directory. Its
[receipt](evidence/local-model-foundation/build-receipt.json) records output
hashes. Build inputs and regressions belong to
[WorldCreator's integration report](../../SillyTavern/WorldCreator/progress/serious-integration.md).

All logs below are in [the evidence directory](evidence/local-model-foundation/).

| Check | Result | Evidence |
| --- | --- | --- |
| Original bootstrap contracts | 4/4 pass | `bootstrap-before.tap` |
| Original converter tests | 144/144 pass | `converters-before.log` |
| Reasoning regression before fix | 4 pass, 1 expected failure | `bootstrap-fail-before.tap` |
| Missing new preset before implementation | 4 expected failures, feature absence | `request-fail-before.log` |
| Bootstrap and native preset/reasoning/budget contracts | 8/8 pass | `bootstrap-after.tap` |
| Actual request route plus converters | 150/150 pass, none skipped | `request-and-converters-after.log` |
| Targeted request-test lint | 0 errors; 4 warnings for optional skipped fixture | `lint-fixed.log` |

`tests/serious-request.test.js` runs the real frontend preset mapping and
generation-parameter function, then the real backend `/generate` handler,
custom merge/exclusion helpers and converters. Fetch is intercepted; there is
no socket, model, tokenizer or external request. Input messages are fixtures,
not a browser-assembled chat. Captures in `request-capture.json` show final
serialized requests, including streaming, quiet JSON-schema harvest, preserved
role order, custom overrides and exclusions. Generated SemanticPlay modules
select current Oran lore, keep locked lore absent, and reject a 25th accepted
discovery without changing revision before their context enters that route.

Reproduce after local dependency installation:

```powershell
npm run test:serious
$env:SERIOUS_SEMANTIC_BUNDLE = (Resolve-Path cache/semantic-play).Path
$env:SERIOUS_CAPTURE_REPORT = Join-Path (Get-Location) 'serious-tavern/evidence/local-model-foundation/request-capture.json'
npm run test:serious:requests
```

## Remaining work

- Exercise full browser assembly and extension event order: native World Info,
  SemanticPlay control/context, Summaryception, history trimming and final
  tokenizer budget. The selected transport suite does not qualify that stack.
- Confirm backend handling of per-request reasoning flags during a separately
  authorized model run. The external launcher still requests preservation;
  it was not modified. Saved reasoning is not reinserted by the prepared settings.
- Compare creative quality with held-out scenes before calling this optimized.
  Response allowance and samplers are working assumptions.
- Resolve Input History's same-origin localStorage isolation for separate worlds.
  Extension pins are unchanged; no extensions were installed or evaluated live.
- SemanticPlay's six remaining historical failures (R02, R04, R06–R09), broader
  R05 freshness work, legacy host/PNG packaging and second-pack generalization
  remain backlog. No competing authoring or memory framework was added.

No application server was started, no live configuration changed, and nothing
was pushed or published. Full application E2E and live-model suites were not run.
