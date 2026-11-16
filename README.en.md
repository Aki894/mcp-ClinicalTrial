# ClinicalTrials.gov MCP Server

Search registered clinical studies, retrieve complete protocols and results, compare within-study adverse events, and organize source-linked safety data from an AI assistant.

[简体中文](README.md) · [API](https://clinicaltrials.gov/data-api/api) · [GitHub Issues](https://github.com/Aki894/mcp-ClinicalTrial/issues)

## Features

- **`search_clinical_trials`**: Search ClinicalTrials.gov by condition, intervention, outcome, sponsor, status, location, or NCT ID. Returns complete study records with total count when requested and a next-page token.
- **`get_study_details`**: Retrieve complete protocol, results, documents, and derived sections for an NCT identifier without truncation.
- **`compare_adverse_events`**: Extract within-study adverse-event group counts and proportions. Suggest placebo, active-control, or dose comparison candidates from reported labels; candidates require review. Never pools study risks.
- **`analyze_safety_profile`**: Summarize reported adverse-event terms and study coverage, retaining group denominators, proportions, and intervention/dose descriptions. Does not invent risk grades or infer dose-response causality.
- **`get_complete_study_details`**: Get the entire untruncated study or selected top-level sections by NCT ID.
- **`search_trials`**: Search by intervention and optional full-text adverse event keywords. Returns evidence records with protocol and results JSON.

## Quick start

Requires Git, Node.js 22 or later, npm, and access to `clinicaltrials.gov`.

```bash
git clone https://github.com/Aki894/mcp-ClinicalTrial.git
cd mcp-ClinicalTrial
npm ci
npm run build
```

### Configure your MCP client

Add this entry to a client supporting the `mcpServers` format, replacing the entry point with its **absolute path**:

```json
{
  "mcpServers": {
    "clinicaltrials": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-ClinicalTrial/dist/index.js"
      ]
    }
  }
}
```

On Windows, use `D:/mcp/mcp-ClinicalTrial/dist/index.js` to avoid JSON backslash escaping. If the client cannot find `node`, use the absolute path of the Node.js executable. Reload the MCP connection and inspect its tool list. For other client formats, enter the same command and arguments in their MCP settings.

The server uses **stdio** and is launched by the MCP client. No port or HTTP address is needed. Waiting for standard input when launched directly is expected.

No API key or required environment variables.

## Available tools

The server exposes **6 tools**. Validation rejects undeclared fields. Strings are trimmed and reject control characters. Pass numbers as JSON numbers and booleans as JSON booleans. Defaults, required fields, and bounds below match the server's published schemas.

### `search_clinical_trials`

Search ClinicalTrials.gov by condition, intervention, outcome, sponsor, status, location, or NCT ID. Returns complete study records with total count when requested and a next-page token.

| Parameter | Type | Required | Default | Description and bounds |
| --- | --- | --- | --- | --- |
| `condition` | string | No | `—` | Condition or disease; query.cond length: 1–200 characters |
| `intervention` | string | No | `—` | Drug or intervention; query.intr length: 1–200 characters |
| `outcome` | string | No | `—` | Outcome text; query.outc length: 1–200 characters |
| `sponsor` | string | No | `—` | Sponsor; query.spons length: 1–200 characters |
| `status` | string | No | `—` | Overall study status; allowed values are listed below. |
| `location` | string | No | `—` | Location text; query.locn length: 1–200 characters |
| `nct_id` | string | No | `—` | Study identifier filter: NCT followed by eight digits |
| `pageToken` | string | No | `—` | Opaque nextPageToken from a previous matching query length: 1–4000 characters |
| `pageSize` | integer | No | `50` | Maximum studies per page, 1–1000 ≥1; ≤1000 |
| `countTotal` | boolean | No | `false` | Ask the API to count matching studies |

Allowed `status` values:

- `ACTIVE_NOT_RECRUITING`
- `AVAILABLE`
- `COMPLETED`
- `ENROLLING_BY_INVITATION`
- `NOT_YET_RECRUITING`
- `NO_LONGER_AVAILABLE`
- `RECRUITING`
- `SUSPENDED`
- `TEMPORARILY_NOT_AVAILABLE`
- `TERMINATED`
- `UNKNOWN`
- `WITHDRAWN`
- `WITHHELD`


Example invocation (parameters for MCP `tools/call`):

```json
{
  "name": "search_clinical_trials",
  "arguments": {
    "intervention": "pembrolizumab",
    "status": "COMPLETED",
    "pageSize": 3,
    "countTotal": true
  }
}
```

### `get_study_details`

Retrieve complete protocol, results, documents, and derived sections for an NCT identifier without truncation.

| Parameter | Type | Required | Default | Description and bounds |
| --- | --- | --- | --- | --- |
| `nct_id` | string | Yes | `—` | Study identifier: NCT followed by eight digits |

Example invocation (parameters for MCP `tools/call`):

```json
{
  "name": "get_study_details",
  "arguments": {
    "nct_id": "NCT01866319"
  }
}
```

### `compare_adverse_events`

Extract within-study adverse-event group counts and proportions. Suggest placebo, active-control, or dose comparison candidates from reported labels; candidates require review. Never pools study risks.

| Parameter | Type | Required | Default | Description and bounds |
| --- | --- | --- | --- | --- |
| `drug_name` | string | Yes | `—` | Drug or intervention name length: 1–200 characters |
| `condition` | string | No | `—` | Optional condition filter length: 1–200 characters |
| `control_type` | string | No | `"placebo"` | Requested within-study comparator type placebo / active_control / dose_comparison |
| `limit` | integer | No | `10` | Maximum matched studies inspected, 1–50 ≥1; ≤50 |

Example invocation (parameters for MCP `tools/call`):

```json
{
  "name": "compare_adverse_events",
  "arguments": {
    "drug_name": "pembrolizumab",
    "control_type": "active_control",
    "limit": 5
  }
}
```

### `analyze_safety_profile`

Summarize reported adverse-event terms and study coverage, retaining group denominators, proportions, and intervention/dose descriptions. Does not invent risk grades or infer dose-response causality.

| Parameter | Type | Required | Default | Description and bounds |
| --- | --- | --- | --- | --- |
| `drug_name` | string | Yes | `—` | Drug or intervention name length: 1–200 characters |
| `condition` | string | No | `—` | Optional condition filter length: 1–200 characters |
| `include_completed_only` | boolean | No | `true` | Restrict to completed studies that have results |
| `limit` | integer | No | `20` | Maximum matched studies inspected, 1–100 ≥1; ≤100 |

Example invocation (parameters for MCP `tools/call`):

```json
{
  "name": "analyze_safety_profile",
  "arguments": {
    "drug_name": "pembrolizumab",
    "include_completed_only": true,
    "limit": 5
  }
}
```

### `get_complete_study_details`

Get the entire untruncated study or selected top-level sections by NCT ID.

| Parameter | Type | Required | Default | Description and bounds |
| --- | --- | --- | --- | --- |
| `nct_id` | string | Yes | `—` | Study identifier: NCT followed by eight digits |
| `fields` | string[] | No | `—` | Sections to return; omitted or empty returns all. Allowed values are listed below. |

Allowed `fields` values:

- `omitted or empty returns the whole study maxItems=5; protocolSection`
- `resultsSection`
- `documentSection`
- `derivedSection`
- `hasResults`


Example invocation (parameters for MCP `tools/call`):

```json
{
  "name": "get_complete_study_details",
  "arguments": {
    "nct_id": "NCT01866319",
    "fields": [
      "protocolSection",
      "resultsSection"
    ]
  }
}
```

### `search_trials`

Search by intervention and optional full-text adverse event keywords. Returns evidence records with protocol and results JSON.

| Parameter | Type | Required | Default | Description and bounds |
| --- | --- | --- | --- | --- |
| `drug` | string | Yes | `—` | Drug or intervention name length: 1–200 characters |
| `adr` | string | No | `—` | Optional full-text query.term; not an adverse-event-only filter length: 1–200 characters |
| `limit` | integer | No | `5` | Maximum studies, 1–20 ≥1; ≤20 |

Example invocation (parameters for MCP `tools/call`):

```json
{
  "name": "search_trials",
  "arguments": {
    "drug": "metformin",
    "adr": "hypoglycemia",
    "limit": 3
  }
}
```

## Returned data and query behavior

The MCP response contains one `content` item with `type: "text"`; its `text` is a JSON string. Every successful result includes `source` and `query_url` identifying its source and primary request. Composite tools preserve additional request URLs in the result.

| Tool | Data fields and behavior |
| --- | --- |
| `search_clinical_trials` | Complete upstream `studies` with `url`; `meta` includes `total_count`, `returned_count`, and `next_page_token`. Unrequested totals and absent next-page tokens are `null`. |
| `get_study_details` | `nct_id` and `study`, preserving upstream fields and adding a source `url`. |
| `get_complete_study_details` | `nct_id` and `complete_study_details`. Optional `fields` selects top-level sections; omitted or empty returns the whole study, with a source `url`. |
| `compare_adverse_events` | `total_studies_found`, `inspected_studies`, `studies_with_adverse_events`, `next_page_token`, and `adverse_event_comparisons`. Each study retains `event_groups`, `events`, `arm_groups`, `interventions`, raw `adverse_events_module`, and `comparison_candidates`. |
| `analyze_safety_profile` | `total_studies`, `inspected_studies`, `studies_with_results`, `studies_with_adverse_events`, `next_page_token`, `adverse_events_summary`, and `studies`. Term summaries include type, entry count (`records`), study IDs, and `study_count`; per-study statistics remain available. |
| `search_trials` | `records[].id/url/content/metadata`; `content` is a JSON string containing `protocolSection` and `resultsSection` (or `null` when absent). Parse it separately. Metadata includes title and `has_results`. |

The source marker is `clinical_trials`. Unmatched searches return empty arrays; a missing detail identifier produces an upstream 404 error. Paginate using the previous token and unchanged search criteria. `search_trials.adr` maps to the full-text `query.term`, not an adverse-event-only filter.

For comparison and safety tools, `limit` bounds the number of matched studies inspected. Outputs distinguish total matches from inspected studies and retain the next-page token. Comparisons search studies with published results. Safety profiles with `include_completed_only=true` require both completed status and published results. Studies without adverse-event data still count toward inspected coverage.

### Comparison rules and statistical interpretation

- Placebo candidates: exactly one event-group title/description contains placebo.
- Active-control candidates: normalized event-group titles exactly match protocol arm labels typed EXPERIMENTAL and ACTIVE_COMPARATOR.
- Dose candidates: two matched EXPERIMENTAL arms have different dose strings in their titles/descriptions. Verify medicines, combinations, and time windows.
- Candidates include a `reason` and `requires_review: true`. Unresolved mappings return no candidates while retaining source groups and events.
- `events[].stats[].proportion` is `numAffected / numAtRisk`, or `null` for missing/zero denominators or invalid counts. Candidate `contrasts` preserve both groups and include `risk_difference` and `risk_ratio`; the ratio is `null` for a zero comparator proportion.
- Risks are not pooled across studies or populations. Term-entry counts and study coverage are reported separately. Dose descriptions remain in interventions and group descriptions without turning textual associations into dose-response causal conclusions.

## Usage examples

After connecting, ask your assistant:

> Find completed pembrolizumab studies and cite their NCT IDs. Retrieve one complete result record and organize serious adverse events by group, with affected participants, denominators, and proportions.

Use the returned data for retrieval and research. Clinical interpretation requires product, study-design, and patient context; this project does not provide individual medical advice.

## Data source

Each call uses [ClinicalTrials.gov API v2](https://clinicaltrials.gov/data-api/api), `/api/v2/studies` or `/api/v2/studies/{nct_id}`. Record completeness depends on registration and result publication. No local study database or result cache is maintained. Follow the [ClinicalTrials.gov terms](https://clinicaltrials.gov/about-site/terms-conditions).

## Errors and troubleshooting

Tool failures set `isError: true`, with text JSON in this format:

```json
{"error":{"code":"invalid_arguments","message":"…","retryable":false}}
```

Each upstream request has a 30-second timeout and no automatic retries. Composite tools may make multiple requests. `retryable` indicates whether retrying later is appropriate.

| Symptom / code | Action |
| --- | --- |
| Missing tools or closed connection | Check Node.js ≥22, build the project, verify the absolute entry point, and reload the client. |
| `invalid_arguments` | Check required fields, types, bounds, enums, and extra parameters. |
| `unknown_tool` | Reload the tool list and use a name listed above. |
| `network / timeout` | Check access to clinicaltrials.gov and retry later. |
| `http_429 / http_5xx` | Reduce request frequency and retry after recovery. |
| `http_400 / http_401 / http_403` | Check query syntax, credentials, and upstream access requirements. |
| `http_404` | Check the identifier; unmatched searches follow each tool’s empty-result behavior. |
| `invalid_json / invalid_response` | Unexpected upstream data; report persistent failures with the code. |
| `cancelled` | The client cancelled the request; invoke again if needed. |
| `internal / configuration` | Check the installation and local modifications; report runtime details and the error. |

## Run from source

```bash
npm run build
npm start
npm run dev
```

These commands build the project, run the build, and run TypeScript source directly.

## Support and license

Report problems through [GitHub Issues](https://github.com/Aki894/mcp-ClinicalTrial/issues), including the Node.js version, MCP client, tool arguments, and error code. Remove credentials and personal information.

Code is licensed under [GPL-3.0](LICENSE). Source data terms apply separately.
