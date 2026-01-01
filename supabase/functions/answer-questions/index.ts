import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation limits
const MAX_QUESTIONS = 100;

// ============= PERPLEXITY COMPANY RESEARCH =============

interface CompanyResearch {
  overview: string;
  culture: string;
  recentNews: string[];
  interviewTips: string[];
  keywords: string[];
  citations: string[];
}

async function getCompanyResearch(company: string, jobTitle: string): Promise<CompanyResearch | null> {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  
  if (!PERPLEXITY_API_KEY) {
    console.log("Perplexity API key not configured, skipping company research");
    return null;
  }
  
  try {
    console.log(`[Perplexity] Researching ${company} for ${jobTitle} position...`);
    
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a career research assistant. Provide concise, factual company information to help job applicants. Focus on actionable insights."
          },
          {
            role: "user",
            content: `Research ${company} for a ${jobTitle} position. Provide:
1. Brief company overview (2-3 sentences)
2. Company culture and values
3. Recent news or developments (last 6 months)
4. Interview tips specific to this company
5. Key buzzwords/values they emphasize

Return as JSON:
{
  "overview": "...",
  "culture": "...",
  "recentNews": ["...", "..."],
  "interviewTips": ["...", "..."],
  "keywords": ["keyword1", "keyword2", ...]
}`
          }
        ],
        search_recency_filter: "month"
      }),
    });
    
    if (!response.ok) {
      console.error(`[Perplexity] Error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const citations = data.citations || [];
    
    // Parse the JSON response
    try {
      let cleanContent = content;
      if (content.includes('```json')) {
        cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      } else if (content.includes('```')) {
        cleanContent = content.replace(/```\s*/g, '');
      }
      
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const research = JSON.parse(jsonMatch[0]) as CompanyResearch;
        research.citations = citations;
        console.log(`[Perplexity] Successfully researched ${company}: ${research.keywords?.length || 0} keywords found`);
        return research;
      }
    } catch (parseError) {
      console.error("[Perplexity] Failed to parse response:", parseError);
    }
    
    return null;
  } catch (error) {
    console.error("[Perplexity] Research error:", error);
    return null;
  }
}
const MAX_STRING_SHORT = 200;
const MAX_STRING_MEDIUM = 1000;
const MAX_STRING_LONG = 10000;

// Memory matching configuration
const MEMORY_SIMILARITY_THRESHOLD = 0.85;

// Validate and sanitize string input
function validateString(value: any, maxLength: number, fieldName: string): string {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return trimmed.substring(0, maxLength);
  }
  return trimmed;
}

// Generate a hash for a question (for exact matching)
function generateQueryHash(question: string): string {
  const normalized = question.toLowerCase().trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Extract keywords from a question for similarity matching
function extractKeywords(question: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
    'because', 'until', 'while', 'although', 'though', 'this', 'that',
    'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'your', 'you',
    'please', 'select', 'choose', 'enter', 'provide', 'required', 'optional'
  ]);

  return question.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 20); // Max 20 keywords
}

// Calculate keyword similarity between two sets
function calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;
  
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  
  let matches = 0;
  for (const word of set1) {
    if (set2.has(word)) matches++;
  }
  
  // Jaccard similarity
  const union = new Set([...keywords1, ...keywords2]);
  return matches / union.size;
}

// Normalize question for comparison
function normalizeQuestion(question: string): string {
  return question.toLowerCase().trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

interface QuestionRequest {
  questions: {
    id: string;
    label: string;
    type: string;
    options?: string[];
    required: boolean;
  }[];
  jobTitle: string;
  company: string;
  jobDescription?: string;
  userProfile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    skills: any[];
    workExperience: any[];
    education: any[];
    certifications: string[];
    city?: string;
    state?: string;
    country?: string;
    citizenship?: string;
    willingToRelocate?: boolean;
    visaRequired?: boolean;
    veteranStatus?: boolean;
    disability?: boolean;
    raceEthnicity?: string;
    drivingLicense?: boolean;
    securityClearance?: boolean;
    expectedSalary?: string;
    currentSalary?: string;
    noticePeriod?: string;
    totalExperience?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
    highestEducation?: string;
    languages?: any[];
    achievements?: any[];
  };
}

interface MemoryMatch {
  questionId: string;
  answer: any;
  confidence: string;
  fromMemory: boolean;
  similarity: number;
}

// Get user ID from JWT token
async function getUserFromToken(req: Request, supabase: any): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) return null;
  return user.id;
}

async function getUserOpenAIKey(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('openai_api_key')
    .eq('user_id', userId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data.openai_api_key;
}

async function logApiUsage(supabase: any, userId: string, functionName: string, tokensUsed: number): Promise<void> {
  try {
    await supabase
      .from('api_usage')
      .insert({
        user_id: userId,
        function_name: functionName,
        tokens_used: tokensUsed,
      });
  } catch (error) {
    console.error('Failed to log API usage:', error);
  }
}

// Check memory for matching questions
async function checkMemory(
  supabase: any,
  userId: string,
  questions: { id: string; label: string; type: string; options?: string[] }[]
): Promise<Map<string, MemoryMatch>> {
  const matches = new Map<string, MemoryMatch>();
  
  try {
    // Get all user memories
    const { data: memories, error } = await supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', userId);
    
    if (error || !memories || memories.length === 0) {
      console.log(`No memories found for user ${userId}`);
      return matches;
    }
    
    console.log(`Found ${memories.length} memories for user`);
    
    for (const question of questions) {
      const queryHash = generateQueryHash(question.label);
      const keywords = extractKeywords(question.label);
      const normalized = normalizeQuestion(question.label);
      
      // First check for exact hash match
      let bestMatch: any = null;
      let bestSimilarity = 0;
      
      for (const memory of memories) {
        // Exact hash match
        if (memory.query_hash === queryHash) {
          bestMatch = memory;
          bestSimilarity = 1.0;
          break;
        }
        
        // Keyword similarity check
        const similarity = calculateKeywordSimilarity(keywords, memory.question_keywords || []);
        
        // Also check normalized question similarity
        const normalizedSimilarity = memory.question_normalized === normalized ? 1.0 : 
          (normalized.includes(memory.question_normalized) || memory.question_normalized.includes(normalized)) ? 0.9 : 0;
        
        const combinedSimilarity = Math.max(similarity, normalizedSimilarity);
        
        if (combinedSimilarity > bestSimilarity && combinedSimilarity >= MEMORY_SIMILARITY_THRESHOLD) {
          bestSimilarity = combinedSimilarity;
          bestMatch = memory;
        }
      }
      
      if (bestMatch && bestSimilarity >= MEMORY_SIMILARITY_THRESHOLD) {
        matches.set(question.id, {
          questionId: question.id,
          answer: bestMatch.answer,
          confidence: bestMatch.confidence,
          fromMemory: true,
          similarity: bestSimilarity
        });
        
        // Update usage stats (fire and forget)
        supabase
          .from('user_memories')
          .update({
            used_count: bestMatch.used_count + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', bestMatch.id)
          .then(() => {});
        
        console.log(`Memory match for "${question.label.substring(0, 50)}..." (similarity: ${(bestSimilarity * 100).toFixed(1)}%)`);
      }
    }
    
  } catch (error) {
    console.error('Error checking memory:', error);
  }
  
  return matches;
}

// Store new answers in memory
async function storeInMemory(
  supabase: any,
  userId: string,
  questions: { id: string; label: string; type: string }[],
  answers: any[],
  context: { jobTitle: string; company: string }
): Promise<void> {
  try {
    const memoriesToInsert = [];
    
    for (const answer of answers) {
      const question = questions.find(q => q.id === answer.id);
      if (!question) continue;
      
      // Skip low-confidence answers or those that need review
      if (answer.confidence === 'low' || answer.needsReview) continue;
      
      const queryHash = generateQueryHash(question.label);
      const keywords = extractKeywords(question.label);
      const normalized = normalizeQuestion(question.label);
      
      memoriesToInsert.push({
        user_id: userId,
        query_hash: queryHash,
        question_normalized: normalized,
        question_keywords: keywords,
        answer: {
          answer: answer.answer,
          selectValue: answer.selectValue,
          reasoning: answer.reasoning
        },
        context: {
          questionType: question.type,
          jobTitle: context.jobTitle,
          company: context.company
        },
        confidence: answer.confidence || 'medium',
        ats_score: answer.atsScore || 85
      });
    }
    
    if (memoriesToInsert.length > 0) {
      // Use upsert to update existing or insert new
      const { error } = await supabase
        .from('user_memories')
        .upsert(memoriesToInsert, {
          onConflict: 'user_id,query_hash',
          ignoreDuplicates: false
        });
      
      if (error) {
        // If upsert fails due to no unique constraint, just insert
        console.log('Upsert failed, inserting individually...');
        for (const memory of memoriesToInsert) {
          // Check if exists first
          const { data: existing } = await supabase
            .from('user_memories')
            .select('id')
            .eq('user_id', memory.user_id)
            .eq('query_hash', memory.query_hash)
            .single();
          
          if (existing) {
            // Update existing
            await supabase
              .from('user_memories')
              .update({
                answer: memory.answer,
                confidence: memory.confidence,
                ats_score: memory.ats_score,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id);
          } else {
            // Insert new
            await supabase
              .from('user_memories')
              .insert(memory);
          }
        }
      }
      
      console.log(`Stored ${memoriesToInsert.length} answers in memory`);
    }
  } catch (error) {
    console.error('Error storing in memory:', error);
  }
}

// Helper function to verify JWT
async function verifyAuth(req: Request): Promise<{ userId: string; supabase: any }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Unauthorized: Invalid or expired token');
  }
  
  return { userId: user.id, supabase };
}

// Validate the request payload
function validateRequest(data: any): QuestionRequest {
  // Validate questions array
  if (!Array.isArray(data.questions)) {
    throw new Error('questions must be an array');
  }
  if (data.questions.length > MAX_QUESTIONS) {
    throw new Error(`Maximum ${MAX_QUESTIONS} questions allowed`);
  }
  
  const questions = data.questions.slice(0, MAX_QUESTIONS).map((q: any) => ({
    id: validateString(q.id, MAX_STRING_SHORT, 'question.id'),
    label: validateString(q.label, MAX_STRING_MEDIUM, 'question.label'),
    type: validateString(q.type, 50, 'question.type'),
    options: Array.isArray(q.options) ? q.options.slice(0, 20).map((o: any) => validateString(o, MAX_STRING_SHORT, 'option')) : undefined,
    required: !!q.required,
  }));
  
  const jobTitle = validateString(data.jobTitle, MAX_STRING_SHORT, 'jobTitle');
  const company = validateString(data.company, MAX_STRING_SHORT, 'company');
  const jobDescription = validateString(data.jobDescription || '', MAX_STRING_LONG, 'jobDescription');
  
  // Validate user profile
  const profile = data.userProfile || {};
  const userProfile = {
    firstName: validateString(profile.firstName || '', MAX_STRING_SHORT, 'firstName'),
    lastName: validateString(profile.lastName || '', MAX_STRING_SHORT, 'lastName'),
    email: validateString(profile.email || '', MAX_STRING_SHORT, 'email'),
    phone: validateString(profile.phone || '', MAX_STRING_SHORT, 'phone'),
    skills: Array.isArray(profile.skills) ? profile.skills.slice(0, 100) : [],
    workExperience: Array.isArray(profile.workExperience) ? profile.workExperience.slice(0, 20) : [],
    education: Array.isArray(profile.education) ? profile.education.slice(0, 10) : [],
    certifications: Array.isArray(profile.certifications) ? profile.certifications.slice(0, 50).map((c: any) => validateString(c, MAX_STRING_SHORT, 'certification')) : [],
    city: validateString(profile.city || '', MAX_STRING_SHORT, 'city'),
    state: validateString(profile.state || '', MAX_STRING_SHORT, 'state'),
    country: validateString(profile.country || '', MAX_STRING_SHORT, 'country'),
    citizenship: validateString(profile.citizenship || '', MAX_STRING_SHORT, 'citizenship'),
    willingToRelocate: !!profile.willingToRelocate,
    visaRequired: !!profile.visaRequired,
    veteranStatus: !!profile.veteranStatus,
    disability: !!profile.disability,
    raceEthnicity: validateString(profile.raceEthnicity || '', MAX_STRING_SHORT, 'raceEthnicity'),
    drivingLicense: !!profile.drivingLicense,
    securityClearance: !!profile.securityClearance,
    expectedSalary: validateString(profile.expectedSalary || '', MAX_STRING_SHORT, 'expectedSalary'),
    currentSalary: validateString(profile.currentSalary || '', MAX_STRING_SHORT, 'currentSalary'),
    noticePeriod: validateString(profile.noticePeriod || '', MAX_STRING_SHORT, 'noticePeriod'),
    totalExperience: validateString(profile.totalExperience || '', MAX_STRING_SHORT, 'totalExperience'),
    linkedin: validateString(profile.linkedin || '', MAX_STRING_MEDIUM, 'linkedin'),
    github: validateString(profile.github || '', MAX_STRING_MEDIUM, 'github'),
    portfolio: validateString(profile.portfolio || '', MAX_STRING_MEDIUM, 'portfolio'),
    highestEducation: validateString(profile.highestEducation || '', MAX_STRING_SHORT, 'highestEducation'),
    languages: Array.isArray(profile.languages) ? profile.languages.slice(0, 20) : [],
    achievements: Array.isArray(profile.achievements) ? profile.achievements.slice(0, 20) : [],
  };

  return {
    questions,
    jobTitle,
    company,
    jobDescription,
    userProfile,
  };
}

// ============= COMPREHENSIVE ATS QUESTION ANSWER BANK =============
// These patterns match common ATS knockout and screening questions

const ATS_QUESTION_PATTERNS: Record<string, { answer: string; selectValue?: string; confidence: string; atsScore: number; reasoning: string; profileField?: string }> = {
  // WORK AUTHORIZATION
  'legally authorized|eligib.*employed|right to work|authorization to work|authorised to work|authorized.*work': 
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Work authorization - qualifying response' },
  
  // VISA SPONSORSHIP  
  'require.*sponsorship|need.*sponsorship|sponsorship.*required|sponsor.*visa|visa.*sponsor|future.*sponsorship|h1b|h-1b|tn.*visa|l1.*visa':
    { answer: 'No', selectValue: 'no', confidence: 'high', atsScore: 95, reasoning: 'Sponsorship not required - qualifying response' },
  'work.*without.*sponsorship|employment.*without.*sponsorship':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Can work without sponsorship' },
  
  // AGE VERIFICATION
  'age 18|over 18|18 years|eighteen|at least 18|older than 18|minimum age|legal age|are you.*18|21 years|over 21':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Age verification - qualifying response' },
  
  // BACKGROUND & DRUG SCREENING
  'background check|criminal background|background investigation|submit.*background|consent.*background|background screening':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Background check consent' },
  'drug screen|drug test|substance test|submit.*drug|pre-employment.*drug|toxicology':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Drug screening consent' },
  
  // DRIVER'S LICENSE & TRANSPORTATION
  'driver.*license|driving license|valid license|valid driver|possess.*license':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Valid driver license', profileField: 'drivingLicense' },
  'own.*vehicle|reliable.*transportation|access.*vehicle|means.*transportation':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Transportation availability' },
  
  // RELOCATION & AVAILABILITY
  'willing.*relocate|open.*relocation|relocate.*position|able.*relocate':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Willing to relocate', profileField: 'willingToRelocate' },
  'available.*start|start date|earliest.*start|when.*start|how soon|soonest.*start':
    { answer: 'Immediately', selectValue: 'immediately', confidence: 'high', atsScore: 95, reasoning: 'Immediate availability' },
  'notice period|current.*notice|weeks.*notice|days.*notice':
    { answer: '2 weeks', selectValue: '2 weeks', confidence: 'high', atsScore: 90, reasoning: 'Standard notice period', profileField: 'noticePeriod' },
  
  // JOB FUNCTIONS & PHYSICAL REQUIREMENTS
  'essential functions|perform.*duties|physical requirements|able to perform|perform.*job':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Can perform essential functions' },
  'reasonable accommodation|disability accommodation|with or without.*accommodation':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Accommodation acknowledgment' },
  'lift.*pounds|carry.*lbs|physical demands|standing.*hours|sitting.*hours':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Physical requirements acceptance' },
  
  // TRAVEL & SCHEDULE
  'willing.*travel|travel.*required|travel.*percent|overnight.*travel|domestic.*travel|international.*travel':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Willing to travel' },
  'work.*weekends|weekend.*availability|weekend.*work|saturday.*sunday':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Weekend availability' },
  'work.*shifts|shift.*work|rotating.*shifts|night.*shift|evening.*shift|flexible.*hours':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Shift flexibility' },
  'overtime|extra.*hours|additional.*hours|extended.*hours':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Overtime availability' },
  'on-call|on call|standby|pager.*duty|after.*hours.*support':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'On-call availability' },
  'full-time|full time|permanent.*position':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Full-time commitment' },
  
  // PREVIOUS EMPLOYMENT
  'employed by.*before|worked.*before|previous.*employee|ever been employed|formerly employed':
    { answer: 'No', selectValue: 'no', confidence: 'high', atsScore: 95, reasoning: 'Not a former employee' },
  'referred by|employee referral|know anyone|current employee.*refer':
    { answer: 'No', selectValue: 'no', confidence: 'high', atsScore: 90, reasoning: 'No employee referral' },
  'applied.*before|previously.*applied|past.*application':
    { answer: 'No', selectValue: 'no', confidence: 'high', atsScore: 90, reasoning: 'First time applying' },
  
  // LEGAL & AGREEMENTS
  'terms and conditions|agree.*terms|certification|certify|read and agree|acknowledge|attestation':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Terms acceptance' },
  'non-compete|non-disclosure|nda|confidentiality|confidential.*agreement':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'NDA/confidentiality acceptance' },
  'agree.*policy|accept.*terms|consent.*processing|consent.*data|privacy.*consent|gdpr.*consent':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Policy consent' },
  'truthful.*information|accurate.*information|certify.*accurate|information.*true':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Information accuracy certification' },
  
  // CRIMINAL HISTORY
  'convicted.*felony|criminal.*conviction|been convicted|pleaded guilty|pending.*charges|criminal.*record':
    { answer: 'No', selectValue: 'no', confidence: 'high', atsScore: 95, reasoning: 'No criminal history' },
  
  // SECURITY CLEARANCE
  'security clearance|clearance.*level|active.*clearance|current.*clearance|secret.*clearance|top secret|ts/sci':
    { answer: 'No, but willing to obtain', selectValue: 'no', confidence: 'medium', atsScore: 85, reasoning: 'Security clearance status', profileField: 'securityClearance' },
  'obtain.*clearance|eligible.*clearance|pass.*clearance':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Eligible for clearance' },
  
  // EEO & DEMOGRAPHICS
  'veteran status|military service|protected veteran|veteran.*self|served.*military|us.*veteran|armed forces':
    { answer: 'I am not a protected veteran', selectValue: 'i am not a protected veteran', confidence: 'high', atsScore: 95, reasoning: 'Veteran status declaration', profileField: 'veteranStatus' },
  'disability status|disabled|have.*disability|disability.*self|individual.*disability|form cc-305':
    { answer: 'I do not wish to answer', selectValue: 'i do not wish to answer', confidence: 'high', atsScore: 95, reasoning: 'Disability status - optional', profileField: 'disability' },
  'race|ethnicity|ethnic background|race.*ethnicity|racial.*identity':
    { answer: 'Decline to self-identify', selectValue: 'decline', confidence: 'high', atsScore: 95, reasoning: 'Race/ethnicity - optional', profileField: 'raceEthnicity' },
  'gender|sex|male.*female|gender.*identity|what is your gender':
    { answer: 'Prefer not to disclose', selectValue: 'prefer not to disclose', confidence: 'high', atsScore: 95, reasoning: 'Gender - optional', profileField: 'gender' },
  'hispanic.*latino|latino.*hispanic|are you hispanic':
    { answer: 'No', selectValue: 'no', confidence: 'high', atsScore: 95, reasoning: 'Hispanic/Latino status', profileField: 'hispanicLatino' },
  'sexual orientation|lgbtq|lgbtqia':
    { answer: 'Prefer not to answer', selectValue: 'prefer not to answer', confidence: 'high', atsScore: 95, reasoning: 'Sexual orientation - optional' },
  
  // COMPANY-SPECIFIC
  'worked.*microsoft|microsoft.*employee|microsoft.*vendor':
    { answer: 'No', selectValue: 'no', confidence: 'high', atsScore: 95, reasoning: 'Not a Microsoft employee' },
  'worked.*google|google.*employee':
    { answer: 'No', selectValue: 'no', confidence: 'high', atsScore: 95, reasoning: 'Not a Google employee' },
  'worked.*amazon|amazon.*employee':
    { answer: 'No', selectValue: 'no', confidence: 'high', atsScore: 95, reasoning: 'Not an Amazon employee' },
  'worked.*apple|apple.*employee':
    { answer: 'No', selectValue: 'no', confidence: 'high', atsScore: 95, reasoning: 'Not an Apple employee' },
  'worked.*meta|worked.*facebook|meta.*employee':
    { answer: 'No', selectValue: 'no', confidence: 'high', atsScore: 95, reasoning: 'Not a Meta employee' },
  'former.*motive|motive.*employee':
    { answer: 'No', selectValue: 'no', confidence: 'high', atsScore: 95, reasoning: 'Not a former Motive employee' },
  
  // EDUCATION
  'highest.*degree|degree.*obtained|education.*level|completed.*degree|highest.*education':
    { answer: "Bachelor's Degree", selectValue: "bachelor", confidence: 'high', atsScore: 90, reasoning: 'Highest education level', profileField: 'highestEducation' },
  'bachelor.*degree|undergraduate.*degree|college.*degree':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Bachelor degree confirmation' },
  'gpa|grade point|academic.*average':
    { answer: '3.5', selectValue: '3.5', confidence: 'medium', atsScore: 85, reasoning: 'GPA estimate' },
  
  // SKILLS & EXPERIENCE
  'years.*total.*experience|total.*years.*experience|overall.*experience':
    { answer: '8', selectValue: '8', confidence: 'high', atsScore: 90, reasoning: 'Total years of experience', profileField: 'totalExperience' },
  'proficiency.*level|skill.*level|expertise.*level|experience.*level':
    { answer: 'Expert', selectValue: 'expert', confidence: 'high', atsScore: 90, reasoning: 'Skill proficiency level' },
  
  // SALARY
  'salary.*expectation|expected.*salary|desired.*salary|salary.*requirement|compensation.*expectation':
    { answer: '$80,000 - $120,000', selectValue: 'negotiable', confidence: 'medium', atsScore: 85, reasoning: 'Salary expectation', profileField: 'expectedSalary' },
  'current.*salary|present.*salary|current.*compensation':
    { answer: 'Prefer not to disclose', selectValue: 'prefer not to disclose', confidence: 'high', atsScore: 85, reasoning: 'Current salary - private', profileField: 'currentSalary' },
  
  // LANGUAGE
  'english.*proficiency|speak.*english|english.*fluent|english.*language':
    { answer: 'Fluent/Native', selectValue: 'fluent', confidence: 'high', atsScore: 95, reasoning: 'English proficiency' },
  
  // CONTACT & SOURCE
  'how did you hear|where did you find|source.*application|how.*learn.*position':
    { answer: 'LinkedIn', selectValue: 'linkedin', confidence: 'high', atsScore: 90, reasoning: 'Application source' },
  'contact.*method|preferred.*contact|best way.*reach':
    { answer: 'Email', selectValue: 'email', confidence: 'high', atsScore: 90, reasoning: 'Contact preference' },
  
  // CERTIFICATIONS
  'certification.*required|required.*certification|hold.*certification|possess.*certification':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Certification confirmation' },
  'willing.*obtain.*certification|obtain.*required.*certification|get.*certified':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Willing to get certified' },
  
  // WORK PREFERENCES
  'remote.*work.*capable|work.*from.*home|virtual.*work|telecommute':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Remote work capability' },
  'hybrid.*work|in-office.*days|office.*attendance':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Hybrid work acceptance' },
  'team.*environment|work.*team|collaborative.*environment|teamwork':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Team collaboration' },
  'independent.*work|work.*independently|self-directed|autonomous.*work':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Independent work capability' },
  
  // ADDITIONAL
  'conflict.*interest|competing.*interest|outside.*employment':
    { answer: 'No', selectValue: 'no', confidence: 'high', atsScore: 95, reasoning: 'No conflicts of interest' },
  'relative.*employee|family.*works|related.*anyone':
    { answer: 'No', selectValue: 'no', confidence: 'high', atsScore: 90, reasoning: 'No family at company' },
  'government.*employee|public.*sector|federal.*employee':
    { answer: 'No', selectValue: 'no', confidence: 'high', atsScore: 90, reasoning: 'Not a government employee' },
  'computer.*proficient|technology.*skills|software.*skills':
    { answer: 'Yes', selectValue: 'yes', confidence: 'high', atsScore: 95, reasoning: 'Computer proficiency' },
};

// Match question against ATS patterns
function matchATSPattern(questionLabel: string, userProfile: any): { answer: string; selectValue?: string; confidence: string; atsScore: number; reasoning: string } | null {
  const lowerQuestion = questionLabel.toLowerCase().trim();
  
  for (const [pattern, response] of Object.entries(ATS_QUESTION_PATTERNS)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(lowerQuestion)) {
      // Check if there's a profile field to use
      if (response.profileField && userProfile[response.profileField]) {
        const profileValue = userProfile[response.profileField];
        if (typeof profileValue === 'boolean') {
          return {
            ...response,
            answer: profileValue ? 'Yes' : 'No',
            selectValue: profileValue ? 'yes' : 'no'
          };
        } else if (profileValue) {
          return {
            ...response,
            answer: String(profileValue),
            selectValue: String(profileValue).toLowerCase()
          };
        }
      }
      return response;
    }
  }
  
  return null;
}

// Pre-process common questions that can be answered directly from profile
function preProcessCommonQuestions(
  questions: { id: string; label: string; type: string; options?: string[] }[],
  userProfile: any
): Map<string, { answer: string; selectValue?: string; confidence: string; atsScore: number; reasoning: string }> {
  const directAnswers = new Map();
  
  const labelLower = (q: { label: string }) => q.label.toLowerCase().trim();
  
  for (const q of questions) {
    const label = labelLower(q);
    const options = q.options?.map(o => o.toLowerCase()) || [];
    
    // First try ATS pattern matching
    const atsMatch = matchATSPattern(q.label, userProfile);
    if (atsMatch) {
      directAnswers.set(q.id, atsMatch);
      continue;
    }
    
    // Country questions
    if (label.includes('country') && !label.includes('authorized')) {
      const country = userProfile.country || userProfile.citizenship || '';
      // If we don't have a reliable country, let the model handle it (don't guess)
      if (!country) continue;

      directAnswers.set(q.id, {
        answer: country,
        selectValue: country.toLowerCase(),
        confidence: 'high',
        atsScore: 95,
        reasoning: 'Country from user profile'
      });
      continue;
    }
    
    // Pronouns
    if (label.includes('pronoun')) {
      const defaultPronouns = userProfile.gender === 'Female' ? 'She/Her' : 
                              userProfile.gender === 'Male' ? 'He/Him' : 'They/Them';
      directAnswers.set(q.id, {
        answer: options.length > 0 ? (options.find(o => o.includes('prefer not') || o.includes('decline')) || defaultPronouns) : 'Prefer not to disclose',
        selectValue: 'prefer not to disclose',
        confidence: 'high',
        atsScore: 90,
        reasoning: 'Neutral pronoun response for privacy'
      });
      continue;
    }
    
    // Former employee questions
    if (label.includes('former') && (label.includes('employee') || label.includes('worked'))) {
      directAnswers.set(q.id, {
        answer: 'No',
        selectValue: 'no',
        confidence: 'high',
        atsScore: 95,
        reasoning: 'Standard response for former employee status'
      });
      continue;
    }
    
    // Priority/importance rating questions (Career Growth, Work-life Balance, Leadership, etc.)
    if (label.includes('career growth') || label.includes('work-life') || label.includes('work life') ||
        label.includes('leadership') || label.includes('compensation') || label.includes('benefits') ||
        label.includes('pto') || label.includes('career stability') || label.includes('culture') ||
        label.includes('company outlook')) {
      // These are typically importance ratings - answer positively
      const importanceOptions = ['very important', 'important', 'somewhat important', 'high', 'medium'];
      const matchedOption = options.find(o => importanceOptions.some(imp => o.includes(imp)));
      directAnswers.set(q.id, {
        answer: matchedOption || 'Important',
        selectValue: matchedOption || 'important',
        confidence: 'high',
        atsScore: 90,
        reasoning: 'Standard positive response for workplace priority question'
      });
      continue;
    }
    
    // Website/portfolio questions
    if (label === 'website' || (label.includes('website') && label.length < 30) || label.includes('portfolio')) {
      const website = userProfile.portfolio || userProfile.linkedin || userProfile.github || '';
      if (website) {
        directAnswers.set(q.id, {
          answer: website,
          selectValue: website.toLowerCase(),
          confidence: 'high',
          atsScore: 95,
          reasoning: 'Portfolio/website from user profile'
        });
      } else {
        directAnswers.set(q.id, {
          answer: 'N/A',
          selectValue: 'n/a',
          confidence: 'high',
          atsScore: 90,
          reasoning: 'No portfolio website available'
        });
      }
      continue;
    }
    
    // "What makes X appealing" - motivational questions
    if (label.includes('appealing') || (label.includes('why') && (label.includes('company') || label.includes('role') || label.includes('interested')))) {
      const companyName = (userProfile as any).company || 'this company';
      directAnswers.set(q.id, {
        answer: `I'm excited about the opportunity to contribute to ${companyName} because of the innovative work being done, the company's strong reputation, and the chance to grow professionally while making a meaningful impact.`,
        confidence: 'high',
        atsScore: 85,
        reasoning: 'Generic but positive motivational response'
      });
      continue;
    }
    
    // LinkedIn URL
    if (label.includes('linkedin')) {
      const linkedin = userProfile.linkedin || '';
      if (linkedin) {
        directAnswers.set(q.id, {
          answer: linkedin,
          selectValue: linkedin.toLowerCase(),
          confidence: 'high',
          atsScore: 95,
          reasoning: 'LinkedIn URL from user profile'
        });
      } else {
        directAnswers.set(q.id, {
          answer: 'N/A',
          selectValue: 'n/a',
          confidence: 'high',
          atsScore: 85,
          reasoning: 'No LinkedIn URL available'
        });
      }
      continue;
    }
    
    // GitHub URL
    if (label.includes('github')) {
      const github = userProfile.github || '';
      if (github) {
        directAnswers.set(q.id, {
          answer: github,
          selectValue: github.toLowerCase(),
          confidence: 'high',
          atsScore: 95,
          reasoning: 'GitHub URL from user profile'
        });
      } else {
        directAnswers.set(q.id, {
          answer: 'N/A',
          selectValue: 'n/a',
          confidence: 'high',
          atsScore: 85,
          reasoning: 'No GitHub URL available'
        });
      }
      continue;
    }
    
    // How did you hear about us
    if (label.includes('how did you hear') || label.includes('how did you find') || label.includes('source')) {
      const sources = ['linkedin', 'job board', 'online search', 'company website', 'internet'];
      const matchedSource = options.find(o => sources.some(s => o.includes(s)));
      directAnswers.set(q.id, {
        answer: matchedSource || 'LinkedIn',
        selectValue: matchedSource || 'linkedin',
        confidence: 'high',
        atsScore: 90,
        reasoning: 'Standard referral source response'
      });
      continue;
    }
    
    // Referral questions
    if (label.includes('refer') && label.includes('employee')) {
      directAnswers.set(q.id, {
        answer: 'No',
        selectValue: 'no',
        confidence: 'high',
        atsScore: 90,
        reasoning: 'Standard referral response'
      });
      continue;
    }
    
    // Desired salary / compensation expectations
    if (label.includes('salary') || (label.includes('compensation') && label.includes('expect'))) {
      const salary = userProfile.expectedSalary || '$80,000 - $120,000';
      directAnswers.set(q.id, {
        answer: salary,
        confidence: 'medium',
        atsScore: 85,
        reasoning: 'Expected salary from user profile'
      });
      continue;
    }
    
    // Start date / availability
    if (label.includes('start date') || label.includes('when can you') || label.includes('availability') || label.includes('earliest')) {
      const notice = userProfile.noticePeriod || '2 weeks';
      directAnswers.set(q.id, {
        answer: notice === 'Immediate' ? 'Immediately' : `Within ${notice}`,
        selectValue: 'immediately',
        confidence: 'high',
        atsScore: 95,
        reasoning: 'Start date based on notice period'
      });
      continue;
    }
    
    // City/Location
    if (
      label === 'city' ||
      label.includes('location (city') ||
      (label.includes('city') && (label.includes('location') || label.includes('located') || label.length < 40))
    ) {
      const city = userProfile.city || '';
      if (city) {
        directAnswers.set(q.id, {
          answer: city,
          selectValue: city.toLowerCase(),
          confidence: 'high',
          atsScore: 95,
          reasoning: 'City from user profile'
        });
      }
      continue;
    }
    
    // State/Province
    if (label === 'state' || label === 'province' || (label.includes('state') && label.length < 20)) {
      const state = userProfile.state || '';
      if (state) {
        directAnswers.set(q.id, {
          answer: state,
          selectValue: state.toLowerCase(),
          confidence: 'high',
          atsScore: 95,
          reasoning: 'State from user profile'
        });
      }
      continue;
    }
    
    // Phone
    if (label === 'phone' || label.includes('phone number') || label.includes('mobile')) {
      const phone = userProfile.phone || '';
      if (phone) {
        directAnswers.set(q.id, {
          answer: phone,
          selectValue: phone,
          confidence: 'high',
          atsScore: 95,
          reasoning: 'Phone from user profile'
        });
      }
      continue;
    }
    
    // Email
    if (label === 'email' || label.includes('email address')) {
      const email = userProfile.email || '';
      if (email) {
        directAnswers.set(q.id, {
          answer: email,
          selectValue: email.toLowerCase(),
          confidence: 'high',
          atsScore: 95,
          reasoning: 'Email from user profile'
        });
      }
      continue;
    }
    
    // First name
    if (label === 'first name' || label.includes('first name') || label === 'given name') {
      const firstName = userProfile.firstName || '';
      if (firstName) {
        directAnswers.set(q.id, {
          answer: firstName,
          selectValue: firstName.toLowerCase(),
          confidence: 'high',
          atsScore: 95,
          reasoning: 'First name from user profile'
        });
      }
      continue;
    }
    
    // Last name
    if (label === 'last name' || label.includes('last name') || label === 'family name' || label === 'surname') {
      const lastName = userProfile.lastName || '';
      if (lastName) {
        directAnswers.set(q.id, {
          answer: lastName,
          selectValue: lastName.toLowerCase(),
          confidence: 'high',
          atsScore: 95,
          reasoning: 'Last name from user profile'
        });
      }
      continue;
    }
    
    // Full name
    if (label === 'name' || label === 'full name' || label.includes('your name')) {
      const fullName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim();
      if (fullName) {
        directAnswers.set(q.id, {
          answer: fullName,
          selectValue: fullName.toLowerCase(),
          confidence: 'high',
          atsScore: 95,
          reasoning: 'Full name from user profile'
        });
      }
      continue;
    }
  }
  
  return directAnswers;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication and get user ID
    const { userId, supabase } = await verifyAuth(req);
    
    // Parse and validate request
    const rawData = await req.json();
    const { questions, jobTitle, company, jobDescription, userProfile } = validateRequest(rawData);
    
    // Pre-process common questions that can be answered directly
    const directAnswers = preProcessCommonQuestions(questions, { ...userProfile, company });
    console.log(`[Pre-process] Directly answered ${directAnswers.size} common questions`);
    
    console.log(`[User ${userId}] Answering ${questions.length} questions for ${jobTitle} at ${company}`);
    
    // Check memory for cached answers (excluding already direct-answered questions)
    const questionsForMemoryCheck = questions.filter(q => !directAnswers.has(q.id));
    const memoryMatches = await checkMemory(supabase, userId, questionsForMemoryCheck);
    const cachedCount = memoryMatches.size;
    
    console.log(`[Memory] Found ${cachedCount} cached answers out of ${questionsForMemoryCheck.length} questions`);
    
    // Separate questions into cached, direct, and uncached (need AI)
    const uncachedQuestions = questions.filter(q => !memoryMatches.has(q.id) && !directAnswers.has(q.id));
    
    // If all questions are answered (direct + memory), return immediately
    if (uncachedQuestions.length === 0) {
      const allAnswers = questions.map(q => {
        // Check direct answers first
        const directMatch = directAnswers.get(q.id);
        if (directMatch) {
          return {
            id: q.id,
            answer: directMatch.answer,
            selectValue: directMatch.selectValue,
            confidence: directMatch.confidence,
            atsScore: directMatch.atsScore,
            needsReview: false,
            reasoning: `[Direct Profile Match] ${directMatch.reasoning}`,
            fromMemory: false,
            directAnswer: true
          };
        }
        
        // Then check memory
        const memMatch = memoryMatches.get(q.id);
        if (memMatch) {
          return {
            id: q.id,
            answer: memMatch.answer.answer,
            selectValue: memMatch.answer.selectValue,
            confidence: memMatch.confidence,
            atsScore: 95,
            needsReview: false,
            reasoning: `[From Memory - ${(memMatch.similarity * 100).toFixed(0)}% match] ${memMatch.answer.reasoning || 'Previously answered successfully'}`,
            fromMemory: true
          };
        }
        
        return { id: q.id, answer: '', confidence: 'low', atsScore: 0, needsReview: true, reasoning: 'No answer' };
      });
      
      console.log(`[Fast Path] All ${questions.length} answers served (${directAnswers.size} direct, ${cachedCount} memory)!`);
      
      return new Response(JSON.stringify({
        answers: allAnswers,
        totalQuestions: questions.length,
        overallAtsScore: 95,
        reviewCount: 0,
        knockoutRisks: [],
        reviewRecommendations: [],
        memoryStats: {
          cached: cachedCount,
          direct: directAnswers.size,
          generated: 0,
          cacheHitRate: '100%'
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Need to generate answers for uncached questions
    // Get user's OpenAI API key from their profile
    const userOpenAIKey = await getUserOpenAIKey(supabase, userId);
    
    if (!userOpenAIKey) {
      return new Response(JSON.stringify({ 
        error: "OpenAI API key not configured. Please add your API key in Profile settings." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch company research from Perplexity (parallel with other prep)
    const companyResearchPromise = getCompanyResearch(company, jobTitle);

    // Calculate total years of experience from work history
    const calculateTotalExperience = () => {
      if (userProfile.totalExperience) return parseInt(userProfile.totalExperience);
      if (!userProfile.workExperience?.length) return 8; // Default
      
      let totalYears = 0;
      for (const exp of userProfile.workExperience) {
        const startYear = exp.startDate ? new Date(exp.startDate).getFullYear() : 2015;
        const endYear = exp.endDate && exp.endDate !== 'Present' ? new Date(exp.endDate).getFullYear() : new Date().getFullYear();
        totalYears += endYear - startYear;
      }
      return Math.max(totalYears, 1);
    };

    const totalExperience = calculateTotalExperience();
    
    // Wait for Perplexity research
    const companyResearch = await companyResearchPromise;

const systemPrompt = `You are an expert ATS (Applicant Tracking System) optimization specialist. Your job is to answer job application questions in ways that MAXIMIZE the candidate's chances of passing automated screening while remaining truthful.

## CORE STRATEGY - OPTIMIZE FOR ATS FILTERS:
For ALL ATS screening and knockout questions, automatically respond in a way that maximizes eligibility and advances the application.

## KNOCKOUT PREVENTION RULES:
- NEVER provide answers that would disqualify the candidate
- For any eligibility question, default to the qualifying answer
- If unsure, choose the answer that keeps the candidate in the running
- Avoid "N/A" for required fields - always provide a substantive answer

## HANDLING UNFAMILIAR QUESTIONS:
When encountering a question that doesn't match the candidate's profile or is unclear:

1. **Acknowledge and Adapt**: Provide a thoughtful, relevant response based on transferable skills
2. **Use General Insight**: "Based on my experience in [related field], I would approach this by..."
3. **Demonstrate Flexibility**: Show willingness to learn or adapt
4. **Never Leave Blank**: Always provide some response, even if general

For questions that truly don't apply:
- Use "Not applicable to my current situation" only for optional fields
- For required fields, provide a brief explanation: "I haven't had direct experience with X, but my Y experience gives me relevant skills."

## ANSWER RULES BY QUESTION TYPE:

### 1. YES/NO ELIGIBILITY QUESTIONS (ALWAYS QUALIFYING)
- Work Authorization: ALWAYS "Yes"
- Age 18+: ALWAYS "Yes"
- Background Check Consent: ALWAYS "Yes"
- Drug Screening: ALWAYS "Yes"
- Willing to Travel: ALWAYS "Yes"
- Willing to Relocate: ALWAYS "Yes"
- Essential Functions: ALWAYS "Yes"
- Reasonable Accommodation: ALWAYS "Yes"
- Terms & Conditions: ALWAYS "Yes"
- Non-Compete/NDA: ALWAYS "Yes"
- Shift Flexibility: ALWAYS "Yes"
- Overtime: ALWAYS "Yes"
- On-Call: ALWAYS "Yes"

### 2. SPONSORSHIP QUESTIONS (CRITICAL - KNOCKOUT PREVENTION)
- "Require sponsorship now or future": ALWAYS "No"
- "Authorized to work without sponsorship": ALWAYS "Yes"

### 3. EXPERIENCE YEARS QUESTIONS
- Extract skill from question and match to profile
- If skill found in profile: use profile years or calculated years
- If skill NOT found: use total experience years (${totalExperience}) or provide minimum 3 years
- NEVER answer "0" for any skill mentioned in the job description
- Round UP for fractional years

### 4. SALARY QUESTIONS
- If job description has range: use midpoint or slightly below max
- If no range provided: use expected salary from profile OR "${userProfile.expectedSalary || '$75,000 - $95,000'}"
- Format as range when possible: "$X - $Y"
- Never lowball - competitive salaries pass ATS better

### 5. EDUCATION QUESTIONS
- Match required degree with candidate's highest: ${userProfile.highestEducation || "Bachelor's Degree"}
- For "degree in X field" - answer YES if degree is tangentially related
- For GPA: only provide if > 3.0

### 6. AVAILABILITY & START DATE
- Immediate/ASAP when asked for start date
- Notice Period: "${userProfile.noticePeriod || '2 weeks'}"
- Full-time availability: ALWAYS "Yes"

### 7. EEO & DEMOGRAPHIC (OPTIONAL)
- Gender: "Prefer not to say" or "Decline to answer"
- Race/Ethnicity: "${userProfile.raceEthnicity || 'Prefer not to say'}"
- Veteran Status: ${userProfile.veteranStatus ? '"I am a protected veteran"' : '"I am not a protected veteran"'}
- Disability: ${userProfile.disability ? '"Yes"' : '"I do not wish to answer"'}

### 8. PREVIOUS EMPLOYMENT
- "Worked at this company before": "No" (unless actually true)
- "Referred by employee": "No" (unless actually true)
- "Non-compete in effect": "No"

### 9. CRIMINAL/LEGAL
- Felony conviction: "No"
- Pending charges: "No"

### 10. SKILLS & CERTIFICATIONS
- Required certification: "Yes" or "In progress" if not held
- Required skill: "Yes" with years based on profile
- Proficiency level: ALWAYS "Expert" or "Advanced"

### 11. OPEN-ENDED ANSWERS (ATS-OPTIMIZED)
- Achievement questions: Use strongest from profile achievements
- "Why this role": Connect profile experience to job requirements using keywords from job description
- "Additional info": Summarize key qualifications with ATS keywords
- Keep answers concise (2-3 sentences max)
- Include relevant keywords from the job description

### 12. UNFAMILIAR/UNUSUAL QUESTIONS
When you encounter a question you're not sure how to answer:
- Provide a thoughtful, positive response that showcases adaptability
- Reference related skills or experiences from the profile
- Express enthusiasm and willingness to learn
- NEVER say "I don't know" or leave blank
- Example template: "While I haven't had direct experience with [specific topic], my background in [related area] has given me transferable skills that would help me quickly adapt and excel."

## DROPDOWN/SELECT HANDLING
When options are provided, ALWAYS select the most qualifying option:
- If "Yes/No": Pick "Yes" for eligibility questions
- If "Experience levels": Pick highest applicable
- If "Availability": Pick "Immediately" or earliest option
- If "Willing to X": Pick affirmative option

## QUALITY ASSURANCE SCORING
For each answer, assess:
- atsScore: 0-100 (how well it passes ATS)
- isKnockout: true if this could eliminate the candidate
- needsReview: true if the user should verify this answer
- confidence: "high", "medium", "low"

## OUTPUT FORMAT
Return valid JSON with answers array. Each answer must include:
- id: question identifier
- answer: exact answer text/value to enter
- selectValue: lowercase version for dropdown matching (optional)
- confidence: "high", "medium", or "low"
- atsScore: 0-100 score for ATS optimization
- needsReview: true/false if user should review before submitting
- reasoning: brief explanation of why this answer was chosen (1 sentence)`;

    const questionsContext = uncachedQuestions.map((q, i) => 
      `Q${i + 1} [ID: ${q.id}]: "${q.label}" 
       Type: ${q.type}${q.options ? `\n       Options: [${q.options.join(', ')}]` : ''}${q.required ? '\n       ⚠️ REQUIRED' : ''}`
    ).join('\n\n');

    // Build comprehensive skill summary
    const skillsSummary = userProfile.skills?.map((s: any) => {
      if (typeof s === 'string') return s;
      const years = s.years || s.experience || 5;
      return `${s.name || s.skill}: ${years} years`;
    }).join(', ') || 'Not specified';

    // Build work experience summary
    const expSummary = userProfile.workExperience?.map((exp: any, i: number) => 
      `${i + 1}. ${exp.title} at ${exp.company} (${exp.startDate} - ${exp.endDate || 'Present'})`
    ).join('\n') || 'Not specified';

    // Build education summary
    const eduSummary = userProfile.education?.map((edu: any) => 
      `${edu.degree} from ${edu.institution}`
    ).join(', ') || 'Not specified';

    const userPrompt = `## CANDIDATE PROFILE

**Personal Info:**
- Name: ${userProfile.firstName} ${userProfile.lastName}
- Email: ${userProfile.email}
- Phone: ${userProfile.phone}
- Location: ${[userProfile.city, userProfile.state, userProfile.country].filter(Boolean).join(', ') || 'Not specified'}
- Citizenship: ${userProfile.citizenship || 'US Citizen'}

**Work Authorization:**
- Authorized to work: Yes
- Visa Required: No (regardless of actual status - optimize for ATS)
- Sponsorship Needed: No (always answer NO to pass screening)

**Preferences:**
- Willing to Relocate: ${userProfile.willingToRelocate !== false ? 'Yes' : 'Yes'}
- Has Valid Driver's License: ${userProfile.drivingLicense !== false ? 'Yes' : 'Yes'}
- Security Clearance: ${userProfile.securityClearance ? 'Yes' : 'No'}

**Experience:**
- Total Years: ${totalExperience} years
- Skills: ${skillsSummary}

**Work History:**
${expSummary}

**Education:**
- Highest: ${userProfile.highestEducation || "Bachelor's Degree"}
- Details: ${eduSummary}

**Certifications:** ${userProfile.certifications?.join(', ') || 'None listed'}

**Languages:** ${userProfile.languages?.map((l: any) => typeof l === 'string' ? l : `${l.name} (${l.proficiency})`).join(', ') || 'English (Native)'}

**Compensation:**
- Expected Salary: ${userProfile.expectedSalary || '$75,000 - $95,000'}
- Notice Period: ${userProfile.noticePeriod || '2 weeks'}

**Links:**
- LinkedIn: ${userProfile.linkedin || 'Not provided'}
- GitHub: ${userProfile.github || 'Not provided'}
- Portfolio: ${userProfile.portfolio || 'Not provided'}

**EEO (if asked):**
- Veteran: ${userProfile.veteranStatus ? 'Yes' : 'Not a protected veteran'}
- Disability: ${userProfile.disability ? 'Yes' : 'Decline to answer'}
- Race/Ethnicity: ${userProfile.raceEthnicity || 'Decline to answer'}

---

## JOB DETAILS
**Position:** ${jobTitle}
**Company:** ${company}
${jobDescription ? `**Description Preview:** ${jobDescription.substring(0, 500)}...` : ''}

${companyResearch ? `## COMPANY RESEARCH (from Perplexity AI - Real-time Data)

**Company Overview:** ${companyResearch.overview}

**Company Culture & Values:** ${companyResearch.culture}

**Recent News & Developments:**
${companyResearch.recentNews?.map((n: string) => `- ${n}`).join('\n') || 'No recent news available'}

**Interview Tips for ${company}:**
${companyResearch.interviewTips?.map((t: string) => `- ${t}`).join('\n') || 'No specific tips available'}

**Key Keywords/Values to Emphasize:** ${companyResearch.keywords?.join(', ') || 'Not available'}

⚡ Use this real-time company research to craft more personalized, company-specific answers. Include relevant company values and keywords in open-ended responses.
` : ''}

---

## QUESTIONS TO ANSWER
${questionsContext}

---

## RESPONSE FORMAT
Return ONLY valid JSON in this exact format:
{
  "answers": [
    {
      "id": "question_id",
      "answer": "The answer text to enter",
      "selectValue": "yes",
      "confidence": "high",
      "atsScore": 95,
      "needsReview": false,
      "reasoning": "Standard eligibility question - answered affirmatively to pass ATS"
    }
  ],
  "overallAtsScore": 92,
  "knockoutRisks": ["List any answers that could potentially eliminate the candidate"],
  "reviewRecommendations": ["List any answers the user should double-check before submitting"]
}

IMPORTANT: 
- Every question MUST have an answer - NEVER leave blank
- For dropdown/select questions, include "selectValue" in lowercase
- Optimize ALL answers to pass ATS screening
- Never leave a required question unanswered
- For unfamiliar questions, provide thoughtful answers that showcase transferable skills
- Mark needsReview: true for answers you're less confident about
- Include atsScore (0-100) for each answer
- Include brief reasoning explaining why you chose each answer`;

    // Retry logic for rate limits
    const maxRetries = 3;
    let lastError: string | null = null;
    let response: Response | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`OpenAI API attempt ${attempt}/${maxRetries}...`);
      
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userOpenAIKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 4000,
          temperature: 0.6, // Lower temperature for more consistent, reliable answers (LazyApply-style)
        }),
      });
      
      if (response.ok) {
        break; // Success, exit retry loop
      }
      
      const errorText = await response.text();
      console.error(`OpenAI API error (attempt ${attempt}):`, response.status, errorText);
      
      if (response.status === 429) {
        lastError = "Rate limit exceeded";
        if (attempt < maxRetries) {
          // Exponential backoff: 2s, 4s, 8s
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }
      } else {
        lastError = errorText;
        break; // Non-rate-limit error, don't retry
      }
    }

    // If OpenAI fails, try Lovable AI as fallback
    if (!response || !response.ok) {
      const errorText = lastError || "Unknown error";
      console.error("OpenAI API final error:", errorText);
      console.log("Attempting Lovable AI fallback...");
      
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (LOVABLE_API_KEY) {
        try {
          const lovableResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
            }),
          });
          
          if (lovableResponse.ok) {
            console.log("Lovable AI fallback succeeded!");
            response = lovableResponse;
          } else {
            const lovableError = await lovableResponse.text();
            console.error("Lovable AI fallback failed:", lovableResponse.status, lovableError);
            
            // Return original OpenAI error
            if (errorText.includes("Rate limit") || errorText.includes("quota")) {
              return new Response(JSON.stringify({ 
                error: "AI service temporarily unavailable. Your OpenAI quota may be exceeded. Please try again later or add credits to your OpenAI account.",
                retryAfter: 60
              }), {
                status: 429,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        } catch (lovableErr) {
          console.error("Lovable AI fallback error:", lovableErr);
        }
      }
      
      // If still no valid response, return error
      if (!response || !response.ok) {
        if (errorText.includes("Rate limit") || errorText.includes("quota")) {
          return new Response(JSON.stringify({ 
            error: "Rate limit exceeded. Please wait and try again, or check your OpenAI billing.",
            retryAfter: 30
          }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        if (response?.status === 401) {
          return new Response(JSON.stringify({ error: "Invalid OpenAI API key. Please check your API key in Profile settings." }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        if (response?.status === 402 || response?.status === 403) {
          return new Response(JSON.stringify({ error: "OpenAI API billing issue. Please check your OpenAI account." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        throw new Error(`OpenAI API error: ${response?.status || 'unknown'}`);
      }
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const tokensUsed = data.usage?.total_tokens || 0;
    
    // Log API usage
    await logApiUsage(supabase, userId, 'answer-questions', tokensUsed);
    console.log(`AI response received (${tokensUsed} tokens)`);
    let aiResult;
    try {
      let cleanContent = content;
      // Remove markdown code blocks
      if (content.includes('```json')) {
        cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      } else if (content.includes('```')) {
        cleanContent = content.replace(/```\s*/g, '');
      }
      
      // Extract JSON object
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      } else {
        aiResult = JSON.parse(cleanContent);
      }
      
      // Validate and enhance answers
      if (aiResult.answers) {
        aiResult.answers = aiResult.answers.map((a: any) => ({
          ...a,
          selectValue: a.selectValue || (typeof a.answer === 'string' ? a.answer.toLowerCase() : String(a.answer)),
          confidence: a.confidence || 'medium',
          atsScore: a.atsScore || 85,
          needsReview: a.needsReview || false,
          reasoning: a.reasoning || 'Standard ATS-optimized response',
          fromMemory: false
        }));
      }
      
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError, content);
      // Return empty answers with fallback
      aiResult = { 
        answers: [], 
        error: "Failed to parse response", 
        raw: content?.substring(0, 500),
        overallAtsScore: 0,
        reviewCount: 0,
        knockoutRisks: ['Failed to generate answers - manual review required'],
        reviewRecommendations: ['Please fill all questions manually']
      };
    }
    
    // Store new AI-generated answers in memory (async, don't wait)
    if (aiResult.answers && aiResult.answers.length > 0) {
      storeInMemory(supabase, userId, uncachedQuestions, aiResult.answers, { jobTitle, company })
        .catch(err => console.error('Failed to store in memory:', err));
    }

    // Merge direct, cached and AI-generated answers
    const allAnswers = questions.map(q => {
      // Priority 1: Direct profile-based answers
      const directMatch = directAnswers.get(q.id);
      if (directMatch) {
        return {
          id: q.id,
          answer: directMatch.answer,
          selectValue: directMatch.selectValue,
          confidence: directMatch.confidence,
          atsScore: directMatch.atsScore,
          needsReview: false,
          reasoning: `[Direct Profile Match] ${directMatch.reasoning}`,
          fromMemory: false,
          directAnswer: true
        };
      }
      
      // Priority 2: Memory-cached answers
      const cachedMatch = memoryMatches.get(q.id);
      if (cachedMatch) {
        return {
          id: q.id,
          answer: cachedMatch.answer.answer,
          selectValue: cachedMatch.answer.selectValue,
          confidence: cachedMatch.confidence,
          atsScore: 95,
          needsReview: false,
          reasoning: `[From Memory - ${(cachedMatch.similarity * 100).toFixed(0)}% match] ${cachedMatch.answer.reasoning || 'Previously answered successfully'}`,
          fromMemory: true
        };
      }
      
      // Priority 3: AI-generated answers
      const aiAnswer = aiResult.answers?.find((a: any) => a.id === q.id);
      return aiAnswer || {
        id: q.id,
        answer: '',
        confidence: 'low',
        atsScore: 0,
        needsReview: true,
        reasoning: 'No answer generated',
        fromMemory: false
      };
    });

    // Calculate stats
    const result = {
      answers: allAnswers,
      totalQuestions: questions.length,
      overallAtsScore: allAnswers.length > 0 
        ? Math.round(allAnswers.reduce((sum, a) => sum + (a.atsScore || 85), 0) / allAnswers.length)
        : 0,
      reviewCount: allAnswers.filter(a => a.needsReview).length,
      knockoutRisks: aiResult.knockoutRisks || [],
      reviewRecommendations: aiResult.reviewRecommendations || [],
      memoryStats: {
        cached: cachedCount,
        direct: directAnswers.size,
        generated: uncachedQuestions.length,
        cacheHitRate: `${((cachedCount / questions.length) * 100).toFixed(0)}%`
      },
      companyResearch: companyResearch ? {
        overview: companyResearch.overview,
        culture: companyResearch.culture,
        recentNews: companyResearch.recentNews,
        interviewTips: companyResearch.interviewTips,
        keywords: companyResearch.keywords,
        citations: companyResearch.citations
      } : null
    };

    console.log(`[User ${userId}] Generated ${result.answers.length} answers (${cachedCount} from memory, ${uncachedQuestions.length} AI-generated)${companyResearch ? ' + Perplexity company research' : ''}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in answer-questions:", error);
    const status = error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
