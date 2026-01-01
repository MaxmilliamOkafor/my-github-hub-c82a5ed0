import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation limits
const MAX_KEYWORDS_LENGTH = 2000;
const MAX_OFFSET = 10000;
const MAX_LIMIT = 200;

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

// ATS Platform priority tiers
const PLATFORM_TIERS = {
  tier1: ['Workday', 'Greenhouse', 'Workable', 'SAP SuccessFactors', 'iCIMS', 'LinkedIn (Direct)'],
  tier2: ['Oracle Taleo', 'BambooHR', 'Bullhorn'],
  tier3: ['JazzHR', 'Jobvite', 'SmartRecruiters', 'Recruitee', 'Breezy HR'],
};

// Tier-1 companies with their Greenhouse board tokens
const GREENHOUSE_COMPANIES: { name: string; token: string }[] = [
  { name: 'Stripe', token: 'stripe' },
  { name: 'Airbnb', token: 'airbnb' },
  { name: 'Figma', token: 'figma' },
  { name: 'Notion', token: 'notion' },
  { name: 'Discord', token: 'discord' },
  { name: 'Coinbase', token: 'coinbase' },
  { name: 'Cloudflare', token: 'cloudflare' },
  { name: 'Databricks', token: 'databricks' },
  { name: 'Plaid', token: 'plaid' },
  { name: 'Ramp', token: 'ramp' },
  { name: 'Brex', token: 'brex' },
  { name: 'Gusto', token: 'gusto' },
  { name: 'Flexport', token: 'flexport' },
  { name: 'Nuro', token: 'nuro' },
  { name: 'Scale AI', token: 'scaleai' },
  { name: 'Anduril', token: 'andurilindustries' },
  { name: 'Rippling', token: 'rippling' },
  { name: 'Airtable', token: 'airtable' },
  { name: 'Webflow', token: 'webflow' },
  { name: 'Linear', token: 'linear' },
  { name: 'Vercel', token: 'vercel' },
  { name: 'Retool', token: 'retool' },
  { name: 'Mercury', token: 'mercury' },
  { name: 'Deel', token: 'deel' },
  { name: 'OpenSea', token: 'opensea' },
  { name: 'Instacart', token: 'instacart' },
  { name: 'DoorDash', token: 'doordash' },
  { name: 'Lyft', token: 'lyft' },
  { name: 'Pinterest', token: 'pinterest' },
  { name: 'Snap', token: 'snapchat' },
  { name: 'Dropbox', token: 'dropbox' },
  { name: 'Twitch', token: 'twitch' },
  { name: 'Reddit', token: 'reddit' },
  { name: 'Affirm', token: 'affirm' },
  { name: 'Robinhood', token: 'robinhood' },
  { name: 'Chime', token: 'chime' },
  { name: 'SoFi', token: 'sofi' },
  { name: 'Faire', token: 'faire' },
  { name: 'Canva', token: 'canva' },
  { name: 'HashiCorp', token: 'hashicorp' },
  { name: 'GitLab', token: 'gitlab' },
  { name: 'Elastic', token: 'elastic' },
  { name: 'MongoDB', token: 'mongodb' },
  { name: 'Snowflake', token: 'snowflake' },
];

// Workable companies
const WORKABLE_COMPANIES: { name: string; subdomain: string }[] = [
  { name: 'Revolut', subdomain: 'revolut' },
  { name: 'N26', subdomain: 'n26' },
  { name: 'Monzo', subdomain: 'monzo' },
  { name: 'Wise', subdomain: 'transferwise' },
  { name: 'Klarna', subdomain: 'klarna' },
];

interface JobListing {
  title: string;
  company: string;
  location: string;
  salary: string | null;
  description: string;
  requirements: string[];
  platform: string;
  url: string;
  posted_date: string;
  match_score: number;
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

// Fetch jobs from Greenhouse public API - uses absolute_url for direct job links
async function fetchGreenhouseJobs(company: { name: string; token: string }): Promise<JobListing[]> {
  try {
    const response = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${company.token}/jobs?content=true`,
      { headers: { 'Accept': 'application/json' } }
    );
    
    if (!response.ok) {
      console.log(`Greenhouse ${company.name}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const jobs: JobListing[] = (data.jobs || []).slice(0, 30).map((job: any) => {
      // Greenhouse API provides absolute_url which is the direct apply link
      const directUrl = job.absolute_url || `https://boards.greenhouse.io/${company.token}/jobs/${job.id}`;
      
      return {
        title: job.title || 'Unknown Position',
        company: company.name,
        location: job.location?.name || 'Remote',
        salary: null,
        description: job.content ? job.content.replace(/<[^>]*>/g, '').slice(0, 500) : '',
        requirements: extractRequirements(job.content || ''),
        platform: 'Greenhouse',
        url: directUrl,
        posted_date: job.updated_at || new Date().toISOString(),
        match_score: 0,
      };
    });
    
    console.log(`Greenhouse ${company.name}: fetched ${jobs.length} jobs`);
    return jobs;
  } catch (error) {
    console.error(`Greenhouse ${company.name} error:`, error);
    return [];
  }
}

// Fetch jobs from Workable public API - uses shortcode for direct job apply links
async function fetchWorkableJobs(company: { name: string; subdomain: string }): Promise<JobListing[]> {
  try {
    const response = await fetch(
      `https://apply.workable.com/api/v3/accounts/${company.subdomain}/jobs`,
      { headers: { 'Accept': 'application/json' } }
    );
    
    if (!response.ok) {
      console.log(`Workable ${company.name}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const jobs: JobListing[] = (data.results || []).slice(0, 30).map((job: any) => {
      // Workable direct apply URL format uses shortcode
      const directUrl = `https://apply.workable.com/${company.subdomain}/j/${job.shortcode}/`;
      
      return {
        title: job.title || 'Unknown Position',
        company: company.name,
        location: job.location?.city || job.location?.country || 'Remote',
        salary: null,
        description: job.description || '',
        requirements: extractRequirements(job.description || ''),
        platform: 'Workable',
        url: directUrl,
        posted_date: job.published || new Date().toISOString(),
        match_score: 0,
      };
    });
    
    console.log(`Workable ${company.name}: fetched ${jobs.length} jobs`);
    return jobs;
  } catch (error) {
    console.error(`Workable ${company.name} error:`, error);
    return [];
  }
}

// Extract requirements from job description
function extractRequirements(content: string): string[] {
  const techKeywords = [
    'Python', 'Java', 'TypeScript', 'JavaScript', 'React', 'Node.js', 'AWS', 'GCP', 'Azure',
    'Kubernetes', 'Docker', 'PostgreSQL', 'MongoDB', 'Redis', 'Kafka', 'GraphQL',
    'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Go', 'Rust', 'C++',
    'SQL', 'NoSQL', 'REST API', 'Microservices', 'CI/CD', 'Terraform', 'Linux'
  ];
  
  const found = techKeywords.filter(kw => 
    content.toLowerCase().includes(kw.toLowerCase())
  );
  
  return found.slice(0, 6);
}

// Calculate match score
function calculateMatchScore(job: JobListing, keywords: string[]): number {
  let score = 50;
  const jobText = `${job.title} ${job.description} ${job.requirements.join(' ')}`.toLowerCase();
  
  for (const keyword of keywords) {
    if (keyword && jobText.includes(keyword.toLowerCase())) {
      score += 5;
    }
  }
  
  if (PLATFORM_TIERS.tier1.includes(job.platform)) {
    score += 10;
  } else if (PLATFORM_TIERS.tier2.includes(job.platform)) {
    score += 5;
  }
  
  return Math.min(100, score);
}

// Parse comma-separated keywords
function parseKeywords(keywordString: string): string[] {
  return (keywordString || '')
    .replace(/["""]/g, '')
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0)
    .filter((k, i, arr) => arr.indexOf(k) === i)
    .slice(0, 50); // Limit to 50 keywords
}

// Validate that a job URL is a direct job link (not a general careers page)
function isValidDirectJobUrl(url: string): boolean {
  if (!url) return false;
  
  // Greenhouse - MUST have /jobs/{numeric_id} pattern
  if (url.includes('greenhouse.io')) {
    return /\/jobs\/\d+/.test(url);
  }
  
  // Workable - MUST have /j/{shortcode}/ pattern (NOT /company-name/ alone)
  if (url.includes('workable.com')) {
    return /\/j\/[a-zA-Z0-9]+\/?/.test(url);
  }
  
  return false;
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
    const offset = validateNumber(rawData.offset, 0, MAX_OFFSET, 0);
    const limit = validateNumber(rawData.limit, 1, MAX_LIMIT, 100);
    
    console.log(`Scraping jobs with keywords: ${keywords.substring(0, 100)}..., offset: ${offset}, limit: ${limit} for user ${user_id}`);
    
    const parsedKeywords = parseKeywords(keywords);
    let allJobs: JobListing[] = [];
    
    // Fetch from ALL companies - no artificial limits
    const greenhousePromises = GREENHOUSE_COMPANIES.map(c => fetchGreenhouseJobs(c));
    const workablePromises = WORKABLE_COMPANIES.map(c => fetchWorkableJobs(c));
    
    const [greenhouseResults, workableResults] = await Promise.all([
      Promise.allSettled(greenhousePromises),
      Promise.allSettled(workablePromises),
    ]);
    
    // Collect real jobs
    for (const result of greenhouseResults) {
      if (result.status === 'fulfilled') {
        allJobs.push(...result.value);
      }
    }
    for (const result of workableResults) {
      if (result.status === 'fulfilled') {
        allJobs.push(...result.value);
      }
    }
    
    console.log(`Fetched ${allJobs.length} real jobs from APIs`);
    
    // Filter out jobs with invalid URLs (career pages instead of direct job links)
    const validJobs = allJobs.filter(job => isValidDirectJobUrl(job.url));
    console.log(`${validJobs.length} jobs have valid direct apply URLs`);
    
    // Calculate match scores
    for (const job of validJobs) {
      job.match_score = calculateMatchScore(job, parsedKeywords);
    }
    
    // Sort by platform tier then match score
    validJobs.sort((a, b) => {
      const tierA = PLATFORM_TIERS.tier1.includes(a.platform) ? 0 : PLATFORM_TIERS.tier2.includes(a.platform) ? 1 : 2;
      const tierB = PLATFORM_TIERS.tier1.includes(b.platform) ? 0 : PLATFORM_TIERS.tier2.includes(b.platform) ? 1 : 2;
      if (tierA !== tierB) return tierA - tierB;
      return b.match_score - a.match_score;
    });
    
    // Slice for pagination
    const paginatedJobs = validJobs.slice(offset, offset + limit);
    
    // Save to database
    if (paginatedJobs.length > 0) {
      const jobsToInsert = paginatedJobs.map(job => ({
        user_id,
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
        description: job.description,
        requirements: job.requirements,
        platform: job.platform,
        url: job.url,
        posted_date: job.posted_date,
        match_score: job.match_score,
        status: 'pending',
      }));
      
      const { error } = await supabase.from('jobs').insert(jobsToInsert);
      
      if (error) {
        console.error('Error inserting jobs:', error);
      } else {
        console.log(`Inserted ${paginatedJobs.length} jobs for user ${user_id}`);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        jobs: paginatedJobs,
        hasMore: offset + limit < validJobs.length,
        nextOffset: offset + limit,
        totalValidJobs: validJobs.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scrape-jobs:', error);
    const status = error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500;
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
