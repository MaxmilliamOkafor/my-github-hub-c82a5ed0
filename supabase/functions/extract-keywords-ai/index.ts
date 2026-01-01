import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * AI-Powered Keyword Extraction Edge Function
 * Inspired by Resume-Matcher's structured extraction approach
 * Uses LLM tool calling to extract required_skills, preferred_skills, and key_responsibilities
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedKeywords {
  required_skills: string[];
  preferred_skills: string[];
  key_responsibilities: string[];
  job_title: string;
  experience_level: string;
  industry_keywords: string[];
  certifications: string[];
  soft_skills: string[];
  tools_technologies: string[];
  ats_priority_keywords: string[]; // Combined prioritized list for ATS matching
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, jobTitle, company } = await req.json();

    if (!description || description.length < 50) {
      return new Response(JSON.stringify({ 
        error: "Job description too short. Please provide at least 50 characters." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use Lovable AI Gateway for extraction
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ 
        error: "LOVABLE_API_KEY not configured" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[AI Keyword Extraction] Processing job: ${jobTitle} at ${company}`);
    console.log(`[AI Keyword Extraction] Description length: ${description.length} chars`);

    const systemPrompt = `You are an expert ATS (Applicant Tracking System) analyst specializing in resume optimization. Your task is to extract and categorize keywords from job descriptions that are critical for passing ATS screening.

EXTRACTION RULES:
1. Extract EXACT phrases as they appear in the job description - ATS systems match exact terms
2. Prioritize technical skills, tools, certifications, and industry-specific terms
3. Distinguish between REQUIRED skills (must-have) and PREFERRED skills (nice-to-have)
4. Extract key responsibilities that should be reflected in resume bullet points
5. Identify the experience level (entry, mid, senior, lead, principal, etc.)
6. Extract certification names exactly as written (AWS Certified, PMP, etc.)
7. Include both acronyms AND full names when both appear (e.g., "ML" and "Machine Learning")

IMPORTANT FOR ATS COMPLIANCE:
- Use the exact terminology from the job posting
- Include variations (JavaScript AND JS if both are relevant)
- Capture tool names exactly (e.g., "Kubernetes" not just "container orchestration")
- Extract soft skills mentioned explicitly (not inferred)`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Analyze this job description and extract all keywords for ATS optimization:

JOB TITLE: ${jobTitle || "Not specified"}
COMPANY: ${company || "Not specified"}

JOB DESCRIPTION:
${description.substring(0, 8000)}` 
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_job_keywords",
              description: "Extract and categorize keywords from a job description for ATS optimization",
              parameters: {
                type: "object",
                properties: {
                  required_skills: {
                    type: "array",
                    items: { type: "string" },
                    description: "Skills explicitly marked as required, must-have, or essential in the job posting"
                  },
                  preferred_skills: {
                    type: "array",
                    items: { type: "string" },
                    description: "Skills marked as preferred, nice-to-have, bonus, or plus"
                  },
                  key_responsibilities: {
                    type: "array",
                    items: { type: "string" },
                    description: "Main responsibilities and duties that should be reflected in resume experience bullets (action verbs + context)"
                  },
                  job_title: {
                    type: "string",
                    description: "The standardized job title extracted from the posting"
                  },
                  experience_level: {
                    type: "string",
                    enum: ["entry", "junior", "mid", "senior", "lead", "principal", "staff", "director", "executive"],
                    description: "The seniority level required for this position"
                  },
                  industry_keywords: {
                    type: "array",
                    items: { type: "string" },
                    description: "Industry-specific terms, domain knowledge, and business context keywords"
                  },
                  certifications: {
                    type: "array",
                    items: { type: "string" },
                    description: "Specific certifications mentioned (AWS Certified, PMP, CPA, etc.)"
                  },
                  soft_skills: {
                    type: "array",
                    items: { type: "string" },
                    description: "Soft skills explicitly mentioned (communication, leadership, problem-solving, etc.)"
                  },
                  tools_technologies: {
                    type: "array",
                    items: { type: "string" },
                    description: "Specific tools, platforms, frameworks, and technologies mentioned"
                  }
                },
                required: [
                  "required_skills",
                  "preferred_skills", 
                  "key_responsibilities",
                  "job_title",
                  "experience_level",
                  "tools_technologies"
                ],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_job_keywords" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI Keyword Extraction] API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Rate limit exceeded. Please try again in a moment." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "extract_job_keywords") {
      console.error("[AI Keyword Extraction] No valid tool call in response");
      throw new Error("Failed to extract keywords from AI response");
    }

    const extracted: Partial<ExtractedKeywords> = JSON.parse(toolCall.function.arguments);
    
    console.log(`[AI Keyword Extraction] Extracted - Required: ${extracted.required_skills?.length || 0}, Preferred: ${extracted.preferred_skills?.length || 0}, Responsibilities: ${extracted.key_responsibilities?.length || 0}`);

    // Build prioritized ATS keyword list
    const atsPriorityKeywords = [
      ...(extracted.required_skills || []),
      ...(extracted.tools_technologies || []),
      ...(extracted.certifications || []),
      ...(extracted.preferred_skills || []).slice(0, 10),
      ...(extracted.soft_skills || []).slice(0, 5),
    ].filter((kw, idx, arr) => arr.indexOf(kw) === idx); // dedupe

    const result: ExtractedKeywords = {
      required_skills: extracted.required_skills || [],
      preferred_skills: extracted.preferred_skills || [],
      key_responsibilities: extracted.key_responsibilities || [],
      job_title: extracted.job_title || jobTitle || "",
      experience_level: extracted.experience_level || "mid",
      industry_keywords: extracted.industry_keywords || [],
      certifications: extracted.certifications || [],
      soft_skills: extracted.soft_skills || [],
      tools_technologies: extracted.tools_technologies || [],
      ats_priority_keywords: atsPriorityKeywords.slice(0, 40), // Top 40 for ATS
    };

    return new Response(JSON.stringify({
      success: true,
      keywords: result,
      totalKeywords: atsPriorityKeywords.length,
      breakdown: {
        required: result.required_skills.length,
        preferred: result.preferred_skills.length,
        responsibilities: result.key_responsibilities.length,
        tools: result.tools_technologies.length,
        certifications: result.certifications.length,
        softSkills: result.soft_skills.length,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[AI Keyword Extraction] Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Failed to extract keywords" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
