import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation limits
const MAX_KEYWORDS_LENGTH = 2000;
const MAX_LOCATIONS_LENGTH = 1000;
const MAX_LIMIT = 500;

// Validate string input
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

// Validate number input
function validateNumber(value: any, min: number, max: number, defaultValue: number): number {
  const num = parseInt(value, 10);
  if (isNaN(num)) return defaultValue;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

// Target locations for filtering
const TARGET_LOCATIONS = [
  "Dublin", "Ireland", "United Kingdom", "United States", "Remote",
  "Germany", "Netherlands", "France", "Switzerland", "Spain",
  "Singapore", "Australia", "Canada", "EMEA", "Europe"
];

// Top 15 Greenhouse companies (reduced for CPU limits)
const GREENHOUSE_COMPANIES = [
  { name: 'Stripe', token: 'stripe' },
  { name: 'Figma', token: 'figma' },
  { name: 'Notion', token: 'notion' },
  { name: 'Coinbase', token: 'coinbase' },
  { name: 'Databricks', token: 'databricks' },
  { name: 'Plaid', token: 'plaid' },
  { name: 'Rippling', token: 'rippling' },
  { name: 'Vercel', token: 'vercel' },
  { name: 'Linear', token: 'linear' },
  { name: 'Mercury', token: 'mercury' },
  { name: 'Deel', token: 'deel' },
  { name: 'Revolut', token: 'revolut' },
  { name: 'Canva', token: 'canva' },
  { name: 'Datadog', token: 'datadog' },
  { name: 'MongoDB', token: 'mongodb' },
];

interface LiveJob {
  id: string;
  title: string;
  company: string;
  location: string;
  updated_at: string;
  absolute_url: string;
  description_snippet: string;
  source: string;
  keywords_matched: string[];
  score: number;
  salary: string | null;
  requirements: string[];
}

// Helper function to verify JWT and extract user ID
async function verifyAndGetUserId(req: Request, supabase: any): Promise<string> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Unauthorized: Invalid or expired token');
  }
  
  return user.id;
}

// Fetch with timeout
async function fetchWithTimeout(url: string, timeout = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Fetch from Greenhouse API (simplified for speed)
async function fetchGreenhouseJobs(company: { name: string; token: string }): Promise<LiveJob[]> {
  try {
    const response = await fetchWithTimeout(
      `https://boards-api.greenhouse.io/v1/boards/${company.token}/jobs`,
      4000
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    
    // Only take first 20 jobs per company for speed
    const jobs: LiveJob[] = (data.jobs || []).slice(0, 20).map((job: any) => {
      const locationName = job.location?.name || 'Remote';
      
      return {
        id: `gh_${company.token}_${job.id}`,
        title: job.title || 'Unknown Position',
        company: company.name,
        location: locationName,
        updated_at: job.updated_at || new Date().toISOString(),
        absolute_url: job.absolute_url || `https://boards.greenhouse.io/${company.token}/jobs/${job.id}`,
        description_snippet: '',
        source: 'greenhouse',
        keywords_matched: [],
        score: 0,
        salary: null,
        requirements: [],
      };
    });
    
    return jobs;
  } catch (error) {
    console.error(`GH ${company.name}: timeout/error`);
    return [];
  }
}

// Calculate job score
function calculateScore(job: LiveJob, keywords: string[], locations: string[]): number {
  let score = 50;
  const jobText = `${job.title} ${job.company}`.toLowerCase();
  const jobLoc = job.location.toLowerCase();
  
  // Keyword matches
  for (const kw of keywords) {
    if (kw && jobText.includes(kw.toLowerCase())) {
      job.keywords_matched.push(kw);
      score += 5;
    }
  }
  
  // Location matches
  for (const loc of locations) {
    if (jobLoc.includes(loc.toLowerCase())) {
      score += 10;
      break;
    }
  }
  
  // Remote bonus
  if (jobLoc.includes('remote')) score += 15;
  
  return Math.min(100, score);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify JWT and get authenticated user ID
    const user_id = await verifyAndGetUserId(req, supabase);
    
    // Parse and validate request
    const rawData = await req.json();
    const keywords = validateString(rawData.keywords || '', MAX_KEYWORDS_LENGTH, 'keywords');
    const locations = validateString(rawData.locations || '', MAX_LOCATIONS_LENGTH, 'locations');
    const limit = validateNumber(rawData.limit, 1, MAX_LIMIT, 100);
    const hoursFilter = parseFloat(rawData.hours) || 0; // Support fractional hours (e.g., 0.5 for 30 min)
    
    console.log(`Live jobs fetch - ${GREENHOUSE_COMPANIES.length} companies for user ${user_id}, filter: ${hoursFilter}h`);
    
    const keywordList = keywords.split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k).slice(0, 30);
    const locationList = locations.split(',').map((l: string) => l.trim().toLowerCase()).filter((l: string) => l).slice(0, 20);
    
    // Calculate cutoff time for filtering
    const cutoffTime = hoursFilter > 0 
      ? new Date(Date.now() - hoursFilter * 60 * 60 * 1000)
      : null;
    
    // Fetch in batches of 5 to avoid CPU limits
    const allJobs: LiveJob[] = [];
    const batchSize = 5;
    
    for (let i = 0; i < GREENHOUSE_COMPANIES.length; i += batchSize) {
      const batch = GREENHOUSE_COMPANIES.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(c => fetchGreenhouseJobs(c)));
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allJobs.push(...result.value);
        }
      }
    }
    
    console.log(`Fetched ${allJobs.length} jobs`);
    
    // Deduplicate by URL
    const seenUrls = new Set<string>();
    const uniqueJobs = allJobs.filter(job => {
      if (seenUrls.has(job.absolute_url)) return false;
      seenUrls.add(job.absolute_url);
      return true;
    });
    
    // Filter by time if specified
    let filteredJobs = uniqueJobs;
    if (cutoffTime) {
      filteredJobs = uniqueJobs.filter(job => {
        const jobDate = new Date(job.updated_at);
        return jobDate >= cutoffTime;
      });
      console.log(`Filtered to ${filteredJobs.length} jobs within ${hoursFilter}h`);
    }
    
    // Score jobs
    for (const job of filteredJobs) {
      job.score = calculateScore(job, keywordList, locationList);
    }
    
    // Sort by recency first, then by score (prioritize recently added)
    filteredJobs.sort((a, b) => {
      const dateA = new Date(a.updated_at).getTime();
      const dateB = new Date(b.updated_at).getTime();
      // Primary sort: most recent first
      if (dateB !== dateA) return dateB - dateA;
      // Secondary sort: higher score
      return b.score - a.score;
    });
    
    const topJobs = filteredJobs.slice(0, limit);
    
    // Save to database
    if (topJobs.length > 0) {
      // Get existing URLs
      const { data: existingJobs } = await supabase
        .from('jobs')
        .select('url')
        .eq('user_id', user_id);
      
      const existingUrls = new Set((existingJobs || []).map(j => j.url));
      const newJobs = topJobs.filter(j => !existingUrls.has(j.absolute_url));
      
      if (newJobs.length > 0) {
        const jobsToInsert = newJobs.slice(0, 50).map(job => ({
          user_id,
          title: job.title,
          company: job.company,
          location: job.location,
          salary: job.salary,
          description: job.description_snippet,
          requirements: job.requirements,
          platform: 'Greenhouse',
          url: job.absolute_url,
          posted_date: job.updated_at,
          match_score: Math.round(job.score),
          status: 'pending',
        }));
        
        await supabase.from('jobs').insert(jobsToInsert);
        console.log(`Inserted ${newJobs.length} new jobs`);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        jobs: topJobs,
        totalFetched: allJobs.length,
        totalFiltered: filteredJobs.length,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Live jobs error:', error);
    const status = error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500;
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
