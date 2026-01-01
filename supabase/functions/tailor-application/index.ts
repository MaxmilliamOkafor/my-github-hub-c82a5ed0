import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// We reuse the existing generate-pdf backend function to keep a single client call per job.
// This function calls generate-pdf server-side and returns base64 PDFs alongside the tailored text.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation limits
const MAX_STRING_SHORT = 200;
const MAX_STRING_MEDIUM = 500;
const MAX_STRING_LONG = 50000;
const MAX_ARRAY_SIZE = 50;

function validateString(value: any, maxLength: number, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength} characters`);
  }
  return trimmed;
}

function validateStringArray(value: any, maxItems: number, maxStringLength: number, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  if (value.length > maxItems) {
    throw new Error(`${fieldName} exceeds maximum of ${maxItems} items`);
  }
  return value.slice(0, maxItems).map((item, i) => 
    validateString(item, maxStringLength, `${fieldName}[${i}]`)
  );
}

interface TailorRequest {
  jobTitle: string;
  company: string;
  description: string;
  requirements: string[];
  location?: string;
  extractedCity?: string; // City extracted by extension for "[CITY] | open to relocation" CV format
  jobId?: string;
  userProfile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    linkedin: string;
    github: string;
    portfolio: string;
    coverLetter: string;
    workExperience: any[];
    education: any[];
    skills: any[];
    certifications: string[];
    achievements: any[];
    atsStrategy: string;
    city?: string;
    country?: string;
    address?: string;
    state?: string;
    zipCode?: string;
  };
  includeReferral?: boolean;
}

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

function validateRequest(data: any): TailorRequest {
  const jobTitle = validateString(data.jobTitle, MAX_STRING_SHORT, 'jobTitle');
  const company = validateString(data.company, MAX_STRING_SHORT, 'company');
  const description = validateString(data.description || '', MAX_STRING_LONG, 'description');
  const requirements = validateStringArray(data.requirements || [], MAX_ARRAY_SIZE, MAX_STRING_MEDIUM, 'requirements');
  const location = data.location ? validateString(data.location, MAX_STRING_SHORT, 'location') : undefined;
  const extractedCity = data.extractedCity ? validateString(data.extractedCity, MAX_STRING_SHORT, 'extractedCity') : undefined;
  const jobId = data.jobId ? validateString(data.jobId, MAX_STRING_SHORT, 'jobId') : undefined;
  
  const profile = data.userProfile || {};
  const userProfile = {
    firstName: validateString(profile.firstName || '', MAX_STRING_SHORT, 'firstName'),
    lastName: validateString(profile.lastName || '', MAX_STRING_SHORT, 'lastName'),
    email: validateString(profile.email || '', MAX_STRING_SHORT, 'email'),
    phone: validateString(profile.phone || '', MAX_STRING_SHORT, 'phone'),
    linkedin: validateString(profile.linkedin || '', MAX_STRING_MEDIUM, 'linkedin'),
    github: validateString(profile.github || '', MAX_STRING_MEDIUM, 'github'),
    portfolio: validateString(profile.portfolio || '', MAX_STRING_MEDIUM, 'portfolio'),
    coverLetter: validateString(profile.coverLetter || '', MAX_STRING_LONG, 'coverLetter'),
    workExperience: Array.isArray(profile.workExperience) ? profile.workExperience.slice(0, 20) : [],
    education: Array.isArray(profile.education) ? profile.education.slice(0, 10) : [],
    skills: Array.isArray(profile.skills) ? profile.skills.slice(0, 100) : [],
    certifications: validateStringArray(profile.certifications || [], MAX_ARRAY_SIZE, MAX_STRING_MEDIUM, 'certifications'),
    achievements: Array.isArray(profile.achievements) ? profile.achievements.slice(0, 20) : [],
    atsStrategy: validateString(profile.atsStrategy || '', MAX_STRING_LONG, 'atsStrategy'),
    city: profile.city ? validateString(profile.city, MAX_STRING_SHORT, 'city') : undefined,
    country: profile.country ? validateString(profile.country, MAX_STRING_SHORT, 'country') : undefined,
    address: profile.address ? validateString(profile.address, MAX_STRING_MEDIUM, 'address') : undefined,
    state: profile.state ? validateString(profile.state, MAX_STRING_SHORT, 'state') : undefined,
    zipCode: profile.zipCode ? validateString(profile.zipCode, MAX_STRING_SHORT, 'zipCode') : undefined,
  };

  return {
    jobTitle,
    company,
    description,
    requirements,
    location,
    extractedCity,
    jobId,
    userProfile,
    includeReferral: !!data.includeReferral,
  };
}

// Extract city from job location/description/URL for ATS optimization
function extractJobCity(jdLocation: string | undefined, jdDescription: string, jobUrl?: string): string | null {
  // Common city patterns to extract
  const cityPatterns = [
    // Major US cities
    'New York', 'San Francisco', 'Los Angeles', 'Chicago', 'Seattle', 'Austin', 'Boston', 'Denver', 'Atlanta', 'Dallas', 'Houston', 'Miami', 'Phoenix', 'Philadelphia', 'San Diego', 'San Jose', 'Portland', 'Minneapolis', 'Detroit', 'Washington DC', 'D.C.',
    // Major UK cities  
    'London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Bristol', 'Cambridge', 'Oxford', 'Cardiff', 'Leeds', 'Liverpool', 'Newcastle', 'Belfast', 'Southampton', 'Nottingham', 'Sheffield',
    // Major EU cities
    'Dublin', 'Paris', 'Berlin', 'Amsterdam', 'Munich', 'Frankfurt', 'Vienna', 'Zurich', 'Barcelona', 'Madrid', 'Milan', 'Rome', 'Stockholm', 'Copenhagen', 'Oslo', 'Helsinki', 'Brussels', 'Lisbon', 'Prague', 'Warsaw',
    // Major Canadian cities
    'Toronto', 'Vancouver', 'Montreal', 'Ottawa', 'Calgary', 'Edmonton',
    // Major APAC cities
    'Singapore', 'Hong Kong', 'Tokyo', 'Sydney', 'Melbourne', 'Auckland', 'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Seoul', 'Shanghai', 'Beijing',
    // Ireland cities
    'Cork', 'Galway', 'Limerick', 'Waterford'
  ];
  
  // Priority 1: Extract from job location field
  if (jdLocation && jdLocation.trim().length > 0) {
    const locationText = jdLocation.trim();
    
    // Check for direct city match in location
    for (const city of cityPatterns) {
      if (new RegExp(`\\b${city}\\b`, 'i').test(locationText)) {
        return city;
      }
    }
    
    // If location is simple (no "or", no "Remote" as primary), use first part
    if (!/\bremote\b/i.test(locationText) && !locationText.includes(',') && locationText.length < 50) {
      return locationText;
    }
    
    // Extract first city from "City, State" or "City or Remote" patterns
    const firstCityMatch = locationText.match(/^([A-Za-z\s]+?)(?:,|\s+or\s+|\s*\|)/i);
    if (firstCityMatch && firstCityMatch[1].length > 2) {
      return firstCityMatch[1].trim();
    }
  }
  
  // Priority 2: Extract from URL params (e.g., ?city=London)
  if (jobUrl) {
    try {
      const url = new URL(jobUrl);
      const cityParam = url.searchParams.get('city') || url.searchParams.get('location');
      if (cityParam) {
        for (const city of cityPatterns) {
          if (new RegExp(`\\b${city}\\b`, 'i').test(cityParam)) {
            return city;
          }
        }
        return cityParam;
      }
    } catch (e) {
      // URL parsing failed, continue
    }
  }
  
  // Priority 3: Extract from job description
  const descLower = jdDescription.toLowerCase();
  
  // Look for "Based in [City]" or "[City] Role" patterns
  const basedInMatch = jdDescription.match(/based in\s+([A-Za-z\s]+?)(?:\.|,|\s+and|\s+or|$)/i);
  if (basedInMatch && basedInMatch[1].length > 2) {
    const potentialCity = basedInMatch[1].trim();
    for (const city of cityPatterns) {
      if (new RegExp(`\\b${city}\\b`, 'i').test(potentialCity)) {
        return city;
      }
    }
  }
  
  // Check for any city mention in description
  for (const city of cityPatterns) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(jdDescription)) {
      return city;
    }
  }
  
  return null;
}

// Smart location logic - formats as "[CITY] | open to relocation" for CV ONLY
function getSmartLocation(jdLocation: string | undefined, jdDescription: string, profileCity?: string, profileCountry?: string, jobUrl?: string, preExtractedCity?: string): string {
  // Priority 1: Use city pre-extracted by extension if provided
  if (preExtractedCity && preExtractedCity.trim().length > 0) {
    console.log(`Using pre-extracted city from extension: ${preExtractedCity}`);
    return `${preExtractedCity} | open to relocation`;
  }
  
  // Priority 2: Extract city from job listing
  const extractedCity = extractJobCity(jdLocation, jdDescription, jobUrl);
  
  // If we found a city in the job listing, use it with relocation suffix
  if (extractedCity) {
    return `${extractedCity} | open to relocation`;
  }
  
  // Check if job is remote
  const jdText = `${jdLocation || ''} ${jdDescription}`.toLowerCase();
  if (/\b(remote|worldwide|global|anywhere|distributed|work from home|wfh)\b/.test(jdText)) {
    if (profileCity && profileCountry) {
      return `${profileCity} | Remote`;
    }
    return "Remote | open to relocation";
  }
  
  // Fallback to profile location with relocation suffix
  if (profileCity) {
    return `${profileCity} | open to relocation`;
  }
  
  return "Remote | open to relocation";
}

// Jobscan-style keyword extraction - enhanced for ATS ranking
function extractJobscanKeywords(description: string, requirements: string[]): { 
  hardSkills: string[], 
  softSkills: string[], 
  tools: string[], 
  titles: string[],
  certifications: string[],
  responsibilities: string[],
  allKeywords: string[]
} {
  const text = `${description} ${requirements.join(' ')}`.toLowerCase();
  
  // Hard skills (expanded tech stack - covers most ATS systems)
  const hardSkillPatterns = [
    // Programming languages
    'python', 'javascript', 'typescript', 'java', 'c\\+\\+', 'c#', 'go', 'golang', 'rust', 'ruby', 'php', 'scala', 'kotlin', 'swift', 'r', 'matlab', 'perl', 'bash', 'powershell', 'sql', 'plsql', 'tsql', 'vba', 'solidity', 'haskell', 'elixir', 'clojure', 'f#', 'dart', 'lua', 'groovy', 'objective-c',
    // Web frameworks
    'react', 'react\\.?js', 'angular', 'vue', 'vue\\.?js', 'svelte', 'next\\.?js', 'nuxt', 'gatsby', 'remix', 'ember', 'backbone', 'jquery', 'node\\.?js', 'express', 'express\\.?js', 'fastify', 'nest\\.?js', 'koa', 'hapi', 'django', 'flask', 'fastapi', 'pyramid', 'spring', 'spring boot', 'rails', 'ruby on rails', 'laravel', 'symfony', 'asp\\.?net', 'blazor', 'gin', 'echo', 'fiber', 'phoenix',
    // Databases
    'sql', 'nosql', 'postgresql', 'postgres', 'mysql', 'mariadb', 'mongodb', 'redis', 'elasticsearch', 'opensearch', 'cassandra', 'dynamodb', 'couchdb', 'couchbase', 'neo4j', 'graphdb', 'arangodb', 'firestore', 'firebase', 'supabase', 'sqlite', 'oracle', 'sql server', 'mssql', 'db2', 'teradata', 'redshift', 'bigquery', 'athena', 'presto', 'trino', 'clickhouse', 'timescaledb', 'influxdb',
    // Cloud & infrastructure
    'aws', 'amazon web services', 'azure', 'microsoft azure', 'gcp', 'google cloud', 'google cloud platform', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'puppet', 'chef', 'cloudformation', 'pulumi', 'helm', 'istio', 'linkerd', 'consul', 'vault', 'nomad', 'ecs', 'eks', 'aks', 'gke', 'fargate', 'lambda', 'step functions', 'cloud functions', 'azure functions', 'cloudflare', 'vercel', 'netlify', 'heroku', 'digitalocean', 'linode', 'vagrant', 'openstack', 'vmware', 'proxmox',
    // DevOps/CI-CD
    'jenkins', 'circleci', 'github actions', 'gitlab ci', 'travis ci', 'bamboo', 'teamcity', 'azure devops', 'argo cd', 'argocd', 'flux', 'spinnaker', 'tekton', 'buildkite', 'drone', 'concourse', 'ci/cd', 'ci cd', 'continuous integration', 'continuous deployment', 'continuous delivery', 'devops', 'devsecops', 'sre', 'site reliability', 'infrastructure as code', 'iac', 'gitops',
    // Data & ML
    'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'sklearn', 'pandas', 'numpy', 'scipy', 'matplotlib', 'seaborn', 'plotly', 'spark', 'pyspark', 'hadoop', 'hive', 'pig', 'kafka', 'confluent', 'airflow', 'dagster', 'prefect', 'luigi', 'dbt', 'great expectations', 'mlflow', 'kubeflow', 'vertex ai', 'sagemaker', 'databricks', 'snowflake', 'fivetran', 'stitch', 'airbyte', 'meltano', 'looker', 'tableau', 'power bi', 'metabase', 'superset', 'quicksight', 'mode', 'amplitude', 'mixpanel', 'segment', 'heap', 'hugging face', 'transformers', 'langchain', 'llamaindex', 'openai', 'gpt', 'llm', 'large language model', 'nlp', 'natural language processing', 'computer vision', 'cv', 'opencv', 'yolo', 'bert', 'word2vec', 'xgboost', 'lightgbm', 'catboost', 'random forest', 'neural network', 'deep learning', 'machine learning', 'ml', 'ai', 'artificial intelligence', 'reinforcement learning', 'supervised learning', 'unsupervised learning', 'feature engineering', 'model training', 'model serving', 'mlops', 'data science', 'data engineering', 'data analytics', 'etl', 'elt', 'data warehouse', 'data lake', 'data lakehouse', 'data pipeline', 'streaming', 'real-time', 'batch processing',
    // API & Architecture
    'rest', 'rest api', 'restful', 'graphql', 'grpc', 'soap', 'websocket', 'webhook', 'api gateway', 'microservices', 'micro-services', 'serverless', 'event-driven', 'event driven', 'message queue', 'pub/sub', 'pubsub', 'rabbitmq', 'activemq', 'sqs', 'sns', 'kinesis', 'eventbridge', 'domain driven design', 'ddd', 'cqrs', 'saga pattern', 'circuit breaker', 'load balancer', 'reverse proxy', 'nginx', 'apache', 'haproxy', 'traefik', 'kong', 'envoy',
    // Security
    'oauth', 'oauth2', 'oidc', 'openid connect', 'jwt', 'saml', 'sso', 'single sign-on', 'mfa', 'multi-factor', '2fa', 'rbac', 'role based access', 'iam', 'identity management', 'encryption', 'tls', 'ssl', 'https', 'penetration testing', 'security audit', 'vulnerability', 'owasp', 'soc2', 'soc 2', 'gdpr', 'hipaa', 'pci dss', 'iso 27001', 'compliance', 'cybersecurity', 'infosec', 'devsecops',
    // Frontend
    'html', 'html5', 'css', 'css3', 'sass', 'scss', 'less', 'tailwind', 'tailwindcss', 'bootstrap', 'material ui', 'mui', 'chakra ui', 'ant design', 'styled components', 'emotion', 'webpack', 'vite', 'parcel', 'rollup', 'esbuild', 'swc', 'babel', 'eslint', 'prettier', 'responsive design', 'mobile-first', 'accessibility', 'a11y', 'wcag', 'aria', 'pwa', 'progressive web app', 'spa', 'single page application', 'ssr', 'server side rendering', 'ssg', 'static site generation', 'jamstack',
    // Mobile
    'ios', 'android', 'react native', 'flutter', 'xamarin', 'ionic', 'cordova', 'capacitor', 'expo', 'mobile development', 'cross-platform', 'native app',
    // Testing
    'unit testing', 'integration testing', 'e2e', 'end-to-end', 'test automation', 'tdd', 'test driven', 'bdd', 'behavior driven', 'jest', 'mocha', 'chai', 'jasmine', 'karma', 'cypress', 'playwright', 'selenium', 'webdriver', 'puppeteer', 'pytest', 'unittest', 'junit', 'testng', 'rspec', 'cucumber', 'postman', 'newman', 'load testing', 'performance testing', 'jmeter', 'locust', 'k6', 'gatling', 'qa', 'quality assurance',
    // Misc tech
    'git', 'github', 'gitlab', 'bitbucket', 'svn', 'linux', 'unix', 'windows server', 'macos', 'shell scripting', 'regex', 'regular expressions', 'json', 'xml', 'yaml', 'protobuf', 'avro', 'parquet', 'orc', 'csv', 'markdown', 'agile', 'scrum', 'kanban', 'lean', 'safe', 'waterfall', 'sdlc', 'software development lifecycle',
    // Blockchain & Web3
    'blockchain', 'web3', 'ethereum', 'solana', 'polygon', 'smart contracts', 'defi', 'nft', 'dapp', 'ipfs', 'hardhat', 'truffle', 'foundry'
  ];
  
  // Soft skills (critical for ATS)
  const softSkillPatterns = [
    'communication', 'communication skills', 'written communication', 'verbal communication', 'presentation skills',
    'leadership', 'team leadership', 'technical leadership', 'thought leadership', 'people management',
    'problem-solving', 'problem solving', 'critical thinking', 'analytical thinking', 'strategic thinking',
    'teamwork', 'collaboration', 'cross-functional', 'cross functional', 'interdisciplinary',
    'adaptability', 'flexibility', 'learning agility', 'growth mindset', 'self-motivated', 'proactive',
    'time management', 'prioritization', 'multitasking', 'deadline-driven', 'results-oriented',
    'attention to detail', 'detail-oriented', 'quality-focused', 'accuracy',
    'project management', 'program management', 'stakeholder management', 'client-facing', 'customer-focused',
    'mentoring', 'coaching', 'training', 'knowledge sharing', 'onboarding',
    'negotiation', 'conflict resolution', 'decision-making', 'decision making', 'consensus building',
    'innovation', 'creativity', 'design thinking', 'user-centric', 'empathy',
    'accountability', 'ownership', 'initiative', 'self-starter', 'independent'
  ];
  
  // Tools/platforms
  const toolPatterns = [
    'jira', 'confluence', 'slack', 'microsoft teams', 'teams', 'zoom', 'notion', 'asana', 'trello', 'monday', 'clickup', 'linear', 'shortcut', 'pivotal tracker',
    'figma', 'sketch', 'adobe xd', 'invision', 'zeplin', 'miro', 'lucidchart', 'draw\\.io', 'excalidraw',
    'postman', 'insomnia', 'swagger', 'openapi', 'graphiql', 'graphql playground',
    'datadog', 'splunk', 'grafana', 'prometheus', 'new relic', 'dynatrace', 'appdynamics', 'elastic apm', 'honeycomb', 'lightstep', 'jaeger', 'zipkin',
    'sentry', 'bugsnag', 'rollbar', 'logrocket', 'fullstory', 'hotjar',
    'pagerduty', 'opsgenie', 'victorops', 'statuspage', 'incident\\.io',
    'cloudwatch', 'stackdriver', 'azure monitor',
    'sonarqube', 'snyk', 'dependabot', 'renovate', 'whitesource', 'black duck', 'veracode', 'checkmarx',
    'salesforce', 'hubspot', 'zendesk', 'intercom', 'freshdesk',
    'stripe', 'plaid', 'twilio', 'sendgrid', 'mailchimp', 'brevo',
    '1password', 'lastpass', 'okta', 'auth0', 'onelogin', 'ping identity'
  ];
  
  // Job titles/roles
  const titlePatterns = [
    'software engineer', 'senior software engineer', 'staff engineer', 'principal engineer', 'distinguished engineer', 'fellow',
    'software developer', 'senior software developer', 'application developer', 'web developer', 'frontend developer', 'backend developer', 'full stack developer', 'fullstack developer',
    'data scientist', 'senior data scientist', 'lead data scientist', 'principal data scientist',
    'data engineer', 'senior data engineer', 'analytics engineer', 'bi engineer', 'business intelligence',
    'data analyst', 'business analyst', 'product analyst', 'marketing analyst', 'financial analyst',
    'ml engineer', 'machine learning engineer', 'ai engineer', 'applied scientist', 'research scientist', 'research engineer',
    'solution architect', 'solutions architect', 'cloud architect', 'enterprise architect', 'technical architect', 'software architect', 'system architect',
    'devops engineer', 'platform engineer', 'infrastructure engineer', 'reliability engineer', 'sre', 'site reliability engineer',
    'security engineer', 'security analyst', 'information security', 'application security', 'cloud security',
    'qa engineer', 'sdet', 'test engineer', 'quality engineer', 'automation engineer',
    'technical lead', 'tech lead', 'team lead', 'engineering manager', 'engineering director', 'vp of engineering', 'cto', 'chief technology officer',
    'product manager', 'product owner', 'program manager', 'project manager', 'scrum master', 'agile coach',
    'frontend', 'backend', 'full stack', 'fullstack', 'mobile developer', 'ios developer', 'android developer'
  ];
  
  // Certifications (highly valued by ATS)
  const certificationPatterns = [
    'aws certified', 'aws solutions architect', 'aws developer', 'aws sysops', 'aws devops', 'aws security', 'aws data analytics', 'aws machine learning',
    'azure certified', 'azure administrator', 'azure developer', 'azure solutions architect', 'azure data engineer', 'azure ai engineer',
    'gcp certified', 'google cloud certified', 'professional cloud architect', 'professional data engineer', 'professional cloud developer',
    'cka', 'ckad', 'cks', 'kubernetes certified', 'certified kubernetes',
    'terraform certified', 'hashicorp certified',
    'pmp', 'project management professional', 'prince2', 'capm', 'agile certified', 'csm', 'certified scrum master', 'psm', 'safe certified',
    'cissp', 'cism', 'cisa', 'comptia security\\+', 'ceh', 'certified ethical hacker', 'oscp',
    'comptia a\\+', 'comptia network\\+', 'ccna', 'ccnp', 'ccie',
    'ocjp', 'ocpjp', 'java certified', 'oracle certified',
    'mcsa', 'mcse', 'microsoft certified',
    'salesforce certified', 'servicenow certified', 'databricks certified', 'snowflake certified'
  ];
  
  // Key action verbs / responsibilities (ATS loves these)
  const responsibilityPatterns = [
    'designed', 'developed', 'implemented', 'built', 'created', 'architected',
    'led', 'managed', 'supervised', 'mentored', 'coached', 'trained',
    'optimized', 'improved', 'enhanced', 'streamlined', 'automated',
    'collaborated', 'partnered', 'coordinated', 'communicated',
    'analyzed', 'evaluated', 'assessed', 'reviewed', 'audited',
    'deployed', 'released', 'launched', 'shipped', 'delivered',
    'scaled', 'migrated', 'integrated', 'refactored', 'modernized',
    'reduced', 'increased', 'achieved', 'exceeded', 'accomplished',
    'documented', 'maintained', 'supported', 'troubleshot', 'debugged', 'resolved'
  ];
  
  const extractMatches = (patterns: string[]): string[] => {
    const matches: string[] = [];
    for (const pattern of patterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      if (regex.test(text)) {
        // Capitalize properly and clean up escaped characters
        const cleaned = pattern.replace(/\\\./g, '.').replace(/\\+/g, '+').replace(/\\?/g, '');
        if (!matches.some(m => m.toLowerCase() === cleaned.toLowerCase())) {
          // Smart capitalization
          const capitalized = cleaned.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');
          matches.push(capitalized);
        }
      }
    }
    return matches;
  };
  
  // Extract with higher limits for better ATS coverage
  const hardSkills = extractMatches(hardSkillPatterns).slice(0, 25);
  const softSkills = extractMatches(softSkillPatterns).slice(0, 8);
  const tools = extractMatches(toolPatterns).slice(0, 10);
  const titles = extractMatches(titlePatterns).slice(0, 5);
  const certifications = extractMatches(certificationPatterns).slice(0, 5);
  const responsibilities = extractMatches(responsibilityPatterns).slice(0, 10);
  
  // Combined keywords prioritized for ATS scoring
  const allKeywords = [
    ...hardSkills,       // Primary skills - most important
    ...titles,           // Job title matches
    ...certifications,   // Certifications are high value
    ...tools,            // Tools/platforms
    ...softSkills        // Soft skills for culture fit
  ].slice(0, 35);
  
  return { hardSkills, softSkills, tools, titles, certifications, responsibilities, allKeywords };
}

// Calculate accurate match score with fuzzy matching and synonym detection
function calculateMatchScore(
  jdKeywords: string[], 
  profileSkills: any[], 
  profileExperience: any[],
  profileEducation: any[] = [],
  profileCertifications: string[] = []
): { score: number, matched: string[], missing: string[], partialMatches: string[] } {
  
  // Synonym mapping for common tech terms (helps with ATS variations)
  const synonyms: Record<string, string[]> = {
    'javascript': ['js', 'ecmascript', 'es6', 'es2015'],
    'typescript': ['ts'],
    'python': ['py'],
    'kubernetes': ['k8s'],
    'postgresql': ['postgres', 'psql'],
    'mongodb': ['mongo'],
    'amazon web services': ['aws'],
    'google cloud': ['gcp', 'google cloud platform'],
    'microsoft azure': ['azure'],
    'node.js': ['nodejs', 'node'],
    'react.js': ['reactjs', 'react'],
    'vue.js': ['vuejs', 'vue'],
    'next.js': ['nextjs', 'next'],
    'machine learning': ['ml'],
    'artificial intelligence': ['ai'],
    'natural language processing': ['nlp'],
    'continuous integration': ['ci'],
    'continuous deployment': ['cd'],
    'ci/cd': ['cicd', 'ci cd', 'continuous integration', 'continuous deployment'],
    'rest api': ['restful', 'rest'],
    'graphql': ['gql'],
    'sql': ['structured query language'],
    'nosql': ['no-sql', 'non-relational'],
    'agile': ['scrum', 'kanban'],
    'full stack': ['fullstack', 'full-stack'],
    'frontend': ['front-end', 'front end'],
    'backend': ['back-end', 'back end'],
    'devops': ['dev ops', 'dev-ops'],
  };
  
  // Build comprehensive profile text for matching
  const profileSkillsLower = profileSkills.map(s => 
    (typeof s === 'string' ? s : s.name || '').toLowerCase()
  );
  
  const experienceText = profileExperience.map(exp => 
    `${exp.title || ''} ${exp.company || ''} ${exp.description || ''} ${(exp.bullets || []).join(' ')}`
  ).join(' ').toLowerCase();
  
  const educationText = profileEducation.map(edu =>
    `${edu.degree || ''} ${edu.field || ''} ${edu.school || ''} ${edu.description || ''}`
  ).join(' ').toLowerCase();
  
  const certText = profileCertifications.join(' ').toLowerCase();
  
  const fullProfileText = `${profileSkillsLower.join(' ')} ${experienceText} ${educationText} ${certText}`;
  
  const matched: string[] = [];
  const missing: string[] = [];
  const partialMatches: string[] = [];
  
  for (const keyword of jdKeywords) {
    const keywordLower = keyword.toLowerCase();
    
    // Direct match
    let isMatched = fullProfileText.includes(keywordLower);
    
    // Check synonyms if no direct match
    if (!isMatched) {
      const keywordSynonyms = synonyms[keywordLower] || [];
      for (const syn of keywordSynonyms) {
        if (fullProfileText.includes(syn)) {
          isMatched = true;
          partialMatches.push(`${keyword} (via ${syn})`);
          break;
        }
      }
      
      // Check reverse synonyms (if profile has synonym, match the keyword)
      if (!isMatched) {
        for (const [mainTerm, syns] of Object.entries(synonyms)) {
          if (syns.includes(keywordLower) && fullProfileText.includes(mainTerm)) {
            isMatched = true;
            partialMatches.push(`${keyword} (via ${mainTerm})`);
            break;
          }
        }
      }
    }
    
    // Fuzzy match: check if keyword is substring or has high overlap
    if (!isMatched) {
      const words = keywordLower.split(/[\s\-\/]+/);
      const matchedWords = words.filter(w => w.length > 2 && fullProfileText.includes(w));
      if (matchedWords.length >= Math.ceil(words.length * 0.6)) {
        isMatched = true;
        partialMatches.push(`${keyword} (partial: ${matchedWords.join(', ')})`);
      }
    }
    
    if (isMatched) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }
  
  // Calculate score with weighted importance
  // Hard skills (first 15) = 4 points, Tools/Certs (15-25) = 3 points, Soft skills = 2 points
  let totalPoints = 0;
  let earnedPoints = 0;
  
  jdKeywords.forEach((kw, i) => {
    const points = i < 15 ? 4 : (i < 25 ? 3 : 2);
    totalPoints += points;
    if (matched.includes(kw)) {
      earnedPoints += points;
    }
  });
  
  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 50;
  
  return { 
    score: Math.min(100, Math.max(0, score)), 
    matched, 
    missing,
    partialMatches
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, supabase } = await verifyAuth(req);
    
    const rawData = await req.json();
    
    // Support both 'description' and 'jobDescription' for extension compatibility
    if (rawData.jobDescription && !rawData.description) {
      rawData.description = rawData.jobDescription;
    }
    
    // Support 'jobUrl' as 'jobId' if no jobId provided
    if (rawData.jobUrl && !rawData.jobId) {
      rawData.jobId = rawData.jobUrl;
    }
    
    // If userProfile not provided, fetch from database
    if (!rawData.userProfile || Object.keys(rawData.userProfile).length === 0) {
      console.log(`[User ${userId}] Fetching profile from database...`);
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (profileError || !profileData) {
        console.error('Failed to fetch user profile:', profileError);
        return new Response(JSON.stringify({ 
          error: "Profile not found. Please complete your profile in settings." 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Map database profile to expected userProfile format
      rawData.userProfile = {
        firstName: profileData.first_name || '',
        lastName: profileData.last_name || '',
        email: profileData.email || '',
        phone: profileData.phone || '',
        linkedin: profileData.linkedin || '',
        github: profileData.github || '',
        portfolio: profileData.portfolio || '',
        coverLetter: profileData.cover_letter || '',
        workExperience: profileData.work_experience || [],
        education: profileData.education || [],
        skills: profileData.skills || [],
        certifications: profileData.certifications || [],
        achievements: profileData.achievements || [],
        atsStrategy: profileData.ats_strategy || '',
        city: profileData.city || '',
        country: profileData.country || '',
        address: profileData.address || '',
        state: profileData.state || '',
        zipCode: profileData.zip_code || '',
      };
      
      console.log(`[User ${userId}] Profile loaded: ${rawData.userProfile.firstName} ${rawData.userProfile.lastName}`);
    }
    
    const { jobTitle, company, description, requirements, location, extractedCity, jobId, userProfile, includeReferral } = validateRequest(rawData);
    
    // Validate that profile has required info
    if (!userProfile.firstName || !userProfile.lastName) {
      return new Response(JSON.stringify({ 
        error: "Profile incomplete. Please add your first and last name in Profile settings." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
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

    console.log(`[User ${userId}] Tailoring application for ${jobTitle} at ${company}`);

    // Smart location logic - extract job city and format as "[CITY] | open to relocation"
    // Priority: 1) extractedCity from extension, 2) extract from location/description, 3) profile city
    const smartLocation = getSmartLocation(location, description, userProfile.city, userProfile.country, jobId, extractedCity);
    console.log(`Smart location determined: ${smartLocation}${extractedCity ? ` (from extension: ${extractedCity})` : ''}`);
    
    // Jobscan keyword extraction
    const jdKeywords = extractJobscanKeywords(description, requirements);
    console.log(`Extracted ${jdKeywords.allKeywords.length} keywords from JD`);
    
    // Calculate accurate match score with enhanced matching
    const matchResult = calculateMatchScore(
      jdKeywords.allKeywords, 
      userProfile.skills, 
      userProfile.workExperience,
      userProfile.education,
      userProfile.certifications
    );
    console.log(`Match score calculated: ${matchResult.score}%, matched: ${matchResult.matched.length}, missing: ${matchResult.missing.length}, partial: ${matchResult.partialMatches?.length || 0}`);

    const candidateName = `${userProfile.firstName} ${userProfile.lastName}`.trim();
    // File naming: FirstName_LastName format with underscores
    const candidateNameForFile = `${userProfile.firstName}_${userProfile.lastName}`.replace(/\s+/g, '_').trim();
    
    // Calculate target score - we want 95-100% after AI integration
    const currentMatchPercent = matchResult.matched.length / jdKeywords.allKeywords.length * 100;
    const keywordsNeededFor95 = Math.ceil(jdKeywords.allKeywords.length * 0.95) - matchResult.matched.length;

    const systemPrompt = `You are an ELITE ATS OPTIMIZATION SPECIALIST who guarantees 95-100% keyword match scores. Your job is to get candidates past ATS filters and into interviews.

CRITICAL MISSION: Achieve 95-100% ATS KEYWORD MATCH while sounding HUMAN and natural.

KEYWORD INTEGRATION STRATEGY (MANDATORY):
- Current match: ${matchResult.matched.length}/${jdKeywords.allKeywords.length} keywords (${Math.round(currentMatchPercent)}%)
- Target: 95-100% match (need to add ${keywordsNeededFor95} more keywords)
- MISSING KEYWORDS THAT MUST BE ADDED: ${matchResult.missing.join(', ')}

HOW TO ADD MISSING KEYWORDS NATURALLY:
1. Skills Section: Add missing hard skills if candidate has related experience
2. Summary: Weave in 3-5 missing keywords naturally
3. Work Experience Bullets: Integrate keywords into achievement descriptions
4. Cover Letter: Use missing keywords when describing qualifications
5. If keyword is a technology: mention it as "experience with" or "proficient in"
6. If keyword is a soft skill: demonstrate it through an achievement example

ABSOLUTE RULES:
1. PRESERVE ALL COMPANY NAMES AND EXACT DATES - Only tailor the bullet points
2. Location in CV header MUST be: "${smartLocation}"
3. NO typos, grammatical errors, or formatting issues
4. File naming: ${candidateNameForFile}_CV.pdf and ${candidateNameForFile}_Cover_Letter.pdf
5. EVERY keyword in the JD should appear at least once in the tailored resume

=== CRITICAL: PROFESSIONAL SUMMARY MUST NOT DUPLICATE HEADER ===
The resume header already contains: Name, Phone, Email, Location, LinkedIn, GitHub, Portfolio URLs.
The PROFESSIONAL SUMMARY section MUST:
- Start DIRECTLY with a qualifier like "Accomplished...", "Senior...", "Experienced..."
- NEVER repeat the candidate name "${candidateName}"
- NEVER repeat email "${userProfile.email}"
- NEVER repeat phone "${userProfile.phone}"
- NEVER repeat any URLs (linkedin, github, portfolio)
- NEVER repeat location information
VIOLATION = INSTANT REJECTION. The summary describes qualifications ONLY.
=== END CRITICAL RULE ===

HUMANIZED TONE RULES:
- Active voice only
- Vary sentence structure - avoid repetitive patterns
- Use connectors: "This enabled...", "Resulting in...", "Which led to..."
- BANNED: "results-driven", "dynamic", "cutting-edge", "passionate", "leverage", "synergy"
- Include specific metrics (%, $, time saved, users impacted)

ATS KEYWORD DENSITY TARGETS:
- Hard Skills: Each must appear 2-3 times across resume
- Job Title Keywords: Must appear in summary and at least one role
- Tools/Platforms: Mention in skills section AND in relevant experience bullets
- Soft Skills: Demonstrate through specific examples, not just list them

JD KEYWORDS TO INTEGRATE:
Hard Skills (PRIORITY 1): ${jdKeywords.hardSkills.join(', ')}
Tools (PRIORITY 2): ${jdKeywords.tools.join(', ')}
Titles (PRIORITY 3): ${jdKeywords.titles.join(', ')}
Soft Skills (PRIORITY 4): ${jdKeywords.softSkills.join(', ')}
Certifications: ${jdKeywords.certifications.join(', ')}

ALREADY MATCHED: ${matchResult.matched.join(', ')}
MUST ADD THESE (${matchResult.missing.length} keywords): ${matchResult.missing.join(', ')}

Return ONLY valid JSON - no markdown code blocks, no extra text.`;

    const userPrompt = `TASK: Create an ATS-optimized, HUMANIZED application package.

=== TARGET JOB ===
Title: ${jobTitle}
Company: ${company}
Location: ${location || 'Not specified'} → SMART LOCATION FOR CV: ${smartLocation}
Job ID: ${jobId || 'N/A'}
Description: ${description}
Key Requirements: ${requirements.join(", ")}

=== CANDIDATE PROFILE ===
Name: ${candidateName}
Email: ${userProfile.email}
Phone: ${userProfile.phone}
LinkedIn: ${userProfile.linkedin}
GitHub: ${userProfile.github}
Portfolio: ${userProfile.portfolio}
Current Location: ${userProfile.city || ''}, ${userProfile.state || ''} ${userProfile.country || ''}

WORK EXPERIENCE (PRESERVE COMPANY NAMES AND DATES EXACTLY - ONLY REWRITE BULLETS):
${JSON.stringify(userProfile.workExperience, null, 2)}

EDUCATION:
${JSON.stringify(userProfile.education, null, 2)}

SKILLS:
${userProfile.skills?.map((s: any) => typeof s === 'string' ? s : s.name).join(", ") || 'Not specified'}

CERTIFICATIONS:
${userProfile.certifications?.join(", ") || 'None listed'}

ACHIEVEMENTS:
${JSON.stringify(userProfile.achievements, null, 2)}

=== INSTRUCTIONS ===

1) CREATE RESUME with these exact sections:
   - Header: ${candidateName}
   - Contact Line: ${userProfile.phone} | ${userProfile.email} | ${smartLocation}
   - Links Line: ${userProfile.linkedin} | ${userProfile.github || ''} | ${userProfile.portfolio || ''}
   - PROFESSIONAL SUMMARY: 4-6 lines of PURE QUALIFICATIONS ONLY.
      
      ███ CRITICAL DUPLICATION BAN ███
      The header ALREADY contains name/email/phone/links.
      The PROFESSIONAL SUMMARY text must contain ZERO of these:
      • Name: "${candidateName}" → FORBIDDEN in summary
      • Email: "${userProfile.email}" → FORBIDDEN in summary  
      • Phone: "${userProfile.phone}" → FORBIDDEN in summary
      • LinkedIn URL → FORBIDDEN in summary
      • GitHub URL → FORBIDDEN in summary
      • Portfolio URL → FORBIDDEN in summary
      • Location/city → FORBIDDEN in summary
      
      CORRECT FIRST WORDS: "Experienced", "Senior", "Accomplished", "Strategic", "Innovative"
      WRONG FIRST WORD: "${candidateName.split(' ')[0]}" (this is the name - BANNED)
      
      EXAMPLE OF CORRECT SUMMARY:
      "Experienced Principal Cloud Architect with over 8 years of expertise in cloud computing, data analytics, and machine learning. Proven track record in designing scalable solutions..."
      
      EXAMPLE OF WRONG SUMMARY (DO NOT DO THIS):
      "${candidateName} ${userProfile.phone} | ${userProfile.email}..." ← THIS IS WRONG
      ███ END DUPLICATION BAN ███
   - Work Experience: Keep company/dates, rewrite bullets with JD keywords + metrics
   - Education
   - Skills: Prioritize JD keywords (list as: Python, AWS, React, etc. - NO years of experience)
   - Certifications

2) CREATE COVER LETTER:
   ${candidateName}
   ${userProfile.email} | ${userProfile.phone}
   
   Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
   
   Re: Application for ${jobTitle}
   
   Dear Hiring Committee,
   
   [4 paragraphs: Hook showing genuine interest, Proof with specific metrics and achievements, Skills alignment with job requirements, Close with availability and enthusiasm]
   
   Sincerely,
   ${candidateName}

${includeReferral ? `
3) CREATE REFERRAL EMAIL:
   Subject: Referral Request - ${jobTitle} at ${company}
   Body: Professional request mentioning specific role
` : ''}

=== REQUIRED JSON OUTPUT (NO MARKDOWN) ===
{
  "tailoredResume": "[COMPLETE RESUME TEXT - clean formatted text, no markdown]",
  "tailoredCoverLetter": "[COMPLETE COVER LETTER TEXT]",
  "matchScore": ${matchResult.score},
  "keywordsMatched": ${JSON.stringify(matchResult.matched)},
  "keywordsMissing": ${JSON.stringify(matchResult.missing)},
  "keywordAnalysis": {
    "hardSkills": ${JSON.stringify(jdKeywords.hardSkills)},
    "softSkills": ${JSON.stringify(jdKeywords.softSkills)},
    "tools": ${JSON.stringify(jdKeywords.tools)},
    "titles": ${JSON.stringify(jdKeywords.titles)}
  },
  "smartLocation": "${smartLocation}",
  "resumeStructured": {
    "personalInfo": {
      "name": "${candidateName}",
      "email": "${userProfile.email}",
      "phone": "${userProfile.phone}",
      "location": "${smartLocation}",
      "linkedin": "${userProfile.linkedin}",
      "github": "${userProfile.github}",
      "portfolio": "${userProfile.portfolio}"
    },
    "summary": "[PURE QUALIFICATIONS ONLY - Start with 'Experienced/Senior/Accomplished...' - ZERO contact info, names, emails, phones, or URLs - those are ALREADY in header above]",
    "experience": [
      {
        "company": "[Company Name]",
        "title": "[Job Title]",
        "dates": "[Start - End]",
        "bullets": ["bullet1 with metrics", "bullet2", "bullet3"]
      }
    ],
    "education": [
      {
        "degree": "[Degree Name]",
        "school": "[School Name]",
        "dates": "[Dates]",
        "gpa": "[GPA if applicable]"
      }
    ],
    "skills": {
      "primary": ${JSON.stringify(jdKeywords.hardSkills.slice(0, 10))},
      "secondary": ${JSON.stringify(jdKeywords.tools)}
    },
    "certifications": ${JSON.stringify(userProfile.certifications || [])}
  },
  "coverLetterStructured": {
    "recipientCompany": "${company}",
    "jobTitle": "${jobTitle}",
    "jobId": "${jobId || ''}",
    "paragraphs": ["para1", "para2", "para3", "para4"]
  },
  "suggestedImprovements": ["actionable suggestions"],
  "atsCompliance": {
    "formatValid": true,
    "keywordDensity": "${Math.round((matchResult.matched.length / jdKeywords.allKeywords.length) * 100)}%",
    "locationIncluded": true
  },
  "candidateName": "${candidateNameForFile}",
  "cvFileName": "${candidateNameForFile}_CV.pdf",
  "coverLetterFileName": "${candidateNameForFile}_Cover_Letter.pdf"${includeReferral ? `,
  "referralEmail": "[Subject + email body]"` : ''}
}`;

    // Retry logic with exponential backoff for rate limits
    const maxRetries = 3;
    let lastError: Error | null = null;
    let response: Response | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          console.log(`Rate limit hit, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
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
            temperature: 0.7,
          }),
        });
        
        if (response.ok) {
          break; // Success, exit retry loop
        }
        
        if (response.status === 429) {
          // Rate limit - will retry
          const errorText = await response.text();
          console.warn(`OpenAI rate limit (attempt ${attempt + 1}):`, errorText);
          lastError = new Error("Rate limit exceeded");
          
          // Check for Retry-After header
          const retryAfter = response.headers.get('Retry-After');
          if (retryAfter && attempt < maxRetries - 1) {
            const waitTime = parseInt(retryAfter, 10) * 1000 || 2000;
            console.log(`Retry-After header suggests waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          continue;
        }
        
        // Non-retryable errors
        const errorText = await response.text();
        console.error("OpenAI API error:", response.status, errorText);
        
        if (response.status === 401) {
          return new Response(JSON.stringify({ error: "Invalid OpenAI API key. Please check your API key in Profile settings." }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402 || response.status === 403) {
          return new Response(JSON.stringify({ error: "OpenAI API billing issue. Please check your OpenAI account." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        throw new Error(`OpenAI API error: ${response.status}`);
      } catch (fetchError) {
        console.error(`Fetch error (attempt ${attempt + 1}):`, fetchError);
        lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
        if (attempt === maxRetries - 1) {
          throw lastError;
        }
      }
    }
    
    // If all retries exhausted due to rate limit
    if (!response || !response.ok) {
      return new Response(JSON.stringify({ 
        error: "OpenAI API temporarily unavailable. Your quota may be exceeded. Please check your OpenAI billing and try again later.",
        retryable: true
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const tokensUsed = data.usage?.total_tokens || 0;
    
    // Log API usage
    await logApiUsage(supabase, userId, 'tailor-application', tokensUsed);
    
    console.log(`AI response received (${tokensUsed} tokens), parsing...`);
    
    let result;
    try {
      let cleanContent = content;
      if (content.includes('```json')) {
        cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      } else if (content.includes('```')) {
        cleanContent = content.replace(/```\s*/g, '');
      }
      
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = JSON.parse(cleanContent);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw content:", content?.substring(0, 1000));
      
      // Fallback with pre-calculated values
      result = {
        tailoredResume: content || "Unable to generate tailored resume. Please try again.",
        tailoredCoverLetter: userProfile.coverLetter || "Unable to generate cover letter. Please try again.",
        matchScore: matchResult.score,
        keywordsMatched: matchResult.matched,
        keywordsMissing: matchResult.missing,
        smartLocation: smartLocation,
        suggestedImprovements: ["Please retry for better results"],
        candidateName: candidateNameForFile,
        cvFileName: `${candidateNameForFile}_CV.pdf`,
        coverLetterFileName: `${candidateNameForFile}_Cover_Letter.pdf`
      };
    }

    // Ensure all required fields with our pre-calculated values
    result.candidateName = result.candidateName || candidateNameForFile;
    result.cvFileName = result.cvFileName || `${candidateNameForFile}_CV.pdf`;
    result.coverLetterFileName = result.coverLetterFileName || `${candidateNameForFile}_Cover_Letter.pdf`;
    result.company = company;
    result.jobTitle = jobTitle;
    result.jobId = jobId;
    result.smartLocation = smartLocation;
    
    // Recalculate ACTUAL match score based on generated resume content
    const generatedResumeText = (result.tailoredResume || '').toLowerCase();
    const generatedCoverText = (result.tailoredCoverLetter || '').toLowerCase();
    const combinedGeneratedText = `${generatedResumeText} ${generatedCoverText}`;
    
    // Count how many JD keywords appear in the generated content
    const actualMatched: string[] = [];
    const actualMissing: string[] = [];
    
    for (const keyword of jdKeywords.allKeywords) {
      const keywordLower = keyword.toLowerCase();
      // Check for exact or partial match
      if (combinedGeneratedText.includes(keywordLower) || 
          combinedGeneratedText.includes(keywordLower.replace(/[.\-\/]/g, ' ')) ||
          combinedGeneratedText.includes(keywordLower.replace(/\s+/g, ''))) {
        actualMatched.push(keyword);
      } else {
        actualMissing.push(keyword);
      }
    }
    
    // Calculate actual score from generated content
    const actualScore = jdKeywords.allKeywords.length > 0 
      ? Math.round((actualMatched.length / jdKeywords.allKeywords.length) * 100)
      : matchResult.score;
    
    console.log(`ACTUAL match score from generated content: ${actualScore}% (${actualMatched.length}/${jdKeywords.allKeywords.length} keywords)`);
    if (actualMissing.length > 0) {
      console.log(`Still missing keywords: ${actualMissing.slice(0, 10).join(', ')}${actualMissing.length > 10 ? '...' : ''}`);
    }
    
    // Use actual calculated score
    result.matchScore = actualScore;
    result.keywordsMatched = actualMatched;
    result.keywordsMissing = actualMissing;
    result.matchedKeywords = actualMatched; // Alias for extension compatibility
    result.missingKeywords = actualMissing; // Alias for extension compatibility
    result.keywordAnalysis = result.keywordAnalysis || {
      hardSkills: jdKeywords.hardSkills,
      softSkills: jdKeywords.softSkills,
      tools: jdKeywords.tools,
      titles: jdKeywords.titles
    };
    
    // Validate resume and cover letter
    if (!result.tailoredResume || result.tailoredResume.length < 100) {
      console.error('Resume content missing or too short');
      result.resumeGenerationStatus = 'failed';
    } else {
      result.resumeGenerationStatus = 'success';
    }
    
    if (!result.tailoredCoverLetter || result.tailoredCoverLetter.length < 100) {
      console.error('Cover letter content missing or too short');
      result.coverLetterGenerationStatus = 'failed';
    } else {
      result.coverLetterGenerationStatus = 'success';
    }

    console.log(`Successfully tailored application. Match score: ${result.matchScore}, Resume: ${result.resumeGenerationStatus}, Cover Letter: ${result.coverLetterGenerationStatus}`);

    // --- Generate PDFs (server-side) so the extension only needs 1 backend call per job ---
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const authHeader = req.headers.get("authorization") || "";

      const candidateName = `${userProfile.firstName} ${userProfile.lastName}`.trim() || "Applicant";
      // File naming: [FirstName]_[LastName]_CV.pdf and [FirstName]_[LastName]_Cover_Letter.pdf
      const candidateNameForFile = `${userProfile.firstName.trim()}_${userProfile.lastName.trim()}`
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '') || "Applicant";

      const resumeFileName = `${candidateNameForFile}_CV.pdf`;
      const coverFileName = `${candidateNameForFile}_Cover_Letter.pdf`;

      const extractProfessionalSummary = (raw: string): string => {
        const text = String(raw || "");

        // Prefer the explicit Professional Summary section if present
        const summaryMatch = text.match(/\bPROFESSIONAL\s+SUMMARY\b\s*:?\s*([\s\S]*?)(?=\n\s*(WORK\s+EXPERIENCE|EXPERIENCE|EDUCATION|SKILLS|CERTIFICATIONS|PROJECTS|ACHIEVEMENTS)\b|$)/i);
        let summary = (summaryMatch?.[1] ?? text).trim();

        // If we fell back to the whole resume, keep it short and avoid grabbing headers
        summary = summary.replace(/\r/g, "");

        // Remove common header duplication lines (pipes, contact info, urls)
        const removeParts = [
          candidateName,
          userProfile.email,
          userProfile.phone,
          userProfile.linkedin,
          userProfile.github,
          userProfile.portfolio,
          smartLocation,
          userProfile.city,
          userProfile.country,
        ].filter(Boolean).map((s) => String(s));

        const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const removeRegex = removeParts.length ? new RegExp(removeParts.map(escaped).join("|"), "gi") : null;

        summary = summary
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .filter((l) => {
            if (/\|/.test(l) && (l.includes("http") || l.includes("@") || /\+?\d{6,}/.test(l))) return false;
            if (removeRegex && removeRegex.test(l)) {
              // Keep lines that still have substantive content after removing personal info
              const cleaned = l.replace(removeRegex, "").replace(/\s+/g, " ").trim();
              return cleaned.length >= 20;
            }
            return true;
          })
          .join(" ")
          .replace(/\s+/g, " ")
          .replace(/^PROFESSIONAL\s+SUMMARY\s*:?\s*/i, "")
          .trim();

        // Hard cap for PDF wrapping
        return summary.substring(0, 700).trim();
      };

      const skills = Array.isArray(userProfile.skills) ? userProfile.skills : [];
      const primarySkills = Array.isArray(skills)
        ? skills.filter((s: any) => s?.category === "technical" || s?.proficiency === "expert" || s?.proficiency === "advanced")
        : [];
      const secondarySkills = Array.isArray(skills)
        ? skills.filter((s: any) => s?.category !== "technical" && s?.proficiency !== "expert" && s?.proficiency !== "advanced")
        : [];

      const resumePayload = {
        type: "resume",
        candidateName: candidateNameForFile,
        customFileName: resumeFileName,
        personalInfo: {
          name: candidateName,
          email: userProfile.email,
          phone: userProfile.phone,
          location: smartLocation,
          linkedin: userProfile.linkedin,
          github: userProfile.github,
          portfolio: userProfile.portfolio,
        },
        summary: extractProfessionalSummary(result.tailoredResume || ""),
        experience: (Array.isArray(userProfile.workExperience) ? userProfile.workExperience : []).map((exp: any) => ({
          company: exp?.company || "",
          title: exp?.title || "",
          dates: exp?.dates || `${exp?.startDate || exp?.start_date || ""} – ${exp?.endDate || exp?.end_date || "Present"}`,
          bullets: Array.isArray(exp?.description)
            ? exp.description
            : typeof exp?.description === "string"
              ? exp.description.split("\n").filter((b: string) => b.trim())
              : [],
        })),
        education: (Array.isArray(userProfile.education) ? userProfile.education : []).map((edu: any) => ({
          degree: edu?.degree || "",
          school: edu?.school || edu?.institution || "",
          dates: edu?.dates || `${edu?.startDate || ""} – ${edu?.endDate || ""}`,
          gpa: edu?.gpa || "",
        })),
        skills: {
          primary: primarySkills.map((s: any) => s?.name || s).filter(Boolean),
          secondary: secondarySkills.map((s: any) => s?.name || s).filter(Boolean),
        },
        certifications: Array.isArray(userProfile.certifications) ? userProfile.certifications : [],
        achievements: (Array.isArray(userProfile.achievements) ? userProfile.achievements : []).map((a: any) => ({
          title: a?.title || "",
          date: a?.date || "",
          description: a?.description || "",
        })),
      };

      // Clean the cover letter text - remove AI-generated headers/footers that duplicate our PDF formatting
      let coverText = result.tailoredCoverLetter || "";
      
      // Remove common AI-generated letter headers that we add ourselves in the PDF
      const cleanPatterns = [
        // Remove name/email/phone/date headers at the start
        /^[\s\S]*?Dear\s+(Hiring|Recruitment|HR|Team|Manager|Committee)/i,
        // Keep "Dear..." but remove everything before it
        /^[^\n]*\n[^\n]*\n[^\n]*\nDear/i,
      ];
      
      // Find where the actual letter body starts (after "Dear...")
      const dearMatch = coverText.match(/Dear\s+(?:Hiring|Recruitment|HR|Team|Manager|Committee)[^,]*,?\s*\n/i);
      if (dearMatch && dearMatch.index !== undefined) {
        // Extract only the body after the salutation
        coverText = coverText.substring(dearMatch.index + dearMatch[0].length);
      }
      
      // Remove closing signatures - we add these ourselves
      coverText = coverText
        .replace(/\n\s*(Sincerely|Best regards|Kind regards|Regards|Warmly|Respectfully|Thank you)[,]?\s*\n[\s\S]*$/i, '')
        .replace(/\n\s*(Sincerely|Best regards|Kind regards|Regards|Warmly|Respectfully|Thank you)[,]?\s*$/i, '')
        .trim();
      
      // Split into paragraphs, filtering out very short ones and duplicate-looking content
      const rawParagraphs = coverText.split(/\n\n+/).map((p: string) => p.trim());
      const paragraphs = rawParagraphs.filter((p: string) => {
        // Skip very short paragraphs
        if (p.length < 30) return false;
        // Skip paragraphs that look like headers/signatures
        if (/^(sincerely|regards|thank you|dear|date:|re:|subject:)/i.test(p)) return false;
        // Skip lines that are just a name or contact info
        if (p.split(/\s+/).length <= 3 && !p.includes('.')) return false;
        return true;
      });

      const coverPayload = {
        type: "cover_letter",
        candidateName: candidateNameForFile,
        customFileName: coverFileName,
        personalInfo: {
          name: candidateName,
          email: userProfile.email,
          phone: userProfile.phone,
          location: smartLocation,
          linkedin: userProfile.linkedin,
          github: userProfile.github,
          portfolio: userProfile.portfolio,
        },
        coverLetter: {
          recipientCompany: company || "Company",
          jobTitle: jobTitle || "Position",
          jobId: jobId || "",
          paragraphs: paragraphs.length ? paragraphs : [coverText.trim()],
        },
      };

      const generatePdf = async (payload: any): Promise<{ pdf: string | null; fileName: string }> => {
        const pdfRes = await fetch(`${supabaseUrl}/functions/v1/generate-pdf`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            authorization: authHeader,
          },
          body: JSON.stringify(payload),
        });

        if (!pdfRes.ok) {
          const t = await pdfRes.text();
          console.error(`generate-pdf failed: ${pdfRes.status} ${t}`);
          return { pdf: null, fileName: payload.customFileName || 'document.pdf' };
        }

        // The generate-pdf function returns binary PDF data, not JSON
        // We need to convert the binary response to base64
        const contentType = pdfRes.headers.get('content-type') || '';
        const contentDisposition = pdfRes.headers.get('content-disposition') || '';
        
        // Extract filename from Content-Disposition header
        let fileName = payload.customFileName || 'document.pdf';
        const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (filenameMatch) {
          fileName = filenameMatch[1];
        }

        if (contentType.includes('application/pdf')) {
          // Binary PDF response - convert to base64
          const arrayBuffer = await pdfRes.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Convert to base64
          let binary = '';
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64 = btoa(binary);
          
          console.log(`PDF generated successfully: ${fileName}, size: ${uint8Array.length} bytes`);
          return { pdf: base64, fileName };
        } else {
          // Unexpected response type
          console.error(`Unexpected response type from generate-pdf: ${contentType}`);
          return { pdf: null, fileName };
        }
      };

      const [resumePdfResult, coverPdfResult] = await Promise.all([
        generatePdf(resumePayload),
        generatePdf(coverPayload),
      ]);

      result.resumePdf = resumePdfResult.pdf;
      result.coverLetterPdf = coverPdfResult.pdf;
      result.resumePdfFileName = resumePdfResult.fileName;
      result.coverLetterPdfFileName = coverPdfResult.fileName;
      
      console.log(`PDFs generated - Resume: ${result.resumePdf ? 'success' : 'failed'}, Cover: ${result.coverLetterPdf ? 'success' : 'failed'}`);
    } catch (pdfErr) {
      console.error("PDF generation (inline) failed:", pdfErr);
      result.resumePdf = null;
      result.coverLetterPdf = null;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Tailor application error:", error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage === 'Unauthorized: Invalid or expired token') {
      return new Response(JSON.stringify({ error: "Please log in to continue" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
