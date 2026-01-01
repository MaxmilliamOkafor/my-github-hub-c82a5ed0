import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_KEYWORDS_LENGTH = 3000;
const MAX_LOCATION_LENGTH = 500;

function validateString(value: any, maxLength: number): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.substring(0, maxLength) : trimmed;
}

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

// ATS Platform Configurations - UPDATED: Removed Ashby and Lever, renamed Direct
const ATS_PLATFORMS = {
  greenhouse: {
    name: 'Greenhouse',
    sitePatterns: ['site:greenhouse.io', 'site:boards.greenhouse.io'],
    urlPattern: /greenhouse\.io/,
    jobIdPattern: /\/jobs\/\d+/,
  },
  workday: {
    name: 'Workday',
    sitePatterns: ['site:myworkdayjobs.com', 'site:*.wd5.myworkdayjobs.com'],
    urlPattern: /myworkdayjobs\.com/,
    jobIdPattern: /\/job\//,
  },
  smartrecruiters: {
    name: 'SmartRecruiters',
    sitePatterns: ['site:jobs.smartrecruiters.com', 'site:smartrecruiters.com'],
    urlPattern: /smartrecruiters\.com/,
    jobIdPattern: /\/\d+/,
  },
  direct: {
    name: 'Company Website (LinkedIn and Indeed)',
    sitePatterns: [
      'site:linkedin.com/jobs/view -"Easy Apply"',
      'site:indeed.com/viewjob -"easily apply"',
      'site:indeed.com/job -"easily apply"',
    ],
    urlPattern: /linkedin\.com\/jobs\/view|indeed\.com\/(viewjob|job)/,
    jobIdPattern: /\/(view|viewjob|job)\//,
  },
  bullhorn: {
    name: 'Bullhorn',
    sitePatterns: ['site:bullhornstaffing.com', 'site:*.bullhorn.com'],
    urlPattern: /bullhorn/i,
    jobIdPattern: /\/job\//,
  },
  teamtailor: {
    name: 'Teamtailor',
    sitePatterns: ['site:teamtailor.com/jobs', 'site:*.teamtailor.com'],
    urlPattern: /teamtailor\.com/,
    jobIdPattern: /\/jobs\//,
  },
  workable: {
    name: 'Workable',
    sitePatterns: ['site:jobs.workable.com', 'site:apply.workable.com'],
    urlPattern: /workable\.com/,
    jobIdPattern: /\/j\/[a-zA-Z0-9]+/,
  },
  icims: {
    name: 'ICIMS',
    sitePatterns: ['site:icims.com', 'site:careers-*.icims.com'],
    urlPattern: /icims\.com/,
    jobIdPattern: /\/jobs\/\d+/,
  },
  oraclecloud: {
    name: 'Oracle Cloud',
    sitePatterns: ['site:oraclecloud.com/hcmUI/CandidateExperience', 'site:*.fa.*.oraclecloud.com'],
    urlPattern: /oraclecloud\.com.*CandidateExperience/,
    jobIdPattern: /requisition|job/i,
  },
};

// Career page patterns for direct company sites
const CAREER_PAGE_PATTERNS = [
  'site:*/careers/*',
  'site:*/jobs/*',
  'site:*/employment/*',
  'site:*/opportunities/*',
  'site:*/openings/*',
  'site:*/join-us/*',
  'site:*/work-with-us/*',
  'site:*/join-our-team/*',
  'site:*/vacancies/*',
];

// Tier-1 companies for scoring boost
const TIER1_COMPANIES = [
  'google', 'meta', 'apple', 'amazon', 'microsoft', 'netflix', 'stripe', 'airbnb',
  'uber', 'lyft', 'dropbox', 'salesforce', 'adobe', 'linkedin', 'twitter', 'snap',
  'shopify', 'square', 'paypal', 'coinbase', 'robinhood', 'plaid', 'figma', 'notion',
  'slack', 'zoom', 'datadog', 'snowflake', 'databricks', 'mongodb', 'openai', 'anthropic',
  'crowdstrike', 'zillow', 'doordash', 'instacart', 'pinterest', 'reddit', 'discord',
  'spotify', 'nvidia', 'oracle', 'cisco', 'ibm', 'intel', 'amd', 'qualcomm', 'tesla',
];

// Time filter mappings for Google search
const TIME_FILTER_MAP: Record<string, string> = {
  '10min': 'qdr:n10',
  '30min': 'qdr:n30',
  '1h': 'qdr:h',
  '2h': 'qdr:h2',
  '6h': 'qdr:h6',
  'today': 'qdr:d',
  'week': 'qdr:w',
  'all': '',
};

async function verifyAndGetUserId(req: Request, supabase: any): Promise<string> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) throw new Error('Missing authorization header');
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) throw new Error('Unauthorized: Invalid or expired token');
  return user.id;
}

function getPlatformFromUrl(url: string): string {
  for (const [key, platform] of Object.entries(ATS_PLATFORMS)) {
    if (platform.urlPattern.test(url)) return platform.name;
  }
  if (url.match(/\/(?:careers|jobs|employment|opportunities)\//)) return 'Career Page';
  return 'Other';
}

function extractCompanyFromUrl(url: string): string {
  try {
    // Workday pattern - extract company name from subdomain: company.wd5.myworkdayjobs.com
    const workdayMatch = url.match(/https?:\/\/([^\.]+)\.wd\d+\.myworkdayjobs\.com/i);
    if (workdayMatch && workdayMatch[1]) {
      return formatCompanyName(workdayMatch[1]);
    }
    
    // ICIMS pattern - extract from careers-company.icims.com
    const icimsMatch = url.match(/https?:\/\/careers-?([^\.]+)\.icims\.com/i);
    if (icimsMatch && icimsMatch[1]) {
      return formatCompanyName(icimsMatch[1]);
    }
    
    // Greenhouse pattern
    const greenhouseMatch = url.match(/boards\.greenhouse\.io\/([^\/]+)/);
    if (greenhouseMatch && greenhouseMatch[1]) {
      return formatCompanyName(greenhouseMatch[1]);
    }
    
    // Workable pattern
    const workableMatch = url.match(/(?:apply|jobs)\.workable\.com\/([^\/]+)/);
    if (workableMatch && workableMatch[1]) {
      return formatCompanyName(workableMatch[1]);
    }
    
    // Teamtailor pattern
    const teamtailorMatch = url.match(/([^\.]+)\.teamtailor\.com/);
    if (teamtailorMatch && teamtailorMatch[1]) {
      return formatCompanyName(teamtailorMatch[1]);
    }
    
    // SmartRecruiters pattern
    const smartMatch = url.match(/jobs\.smartrecruiters\.com\/([^\/]+)/);
    if (smartMatch && smartMatch[1]) {
      return formatCompanyName(smartMatch[1]);
    }
    
    // LinkedIn pattern
    const linkedinMatch = url.match(/linkedin\.com\/jobs\/view\/.*at-([^?\/]+)/);
    if (linkedinMatch && linkedinMatch[1]) {
      return formatCompanyName(linkedinMatch[1]);
    }
    
    // Indeed pattern
    const indeedMatch = url.match(/indeed\.com\/.*company\/([^?\/]+)/);
    if (indeedMatch && indeedMatch[1]) {
      return formatCompanyName(indeedMatch[1]);
    }
    
    // Generic career page patterns
    const careerMatch = url.match(/https?:\/\/(?:careers|jobs)\.([^\.\/]+)\./);
    if (careerMatch && careerMatch[1]) {
      return formatCompanyName(careerMatch[1]);
    }
    
    // Oracle Cloud pattern
    const oracleMatch = url.match(/https?:\/\/([^\.]+)\.fa\./);
    if (oracleMatch && oracleMatch[1]) {
      return formatCompanyName(oracleMatch[1]);
    }
    
  } catch (e) {}
  return 'Unknown Company';
}

function formatCompanyName(name: string): string {
  return name
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Validates that a URL points to a SPECIFIC job listing, not a careers/company page
function isValidJobUrl(url: string): boolean {
  if (!url) return false;
  
  // Greenhouse - MUST have /jobs/{id} pattern for direct job link
  if (url.includes('greenhouse.io')) {
    return /\/jobs\/\d+/.test(url);
  }
  
  // Workable - MUST have /j/{shortcode}/ pattern for direct job link
  // Reject URLs like apply.workable.com/company-name/ (company careers page)
  if (url.includes('workable.com')) {
    return /\/j\/[a-zA-Z0-9]+\/?/.test(url);
  }
  
  // Workday - MUST have /job/ in the path
  if (url.includes('myworkdayjobs.com')) {
    return /\/job\//.test(url);
  }
  
  // SmartRecruiters - MUST have job ID in path
  if (url.includes('smartrecruiters.com')) {
    return /\/jobs\/\d+/.test(url) || /\/[a-zA-Z0-9-]+\/\d+/.test(url);
  }
  
  // LinkedIn - MUST have /jobs/view/{id} pattern
  if (url.includes('linkedin.com')) {
    return /\/jobs\/view\/\d+/.test(url);
  }
  
  // Indeed - MUST have /viewjob or /job/ with job key
  if (url.includes('indeed.com')) {
    return /\/(viewjob|job)\//.test(url) && /jk=|viewjob\?/.test(url);
  }
  
  // ICIMS - MUST have /jobs/{id} pattern
  if (url.includes('icims.com')) {
    return /\/jobs\/\d+/.test(url);
  }
  
  // Teamtailor - MUST have /jobs/{id} or specific job slug
  if (url.includes('teamtailor.com')) {
    return /\/jobs\/\d+/.test(url) || /\/jobs\/[a-zA-Z0-9-]+-\d+/.test(url);
  }
  
  // Oracle Cloud - MUST have requisition ID
  if (url.includes('oraclecloud.com')) {
    return /requisitionId=\d+/.test(url) || /\/job\/\d+/.test(url);
  }
  
  // Bullhorn - MUST have job ID
  if (url.match(/bullhorn/i)) {
    return /\/job\/\d+/.test(url);
  }
  
  // Direct career pages - MUST have a specific job identifier (not just /careers/ or /jobs/)
  // Require numeric ID or specific job slug pattern
  if (url.match(/\/(?:careers|jobs|employment|opportunities|openings)\//)) {
    // Must have a numeric ID or a specific slug after the path
    return /\/(?:careers|jobs|employment|opportunities|openings)\/[a-zA-Z0-9-]+\/\d+/.test(url) ||
           /\/(?:careers|jobs|employment|opportunities|openings)\/[a-zA-Z0-9]+-\d+/.test(url) ||
           /[\?&]id=\d+/.test(url);
  }
  
  return false;
}

function parseSearchResult(result: any, searchKeyword: string): JobListing | null {
  try {
    const url = result.url || result.link || '';
    const title = result.title || '';
    const description = result.description || result.snippet || result.content || '';
    
    if (!isValidJobUrl(url)) return null;
    
    // Skip Easy Apply jobs from LinkedIn/Indeed
    if (url.includes('linkedin.com') && title.toLowerCase().includes('easy apply')) return null;
    if (url.includes('indeed.com') && (title.toLowerCase().includes('easily apply') || description.toLowerCase().includes('easily apply'))) return null;
    
    const platform = getPlatformFromUrl(url);
    const company = extractCompanyFromUrl(url);
    
    let jobTitle = title
      .replace(/\s*[-|–|:]\s*.*$/, '')
      .replace(/Job Application for\s*/i, '')
      .replace(/at\s+\w+.*$/i, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/@\s*\w+/g, '')
      .trim();
    
    if (!jobTitle || jobTitle.length < 3) jobTitle = searchKeyword || 'Unknown Position';
    
    return {
      title: jobTitle,
      company,
      location: extractLocation(description) || 'Remote',
      salary: extractSalary(description),
      description: description.slice(0, 500),
      requirements: extractRequirements(description),
      platform,
      url,
      posted_date: new Date().toISOString(),
      match_score: 0,
    };
  } catch (error) {
    return null;
  }
}

function extractLocation(text: string): string | null {
  const patterns = [
    /(fully remote|100% remote|remote first|remote-first)/i,
    /(remote|hybrid|on-site|onsite)/i,
    /(San Francisco|New York|Seattle|Austin|Boston|Denver|Chicago|Los Angeles|Atlanta)/i,
    /(London|Dublin|Berlin|Amsterdam|Paris|Munich|Zurich|Stockholm|Madrid|Barcelona)/i,
    /(Singapore|Tokyo|Sydney|Melbourne|Toronto|Vancouver|Montreal)/i,
    /(United States|United Kingdom|Ireland|Germany|Europe|EMEA|APAC)/i,
    /(UAE|Dubai|Abu Dhabi|Qatar|Saudi Arabia)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractSalary(text: string): string | null {
  const patterns = [
    /\$\s*(\d{2,3}(?:,\d{3})*(?:\s*[-–]\s*\$?\s*\d{2,3}(?:,\d{3})*)?)/i,
    /(£\s*\d{2,3}(?:,\d{3})*(?:\s*[-–]\s*£?\s*\d{2,3}(?:,\d{3})*)?)/i,
    /(€\s*\d{2,3}(?:,\d{3})*(?:\s*[-–]\s*€?\s*\d{2,3}(?:,\d{3})*)?)/i,
    /(\d{2,3}k\s*[-–]\s*\d{2,3}k)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractRequirements(content: string): string[] {
  const techKeywords = [
    'Python', 'Java', 'TypeScript', 'JavaScript', 'React', 'Node.js', 'AWS', 'GCP', 'Azure',
    'Kubernetes', 'Docker', 'PostgreSQL', 'MongoDB', 'Machine Learning', 'TensorFlow', 'PyTorch',
    'SQL', 'GraphQL', 'REST API', 'Microservices', 'CI/CD', 'Terraform', 'Spark', 'Snowflake',
    'Kafka', 'Redis', 'Elasticsearch', 'Go', 'Rust', 'C++', 'Scala', 'Ruby', 'PHP',
  ];
  
  return techKeywords
    .filter(kw => content.toLowerCase().includes(kw.toLowerCase()))
    .slice(0, 8);
}

// Build efficient Boolean search queries - OPTIMIZED for speed
function buildBooleanQueries(
  keywords: string[], 
  locations: string[], 
  timeFilter: string,
  jobType: string,
  workType: string,
  experienceLevel: string
): string[] {
  const queries: string[] = [];
  
  // Build location OR string
  const locationOr = locations.length > 0 
    ? locations.map(l => `"${l}"`).join(' OR ')
    : '';
  
  // Build modifiers
  const modifiers = [
    workType && workType !== 'all' ? `"${workType}"` : '',
    jobType && jobType !== 'all' ? `"${jobType}"` : '',
    experienceLevel && experienceLevel !== 'all' ? `"${experienceLevel}"` : '',
  ].filter(Boolean).join(' ');
  
  // OPTIMIZATION: Batch keywords into groups of 4-5 for fewer queries
  const keywordBatches: string[][] = [];
  for (let i = 0; i < keywords.length; i += 5) {
    keywordBatches.push(keywords.slice(i, i + 5));
  }
  
  // OPTIMIZATION: Only use top 3 batches (15 keywords max effective)
  const effectiveBatches = keywordBatches.slice(0, 3);
  
  // HIGH-VALUE COMBINED PLATFORM QUERIES (most efficient)
  // Each query searches multiple platforms at once
  const platformCombos = [
    'site:greenhouse.io OR site:boards.greenhouse.io',
    'site:myworkdayjobs.com',
    'site:jobs.smartrecruiters.com OR site:smartrecruiters.com',
    'site:jobs.workable.com OR site:apply.workable.com',
    'site:linkedin.com/jobs/view -"Easy Apply"',
    'site:icims.com OR site:careers-*.icims.com',
    'site:teamtailor.com',
  ];
  
  for (const batch of effectiveBatches) {
    const keywordOr = batch.map(k => `"${k}"`).join(' OR ');
    
    for (const platformCombo of platformCombos) {
      let query = `(${keywordOr})`;
      if (locationOr) query += ` (${locationOr})`;
      if (modifiers) query += ` ${modifiers}`;
      query += ` (${platformCombo})`;
      queries.push(query);
    }
  }
  
  // Add ONE career page query per batch for direct company sites
  for (const batch of effectiveBatches.slice(0, 2)) {
    const keywordOr = batch.map(k => `"${k}"`).join(' OR ');
    let query = `(${keywordOr})`;
    if (locationOr) query += ` (${locationOr})`;
    if (modifiers) query += ` ${modifiers}`;
    query += ` (site:*/careers/* OR site:*/jobs/*)`;
    queries.push(query);
  }
  
  return queries;
}

async function searchWithFirecrawl(query: string, apiKey: string, limit = 50, timeFilter?: string): Promise<any[]> {
  try {
    console.log(`Searching: ${query.slice(0, 100)}...`);
    
    const searchBody: any = { 
      query, 
      limit,
    };
    
    // Add time-based search if specified
    if (timeFilter && TIME_FILTER_MAP[timeFilter]) {
      searchBody.tbs = TIME_FILTER_MAP[timeFilter];
    }
    
    // Add 10 second timeout per request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`Firecrawl error: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      return data.data || [];
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.log('Request timeout, skipping...');
      }
      return [];
    }
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

function getDedupeKey(job: JobListing): string {
  const normalizedTitle = job.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
  const normalizedCompany = job.company.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
  return `${normalizedTitle}-${normalizedCompany}`;
}

function isTier1Company(company: string): boolean {
  const normalized = company.toLowerCase().replace(/[^a-z0-9]/g, '');
  return TIER1_COMPANIES.some(t1 => normalized.includes(t1) || t1.includes(normalized));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const user_id = await verifyAndGetUserId(req, supabase);
    
    const rawData = await req.json();
    const keywordsRaw = validateString(rawData.keywords || '', MAX_KEYWORDS_LENGTH);
    const locationRaw = validateString(rawData.location || '', MAX_LOCATION_LENGTH);
    const timeFilter = validateString(rawData.timeFilter || 'all', 20);
    const jobType = validateString(rawData.jobType || 'all', 50);
    const workType = validateString(rawData.workType || 'all', 50);
    const experienceLevel = validateString(rawData.experienceLevel || 'all', 50);
    
    console.log(`Boolean job search for user ${user_id}`);
    console.log(`Keywords: ${keywordsRaw.slice(0, 100)}...`);
    console.log(`Locations: ${locationRaw}`);
    console.log(`Filters - Time: ${timeFilter}, Job Type: ${jobType}, Work Type: ${workType}, Experience: ${experienceLevel}`);
    
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      throw new Error('FIRECRAWL_API_KEY not configured');
    }
    
    // Parse keywords and locations - LIMIT to 15 keywords max for performance
    const keywords = keywordsRaw
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0)
      .slice(0, 15);
    
    const locations = locationRaw
      .split(',')
      .map(l => l.trim())
      .filter(l => l.length > 0 && l.toLowerCase() !== 'all')
      .slice(0, 5);
    
    const searchKeywords = keywords.length > 0 
      ? keywords 
      : ['Software Engineer', 'Data Scientist', 'Product Manager'];
    
    const searchLocations = locations.length > 0 
      ? locations 
      : [];
    
    // Build Boolean search queries with all filters
    const searchQueries = buildBooleanQueries(
      searchKeywords, 
      searchLocations, 
      timeFilter,
      jobType,
      workType,
      experienceLevel
    );
    console.log(`Generated ${searchQueries.length} Boolean search queries (optimized)`);
    
    const allJobs: JobListing[] = [];
    const seenUrls = new Set<string>();
    const dedupeKeys = new Set<string>();
    
    // OPTIMIZATION: 60 second timeout for entire search
    const searchStartTime = Date.now();
    const SEARCH_TIMEOUT_MS = 60000; // 60 seconds max
    
    // Run searches in parallel batches of 10 (faster)
    const batchSize = 10;
    for (let i = 0; i < searchQueries.length; i += batchSize) {
      // Check timeout
      if (Date.now() - searchStartTime > SEARCH_TIMEOUT_MS) {
        console.log(`Timeout reached after ${Math.floor((Date.now() - searchStartTime) / 1000)}s, returning ${allJobs.length} jobs`);
        break;
      }
      
      const batch = searchQueries.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (query) => {
        const results = await searchWithFirecrawl(query, FIRECRAWL_API_KEY, 50, timeFilter);
        return { results, keyword: searchKeywords[0] };
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      for (const { results, keyword } of batchResults) {
        for (const result of results) {
          const job = parseSearchResult(result, keyword);
          if (job && !seenUrls.has(job.url)) {
            const dedupeKey = getDedupeKey(job);
            if (!dedupeKeys.has(dedupeKey)) {
              seenUrls.add(job.url);
              dedupeKeys.add(dedupeKey);
              allJobs.push(job);
            }
          }
        }
      }
      
      console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${allJobs.length} unique jobs found`);
      
      // Stop early if we have enough jobs
      if (allJobs.length >= 300) {
        console.log('Reached 300 jobs limit, stopping search');
        break;
      }
    }
    
    console.log(`Total: ${allJobs.length} unique jobs across all ATS platforms`);
    
    // Calculate match scores
    for (const job of allJobs) {
      let score = 50;
      const jobText = `${job.title} ${job.description} ${job.company} ${job.location}`.toLowerCase();
      
      // Keyword match bonus
      for (const keyword of searchKeywords) {
        if (jobText.includes(keyword.toLowerCase())) {
          score += 8;
        }
      }
      
      // Location match bonus
      for (const loc of searchLocations) {
        if (jobText.includes(loc.toLowerCase())) {
          score += 5;
          break;
        }
      }
      
      // Work type match bonus
      if (workType && workType !== 'all' && jobText.includes(workType.toLowerCase())) {
        score += 10;
      }
      
      // Job type match bonus
      if (jobType && jobType !== 'all' && jobText.includes(jobType.toLowerCase())) {
        score += 10;
      }
      
      // Experience level match bonus
      if (experienceLevel && experienceLevel !== 'all' && jobText.includes(experienceLevel.toLowerCase())) {
        score += 10;
      }
      
      // Tier-1 company bonus
      if (isTier1Company(job.company)) score += 15;
      
      // Known ATS platform bonus (more reliable)
      if (!['Other', 'Career Page'].includes(job.platform)) score += 5;
      
      // Salary info bonus
      if (job.salary) score += 5;
      
      // Requirements bonus
      score += Math.min(10, job.requirements.length * 2);
      
      job.match_score = Math.min(100, score);
    }
    
    // Sort by match score
    allJobs.sort((a, b) => b.match_score - a.match_score);
    
    // Save to database
    if (allJobs.length > 0) {
      const { data: existingJobs } = await supabase
        .from('jobs')
        .select('url')
        .eq('user_id', user_id);
      
      const existingUrls = new Set((existingJobs || []).map(j => j.url));
      const newJobs = allJobs.filter(j => !existingUrls.has(j.url));
      
      if (newJobs.length > 0) {
        const jobsToInsert = newJobs.map(job => ({
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
        
        // Insert in batches of 100
        for (let i = 0; i < jobsToInsert.length; i += 100) {
          const insertBatch = jobsToInsert.slice(i, i + 100);
          await supabase.from('jobs').insert(insertBatch);
        }
        
        console.log(`Inserted ${newJobs.length} new jobs`);
      }
    }
    
    // Return platform breakdown
    const platformBreakdown: Record<string, number> = {};
    for (const job of allJobs) {
      platformBreakdown[job.platform] = (platformBreakdown[job.platform] || 0) + 1;
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        jobs: allJobs,
        totalFound: allJobs.length,
        platforms: platformBreakdown,
        queriesRun: searchQueries.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Search error:', error);
    const status = error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500;
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
