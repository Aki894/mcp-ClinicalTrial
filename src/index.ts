#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const ClinicalTrialSearchParamsSchema = z.object({
  condition: z.string().optional(),
  intervention: z.string().optional(),
  outcome: z.string().optional(),
  sponsor: z.string().optional(),
  status: z.string().optional(),
  location: z.string().optional(),
  nct_id: z.string().optional(),
  // pagination
  pageToken: z.string().optional(),
  pageSize: z.coerce.number().int().min(1).max(1000).optional().default(50),
  countTotal: z.boolean().optional().default(false),
});

type ClinicalTrialSearchParams = z.infer<typeof ClinicalTrialSearchParamsSchema>;

const AdverseEventComparisonParamsSchema = z.object({
  drug_name: z.string(),
  control_type: z.enum(["placebo", "active_control", "dose_comparison"]).optional().default("placebo"),
  condition: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

const StudyDetailParamsSchema = z.object({
  nct_id: z.string(),
  fields: z.array(z.string()).optional(),
});

type AdverseEventComparisonParams = z.infer<typeof AdverseEventComparisonParamsSchema>;

interface ClinicalTrialsResponse {
  studies: any[];
  totalCount?: number;
  nextPageToken?: string;
}

interface StudyDetails {
  protocolSection: any;
  resultsSection?: any;
  documentSection?: any;
  derivedSection?: any;
}

class ClinicalTrialsServer {
  private server: Server;
  private baseUrl = "https://clinicaltrials.gov/api/v2/studies";

  constructor() {
    this.server = new Server(
      {
        name: "clinicaltrials-adverse-events",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "search_clinical_trials",
          description: "Search clinical trials using ClinicalTrials.gov API v2. Returns study information including protocols, interventions, and outcomes.",
          inputSchema: {
            type: "object",
            properties: {
              condition: {
                type: "string",
                description: "Medical condition or disease. Example: 'lung cancer', 'diabetes'"
              },
              intervention: {
                type: "string",
                description: "Drug or intervention name. Example: 'Vemurafenib', 'chemotherapy'"
              },
              outcome: {
                type: "string",
                description: "Outcome measure. Example: 'overall survival', 'adverse events'"
              },
              sponsor: {
                type: "string",
                description: "Study sponsor. Example: 'National Cancer Institute'"
              },
              status: {
                type: "string",
                description: "Study status. Example: 'RECRUITING', 'COMPLETED'"
              },
              location: {
                type: "string",
                description: "Study location. Example: 'New York', 'United States'"
              },
              nct_id: {
                type: "string",
                description: "Specific NCT ID. Example: 'NCT04267848'"
              },
              pageSize: {
                type: "number",
                description: "Maximum number of records to return (1-1000)",
                default: 50,
                minimum: 1,
                maximum: 1000
              },
              countTotal: {
                type: "boolean",
                description: "Whether to count total number of studies",
                default: false
              }
            }
          }
        },
        {
          name: "get_study_details",
          description: "Get detailed information about a specific clinical trial by NCT ID",
          inputSchema: {
            type: "object",
            properties: {
              nct_id: {
                type: "string",
                description: "NCT ID of the study. Example: 'NCT04267848'"
              }
            },
            required: ["nct_id"]
          }
        },
        {
          name: "compare_adverse_events",
          description: "Compare adverse events between treatment and control groups for a specific drug across clinical trials. Provides baseline reference and evidence for drug safety analysis.",
          inputSchema: {
            type: "object",
            properties: {
              drug_name: {
                type: "string",
                description: "Name of the drug to analyze for adverse events"
              },
              control_type: {
                type: "string",
                enum: ["placebo", "active_control", "dose_comparison"],
                description: "Type of control comparison: placebo (vs placebo), active_control (vs other drugs), dose_comparison (different doses)",
                default: "placebo"
              },
              condition: {
                type: "string",
                description: "Medical condition to focus the search. Example: 'cancer', 'diabetes'"
              },
              limit: {
                type: "number",
                description: "Maximum number of studies to analyze",
                default: 10,
                minimum: 1,
                maximum: 50
              }
            },
            required: ["drug_name"]
          }
        },
        {
          name: "analyze_safety_profile",
          description: "Analyze safety profile of a drug by extracting and comparing adverse events data across multiple clinical trials. Provides risk assessment and dose-response relationships.",
          inputSchema: {
            type: "object",
            properties: {
              drug_name: {
                type: "string",
                description: "Name of the drug to analyze"
              },
              condition: {
                type: "string",
                description: "Medical condition context"
              },
              include_completed_only: {
                type: "boolean",
                description: "Only include completed studies with results",
                default: true
              },
              limit: {
                type: "number",
                description: "Maximum number of studies to analyze",
                default: 20,
                minimum: 1,
                maximum: 100
              }
            },
            required: ["drug_name"]
          }
        },
        {
          name: "get_complete_study_details",
          description: "Get complete, untruncated information for a specific clinical trial using its NCT ID. Use this when you need full study details.",
          inputSchema: {
            type: "object",
            properties: {
              nct_id: {
                type: "string",
                description: "NCT ID of the study (obtained from search results)"
              },
              fields: {
                type: "array",
                items: {
                  type: "string"
                },
                description: "Optional: Specific sections to return. If not provided, returns key sections only. Available: protocolSection, resultsSection, documentSection, derivedSection",
                default: []
              }
            },
            required: ["nct_id"]
          }
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: rawArgs } = request.params;

      // Handle cases where arguments are double-encoded as a JSON string
      let args: any;
      if (typeof rawArgs === 'string') {
        try {
          args = JSON.parse(rawArgs);
        } catch (e) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Failed to parse arguments string: ' + (e as Error).message
          );
        }
      } else {
        args = rawArgs;
      }

      if (!args) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Missing arguments"
        );
      }

      try {
        switch (name) {
          case "search_clinical_trials":
            const searchParams = ClinicalTrialSearchParamsSchema.parse(args);
            return await this.searchClinicalTrials(searchParams);
          
          case "get_study_details":
            if (!args.nct_id) {
              throw new McpError(ErrorCode.InvalidParams, "NCT ID is required");
            }
            return await this.getStudyDetails(args.nct_id);
          
          case "compare_adverse_events":
            const adverseParams = AdverseEventComparisonParamsSchema.parse(args);
            return await this.compareAdverseEvents(adverseParams);
          
          case "analyze_safety_profile":
            const safetyParams = {
              drug_name: args.drug_name,
              condition: args.condition,
              include_completed_only: args.include_completed_only ?? true,
              limit: args.limit ?? 20
            };
            return await this.analyzeSafetyProfile(safetyParams);
          
          case "get_complete_study_details":
            const detailParams = StudyDetailParamsSchema.parse(args);
            return await this.getCompleteStudyDetails(detailParams.nct_id, detailParams.fields);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error}`
        );
      }
    });
  }

  // Helper method to truncate long text
  private truncateText(text: string | string[], maxLength: number = 500): string {
    if (!text) return "";
    
    const textStr = Array.isArray(text) ? text.join(" ") : text;
    if (textStr.length <= maxLength) return textStr;
    
    return textStr.substring(0, maxLength) + "... [truncated]";
  }

  // Extract only key information from clinical trial data
  private extractKeyStudyInfo(study: any) {
    const protocol = study.protocolSection;
    const identification = protocol?.identificationModule;
    const description = protocol?.descriptionModule;
    const eligibility = protocol?.eligibilityModule;
    const design = protocol?.designModule;
    const status = protocol?.statusModule;
    
    return {
      // Basic study information
      nct_id: identification?.nctId || "Unknown",
      title: this.truncateText(identification?.briefTitle, 200),
      status: status?.overallStatus || "Unknown",
      phase: design?.phases?.[0] || "Unknown",
      
      // Key study details (truncated)
      brief_summary: this.truncateText(description?.briefSummary, 300),
      detailed_description: this.truncateText(description?.detailedDescription, 400),
      primary_purpose: design?.primaryPurpose || "Unknown",
      
      // Eligibility (truncated)
      eligibility_criteria: this.truncateText(eligibility?.eligibilityCriteria, 300),
      minimum_age: eligibility?.minimumAge || "Unknown",
      maximum_age: eligibility?.maximumAge || "Unknown",
      
      // Key dates
      start_date: status?.startDateStruct?.date || "Unknown",
      completion_date: status?.primaryCompletionDateStruct?.date || "Unknown",
      
      // Sponsor info
      lead_sponsor: protocol?.sponsorCollaboratorsModule?.leadSponsor?.name || "Unknown",
      
      // Metadata for getting full details
      has_results: !!study.resultsSection,
      study_type: design?.studyType || "Unknown"
    };
  }

  private async makeRequest(params: ClinicalTrialSearchParams): Promise<ClinicalTrialsResponse> {
    const url = new URL(this.baseUrl);
    
    // Build query parameters for ClinicalTrials.gov API v2
    if (params.condition) {
      url.searchParams.set("query.cond", params.condition);
    }
    if (params.intervention) {
      url.searchParams.set("query.intr", params.intervention);
    }
    if (params.outcome) {
      url.searchParams.set("query.outc", params.outcome);
    }
    if (params.sponsor) {
      url.searchParams.set("query.spons", params.sponsor);
    }
    if (params.location) {
      url.searchParams.set("query.locn", params.location);
    }
    if (params.nct_id) {
      url.searchParams.set("query.id", params.nct_id);
    }
    if (params.status) {
      url.searchParams.set("filter.overallStatus", params.status);
    }
    if (params.pageToken) {
      url.searchParams.set("pageToken", params.pageToken);
    }
    if (params.pageSize) {
      url.searchParams.set("pageSize", params.pageSize.toString());
    }
    if (params.countTotal) {
      url.searchParams.set("countTotal", params.countTotal.toString());
    }

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ClinicalTrials.gov API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  private async getStudyByNCT(nctId: string): Promise<StudyDetails> {
    const url = `${this.baseUrl}/${nctId}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ClinicalTrials.gov API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  private async searchClinicalTrials(params: ClinicalTrialSearchParams) {
    const data = await this.makeRequest(params);
    
    // Extract and summarize key information only
    const summarizedStudies = data.studies?.map(study => this.extractKeyStudyInfo(study)) || [];
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            meta: {
              total_count: data.totalCount || 0,
              returned_count: summarizedStudies.length,
              next_page_token: data.nextPageToken
            },
            studies: summarizedStudies,
            note: "Study information has been summarized. Use get_study_details with nct_id for complete information."
          }, null, 2)
        }
      ]
    };
  }

  private async getStudyDetails(nctId: string) {
    const data = await this.getStudyByNCT(nctId);
    
    // Return summarized version by default
    const summarizedData = this.extractKeyStudyInfo(data);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            nct_id: nctId,
            study_summary: summarizedData,
            note: "This is a summarized view. Use get_complete_study_details for full information."
          }, null, 2)
        }
      ]
    };
  }

  private async getCompleteStudyDetails(nctId: string, fields?: string[]) {
    const data = await this.getStudyByNCT(nctId);
    
    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "No study found with the specified NCT ID",
              nct_id: nctId
            }, null, 2)
          }
        ]
      };
    }

    let responseData: any = {};

    if (fields && fields.length > 0) {
      // Return only requested sections
      for (const field of fields) {
        if ((data as any)[field]) {
          responseData[field] = (data as any)[field];
        }
      }
    } else {
      // Return key sections with full content (no truncation)
      responseData = {
        nct_id: nctId,
        protocol_section: data.protocolSection || {},
        results_section: data.resultsSection || null,
        has_results: !!data.resultsSection,
        document_section: data.documentSection || null,
        derived_section: data.derivedSection || null
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            nct_id: nctId,
            complete_study_details: responseData,
            note: "This is the complete, untruncated information for this clinical trial."
          }, null, 2)
        }
      ]
    };
  }

  private async compareAdverseEvents(params: AdverseEventComparisonParams) {
    // Search for clinical trials with the specified drug
    const searchParams: ClinicalTrialSearchParams = {
      intervention: params.drug_name,
      condition: params.condition,
      pageSize: params.limit,
      countTotal: true
    };

    // Only include completed studies with results for adverse event comparison
    if (params.control_type === "placebo") {
      searchParams.status = "COMPLETED";
    }

    const data = await this.makeRequest(searchParams);
    
    // Extract studies with results sections for adverse event analysis
    const studiesWithResults = [];
    const adverseEventComparisons = [];

    for (const study of data.studies || []) {
      if (study.resultsSection && study.resultsSection.adverseEventsModule) {
        studiesWithResults.push(study);
        
        const adverseEvents = this.extractAdverseEvents(study, params.control_type);
        if (adverseEvents) {
          adverseEventComparisons.push(adverseEvents);
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            drug_name: params.drug_name,
            control_type: params.control_type,
            condition: params.condition,
            total_studies_found: data.totalCount || 0,
            studies_with_results: studiesWithResults.length,
            adverse_event_comparisons: adverseEventComparisons,
            summary: this.generateAdverseEventSummary(adverseEventComparisons, params.control_type)
          }, null, 2)
        }
      ]
    };
  }

  private async analyzeSafetyProfile(params: {
    drug_name: string;
    condition?: string;
    include_completed_only: boolean;
    limit: number;
  }) {
    // Search for clinical trials with the specified drug
    const searchParams: ClinicalTrialSearchParams = {
      intervention: params.drug_name,
      condition: params.condition,
      pageSize: params.limit,
      countTotal: true
    };

    if (params.include_completed_only) {
      searchParams.status = "COMPLETED";
    }

    const data = await this.makeRequest(searchParams);
    
    // Analyze safety data across studies
    const safetyAnalysis = {
      drug_name: params.drug_name,
      condition: params.condition,
      total_studies: data.totalCount || 0,
      analyzed_studies: 0,
      adverse_events_summary: {} as any,
      dose_response_analysis: [] as any[],
      risk_assessment: {} as any
    };

    const allAdverseEvents: any[] = [];
    const doseGroups: any[] = [];

    for (const study of data.studies || []) {
      if (study.resultsSection) {
        safetyAnalysis.analyzed_studies++;
        
        // Extract adverse events
        if (study.resultsSection.adverseEventsModule) {
          const studyAEs = this.extractStudyAdverseEvents(study);
          allAdverseEvents.push(...studyAEs);
        }
        
        // Extract dose information
        if (study.protocolSection?.armsInterventionsModule) {
          const doseInfo = this.extractDoseInformation(study, params.drug_name);
          if (doseInfo) {
            doseGroups.push(doseInfo);
          }
        }
      }
    }

    // Aggregate and analyze adverse events
    safetyAnalysis.adverse_events_summary = this.aggregateAdverseEvents(allAdverseEvents);
    safetyAnalysis.dose_response_analysis = this.analyzeDoseResponse(doseGroups, allAdverseEvents);
    safetyAnalysis.risk_assessment = this.assessRisk(safetyAnalysis.adverse_events_summary);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(safetyAnalysis, null, 2)
        }
      ]
    };
  }

  // Helper methods for adverse event analysis
  private extractAdverseEvents(study: any, controlType: string) {
    const adverseEventsModule = study.resultsSection?.adverseEventsModule;
    if (!adverseEventsModule) return null;

    const nctId = study.protocolSection?.identificationModule?.nctId;
    const title = study.protocolSection?.identificationModule?.briefTitle;
    
    return {
      nct_id: nctId,
      title: title,
      control_type: controlType,
      event_groups: adverseEventsModule.eventGroups || [],
      serious_events: adverseEventsModule.seriousEvents || [],
      other_events: adverseEventsModule.otherEvents || []
    };
  }

  private extractStudyAdverseEvents(study: any) {
    const adverseEventsModule = study.resultsSection?.adverseEventsModule;
    if (!adverseEventsModule) return [];

    const events = [];
    const nctId = study.protocolSection?.identificationModule?.nctId;
    
    // Extract serious adverse events
    if (adverseEventsModule.seriousEvents) {
      for (const event of adverseEventsModule.seriousEvents) {
        events.push({
          nct_id: nctId,
          type: 'serious',
          term: event.term,
          assessment: event.assessment,
          stats: event.stats || []
        });
      }
    }
    
    // Extract other adverse events
    if (adverseEventsModule.otherEvents) {
      for (const event of adverseEventsModule.otherEvents) {
        events.push({
          nct_id: nctId,
          type: 'other',
          term: event.term,
          assessment: event.assessment,
          stats: event.stats || []
        });
      }
    }
    
    return events;
  }

  private extractDoseInformation(study: any, drugName: string) {
    const interventions = study.protocolSection?.armsInterventionsModule?.interventions || [];
    
    for (const intervention of interventions) {
      if (intervention.name?.toLowerCase().includes(drugName.toLowerCase())) {
        return {
          nct_id: study.protocolSection?.identificationModule?.nctId,
          intervention_name: intervention.name,
          description: intervention.description,
          arm_group_labels: intervention.armGroupLabels || []
        };
      }
    }
    
    return null;
  }

  private aggregateAdverseEvents(events: any[]) {
    const aggregated: any = {
      total_events: events.length,
      serious_events: events.filter(e => e.type === 'serious').length,
      other_events: events.filter(e => e.type === 'other').length,
      by_term: {} as any
    };
    
    // Group by term
    for (const event of events) {
      if (!aggregated.by_term[event.term]) {
        aggregated.by_term[event.term] = {
          count: 0,
          serious_count: 0,
          studies: new Set()
        };
      }
      
      aggregated.by_term[event.term].count++;
      if (event.type === 'serious') {
        aggregated.by_term[event.term].serious_count++;
      }
      aggregated.by_term[event.term].studies.add(event.nct_id);
    }
    
    // Convert sets to arrays for JSON serialization
    for (const term in aggregated.by_term) {
      aggregated.by_term[term].studies = Array.from(aggregated.by_term[term].studies);
      aggregated.by_term[term].study_count = aggregated.by_term[term].studies.length;
    }
    
    return aggregated;
  }

  private analyzeDoseResponse(doseGroups: any[], adverseEvents: any[]) {
    // This is a simplified dose-response analysis
    // In a real implementation, you would need more sophisticated statistical analysis
    return doseGroups.map(dose => ({
      ...dose,
      associated_events: adverseEvents.filter(e => e.nct_id === dose.nct_id).length
    }));
  }

  private assessRisk(adverseEventsSummary: any) {
    const totalEvents = adverseEventsSummary.total_events;
    const seriousEvents = adverseEventsSummary.serious_events;
    
    return {
      overall_risk_level: seriousEvents > totalEvents * 0.1 ? 'HIGH' : 
                         seriousEvents > totalEvents * 0.05 ? 'MODERATE' : 'LOW',
      serious_event_rate: totalEvents > 0 ? (seriousEvents / totalEvents * 100).toFixed(2) + '%' : '0%',
      most_common_events: Object.entries(adverseEventsSummary.by_term)
        .sort(([,a]: any, [,b]: any) => b.count - a.count)
        .slice(0, 10)
        .map(([term, data]: any) => ({ term, count: data.count, study_count: data.study_count }))
    };
  }

  private generateAdverseEventSummary(comparisons: any[], controlType: string) {
    if (comparisons.length === 0) {
      return {
        message: "No studies with adverse event data found for comparison",
        recommendation: "Consider searching with broader criteria or different control type"
      };
    }
    
    return {
      studies_analyzed: comparisons.length,
      control_type: controlType,
      key_findings: "Adverse event comparison data extracted from clinical trials",
      recommendation: "Review individual study comparisons for detailed safety assessment"
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("ClinicalTrials Adverse Events MCP server running on stdio");
  }
}

const server = new ClinicalTrialsServer();
server.run().catch(console.error);
