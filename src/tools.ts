import {z} from "zod";
import {ApiError, getJson, type RequestOptions} from "./http.js";
import {catalog, invoke, nct, object, optionalObject, rows, select, size, term, text, tool, type Row} from "./lib.js";

const statuses = ["ACTIVE_NOT_RECRUITING", "AVAILABLE", "COMPLETED", "ENROLLING_BY_INVITATION", "NOT_YET_RECRUITING", "NO_LONGER_AVAILABLE", "RECRUITING", "SUSPENDED", "TEMPORARILY_NOT_AVAILABLE", "TERMINATED", "UNKNOWN", "WITHDRAWN", "WITHHELD"] as const;
const search = z.object({
  condition: term.optional().describe("Condition or disease; query.cond"),
  intervention: term.optional().describe("Drug or intervention; query.intr"),
  outcome: term.optional().describe("Outcome text; query.outc"),
  sponsor: term.optional().describe("Sponsor; query.spons"),
  status: z.enum(statuses).optional().describe("Overall study status"),
  location: term.optional().describe("Location text; query.locn"),
  nct_id: nct.optional().describe("NCT identifier filter"),
  pageToken: text.optional().describe("Opaque nextPageToken from a previous matching query"),
  pageSize: size(1000, 50).describe("Maximum studies per page, 1–1000"),
  countTotal: z.boolean().default(false).describe("Ask the API to count matching studies"),
}).strict();
const detail = z.object({nct_id: nct.describe("Study NCT identifier")}).strict();
const complete = detail.extend({fields: z.array(z.enum(["protocolSection", "resultsSection", "documentSection", "derivedSection", "hasResults"])).max(5).optional().describe("Top-level sections; omitted or empty returns the whole study")}).strict();
const comparison = z.object({drug_name: term.describe("Drug or intervention name"), condition: term.optional().describe("Optional condition filter"),
  control_type: z.enum(["placebo", "active_control", "dose_comparison"]).default("placebo").describe("Requested within-study comparator type"),
  limit: size(50, 10).describe("Maximum matched studies inspected, 1–50")}).strict();
const safety = z.object({drug_name: term.describe("Drug or intervention name"), condition: term.optional().describe("Optional condition filter"),
  include_completed_only: z.boolean().default(true).describe("Restrict to completed studies that have results"),
  limit: size(100, 20).describe("Maximum matched studies inspected, 1–100")}).strict();
const alias = z.object({drug: term.describe("Drug or intervention name"), adr: term.optional().describe("Optional full-text query.term; not an adverse-event-only filter"), limit: size(20, 5).describe("Maximum studies, 1–20")}).strict();
const endpoint = "https://clinicaltrials.gov/api/v2/studies";

async function query(params: Record<string, string | number | boolean | undefined>, options: RequestOptions) {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value));
  url.searchParams.set("format", "json");
  const data = object(await getJson(url, options));
  if (!Array.isArray(data.studies)) throw new ApiError("invalid_response", "Missing studies array");
  return {url: url.href, studies: rows(data.studies), total: data.totalCount ?? null, next: data.nextPageToken ?? null};
}
function studyId(study: Row): string {
  const id = optionalObject(optionalObject(study.protocolSection).identificationModule).nctId;
  if (typeof id !== "string" || !/^NCT\d{8}$/.test(id)) throw new ApiError("invalid_response", "Invalid study identifier");
  return id;
}
function linked(study: Row): Row {return {...study, url: `https://clinicaltrials.gov/study/${studyId(study)}`};}
async function byId(id: string, options: RequestOptions) {
  const url = new URL(`${endpoint}/${id}`);
  const study = object(await getJson(url, options));
  if (studyId(study) !== id) throw new ApiError("invalid_response", "Study identifier does not match request");
  return {url: url.href, study};
}
function analysisStudy(study: Row) {
  const protocol = optionalObject(study.protocolSection);
  const module = optionalObject(optionalObject(study.resultsSection).adverseEventsModule);
  const arms = optionalObject(protocol.armsInterventionsModule);
  const groups = rows(module.eventGroups);
  const events = ["seriousEvents", "otherEvents"].flatMap(kind => rows(module[kind]).map(event => ({
    ...event, term: event.term ?? null, type: kind === "seriousEvents" ? "serious" : "other",
    stats: rows(event.stats).map(stat => {
      const affected = typeof stat.numAffected === "number" ? stat.numAffected : null;
      const atRisk = typeof stat.numAtRisk === "number" ? stat.numAtRisk : null;
      return {...stat, groupId: stat.groupId, proportion: affected !== null && atRisk !== null && atRisk > 0 && affected >= 0 && affected <= atRisk ? affected / atRisk : null};
    }),
  })));
  return {nct_id: studyId(study), url: `https://clinicaltrials.gov/study/${studyId(study)}`,
    title: optionalObject(protocol.identificationModule).briefTitle ?? null,
    has_results: study.hasResults ?? Boolean(study.resultsSection),
    has_adverse_events: Object.keys(module).length > 0,
    event_groups: groups, events, adverse_events_module: module,
    arm_groups: rows(arms.armGroups), interventions: rows(arms.interventions)};
}
const normalized = (value: unknown) => typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() : "";
function candidates(study: ReturnType<typeof analysisStudy>, control: string) {
  const groupInfo = study.event_groups.map(group => {
    const title = normalized(group.title);
    const arm = study.arm_groups.find(a => normalized(a.label) === title);
    return {group, arm, text: `${String(group.title ?? "")} ${String(group.description ?? "")}`.toLowerCase()};
  });
  const out: Row[] = [];
  for (let a = 0; a < groupInfo.length; a++) for (let b = a + 1; b < groupInfo.length; b++) {
    const first = groupInfo[a], second = groupInfo[b];
    const placeboA = /\bplacebo\b/.test(first.text), placeboB = /\bplacebo\b/.test(second.text);
    const activeA = first.arm?.type === "ACTIVE_COMPARATOR", activeB = second.arm?.type === "ACTIVE_COMPARATOR";
    const dose = (s: string) => s.match(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|ug|g|ml|units?)\b/g)?.join("|") ?? "";
    const doseA = dose(first.text), doseB = dose(second.text);
    let treatment = first.group, comparator = second.group, reason = "";
    if (control === "placebo" && placeboA !== placeboB) {
      treatment = placeboA ? second.group : first.group; comparator = placeboA ? first.group : second.group;
      reason = "One reported event-group label/description contains placebo";
    } else if (control === "active_control" && activeA !== activeB && (activeA ? second.arm?.type : first.arm?.type) === "EXPERIMENTAL") {
      treatment = activeA ? second.group : first.group; comparator = activeA ? first.group : second.group;
      reason = "Exact event-group/arm label mapping to EXPERIMENTAL and ACTIVE_COMPARATOR";
    } else if (control === "dose_comparison" && first.arm?.type === "EXPERIMENTAL" && second.arm?.type === "EXPERIMENTAL" && doseA && doseB && doseA !== doseB) {
      reason = "Exact label mapping to experimental arms with different dose strings; regimen requires review";
    }
    if (!reason || typeof treatment.id !== "string" || typeof comparator.id !== "string") continue;
    const contrasts = study.events.flatMap(event => {
      const t = event.stats.find(s => s.groupId === treatment.id), c = event.stats.find(s => s.groupId === comparator.id);
      if (!t || !c) return [];
      return [{type: event.type, term: event.term ?? null, treatment: t, comparator: c,
        risk_difference: t.proportion !== null && c.proportion !== null ? t.proportion - c.proportion : null,
        risk_ratio: t.proportion !== null && c.proportion !== null && c.proportion > 0 ? t.proportion / c.proportion : null}];
    });
    out.push({treatment_group: treatment.id, comparator_group: comparator.id, reason, requires_review: true, contrasts});
  }
  return out;
}

export const specs = [
  tool("search_clinical_trials", "Search ClinicalTrials.gov by condition, intervention, outcome, sponsor, status, location, or NCT ID. Returns complete study records with total count when requested and a next-page token.", search, async (p, options) => {
    const data = await query({"query.cond": p.condition, "query.intr": p.intervention, "query.outc": p.outcome,
      "query.spons": p.sponsor, "query.locn": p.location, "query.id": p.nct_id, "filter.overallStatus": p.status,
      pageToken: p.pageToken, pageSize: p.pageSize, countTotal: p.countTotal}, options);
    return {source: "clinical_trials", query_url: data.url, meta: {total_count: data.total, returned_count: data.studies.length, next_page_token: data.next}, studies: data.studies.map(linked)};
  }),
  tool("get_study_details", "Retrieve complete protocol, results, documents, and derived sections for an NCT identifier without truncation.", detail, async (p, options) => {
    const data = await byId(p.nct_id, options);
    return {source: "clinical_trials", query_url: data.url, nct_id: p.nct_id, study: linked(data.study)};
  }),
  tool("compare_adverse_events", "Extract within-study adverse-event group counts and proportions. Suggest placebo, active-control, or dose comparison candidates from reported labels; candidates require review. Never pools study risks.", comparison, async (p, options) => {
    const data = await query({"query.intr": p.drug_name, "query.cond": p.condition, "filter.advanced": "AREA[HasResults]true", pageSize: p.limit, countTotal: true}, options);
    const studies = data.studies.map(analysisStudy);
    return {source: "clinical_trials", query_url: data.url, drug_name: p.drug_name, control_type: p.control_type,
      total_studies_found: data.total, inspected_studies: studies.length, next_page_token: data.next,
      studies_with_adverse_events: studies.filter(s => s.has_adverse_events).length,
      adverse_event_comparisons: studies.filter(s => s.has_adverse_events).map(s => ({...s, comparison_candidates: candidates(s, p.control_type)})),
      interpretation: "Candidate group mapping is label-based and requires verification. Proportions use numAffected/numAtRisk, not event counts. No pooled risk or causal assessment."};
  }),
  tool("analyze_safety_profile", "Summarize reported adverse-event terms and study coverage, retaining group denominators, proportions, and intervention/dose descriptions. Does not invent risk grades or infer dose-response causality.", safety, async (p, options) => {
    const data = await query({"query.intr": p.drug_name, "query.cond": p.condition,
      "filter.overallStatus": p.include_completed_only ? "COMPLETED" : undefined,
      "filter.advanced": p.include_completed_only ? "AREA[HasResults]true" : undefined,
      pageSize: p.limit, countTotal: true}, options);
    const studies = data.studies.map(analysisStudy);
    const terms = new Map<string, {term: unknown; type: string; records: number; study_ids: Set<string>}>();
    for (const study of studies) for (const event of study.events) {
      const key = `${event.type}:${String(event.term)}`;
      const entry = terms.get(key) ?? {term: event.term ?? null, type: event.type, records: 0, study_ids: new Set<string>()};
      entry.records++; entry.study_ids.add(study.nct_id); terms.set(key, entry);
    }
    return {source: "clinical_trials", query_url: data.url, drug_name: p.drug_name, total_studies: data.total,
      inspected_studies: studies.length, studies_with_results: studies.filter(s => s.has_results).length,
      studies_with_adverse_events: studies.filter(s => s.has_adverse_events).length, next_page_token: data.next,
      adverse_events_summary: [...terms.values()].map(t => ({...t, study_ids: [...t.study_ids], study_count: t.study_ids.size})),
      studies, interpretation: "Term records and study counts are descriptive coverage, not patient incidence. Participant proportions remain per study/group. Dose descriptions are retained without inferring a dose-response relationship."};
  }),
  tool("get_complete_study_details", "Get the entire untruncated study or selected top-level sections by NCT ID.", complete, async (p, options) => {
    const data = await byId(p.nct_id, options);
    return {source: "clinical_trials", query_url: data.url, nct_id: p.nct_id,
      complete_study_details: {...(p.fields?.length ? select(data.study, p.fields) : data.study), url: `https://clinicaltrials.gov/study/${p.nct_id}`}};
  }),
  tool("search_trials", "ADR-Synthesizer compatible search by intervention and optional full-text adverse event keywords. Returns evidence records with protocol and results JSON.", alias, async (p, options) => {
    const data = await query({"query.intr": p.drug, "query.term": p.adr, pageSize: p.limit}, options);
    return {source: "clinical_trials", query_url: data.url, records: data.studies.map(study => ({id: studyId(study),
      url: `https://clinicaltrials.gov/study/${studyId(study)}`,
      content: JSON.stringify({protocolSection: study.protocolSection, resultsSection: study.resultsSection ?? null}),
      metadata: {title: optionalObject(study.protocolSection && object(study.protocolSection).identificationModule).briefTitle ?? null, has_results: study.hasResults ?? false}}))};
  }),
];
export const definitions = catalog(specs);
export const execute = (name: string, args: unknown, options: RequestOptions = {}) => invoke(specs, name, args, options);
