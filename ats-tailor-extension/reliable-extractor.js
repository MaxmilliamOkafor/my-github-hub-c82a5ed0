// reliable-extractor.js - Category-Aware Keyword Extraction with JD-Only Constraint
// Handles de-clustering, phrase detection, section weighting, and persistent learning

(function(global) {
  'use strict';

  // ============ CATEGORY DEFINITIONS ============
  
  const CATEGORY = {
    PROGRAMMING_LANGUAGE: 'programmingLanguage',
    DATA_TOOL: 'dataTool',
    CRM_TOOL: 'crmTool',
    SECURITY_TOOL: 'securityTool',
    CLOUD_DEVOPS: 'cloudDevOps',
    HARD_SKILL: 'hardSkill',
    SOFT_SKILL: 'softSkill'
  };

  // ============ CATEGORY SEED LISTS ============
  
  const PROGRAMMING_LANGUAGES = new Set([
    'python', 'java', 'javascript', 'typescript', 'c', 'c++', 'c#', 'go', 'golang',
    'rust', 'ruby', 'php', 'r', 'scala', 'kotlin', 'swift', 'perl', 'sql', 'bash',
    'powershell', 'matlab', 'vba', 'groovy', 'dart', 'lua', 'elixir', 'clojure'
  ]);

  const DATA_TOOLS = new Set([
    'tableau', 'power bi', 'powerbi', 'looker', 'snowflake', 'redshift', 'bigquery',
    'pandas', 'numpy', 'matplotlib', 'excel', 'google sheets', 'airflow', 'dbt',
    'power query', 'ssrs', 'ssis', 'spss', 'sas', 'alteryx', 'qlik', 'qlikview',
    'qliksense', 'metabase', 'grafana', 'splunk', 'datadog', 'spark', 'hadoop',
    'kafka', 'elasticsearch', 'mongodb', 'postgresql', 'mysql', 'redis', 'dynamodb'
  ]);

  const CRM_TOOLS = new Set([
    'salesforce', 'hubspot', 'zendesk', 'zoho', 'dynamics 365', 'intercom',
    'gainsight', 'jira service management', 'freshdesk', 'pipedrive', 'monday',
    'asana', 'notion', 'airtable', 'servicenow', 'workday', 'netsuite', 'sap',
    'oracle', 'marketo', 'pardot', 'mailchimp', 'klaviyo', 'segment', 'mixpanel'
  ]);

  const SECURITY_TOOLS = new Set([
    'cybersecurity', 'soc', 'siem', 'splunk', 'endpoint security', 'edr', 'xdr',
    'incident response', 'threat hunting', 'vulnerability management',
    'security awareness training', 'phishing simulation', 'penetration testing',
    'firewall', 'ids', 'ips', 'crowdstrike', 'palo alto', 'fortinet', 'okta',
    'auth0', 'aws iam', 'azure ad', 'active directory', 'ldap', 'sso', 'mfa',
    'gdpr', 'hipaa', 'pci', 'iso 27001', 'nist', 'sox', 'compliance'
  ]);

  const CLOUD_DEVOPS = new Set([
    'aws', 'azure', 'gcp', 'google cloud', 'kubernetes', 'k8s', 'docker',
    'terraform', 'ansible', 'jenkins', 'gitlab', 'github actions', 'ci/cd',
    'circleci', 'travis', 'argo', 'helm', 'prometheus', 'grafana', 'linux',
    'nginx', 'apache', 'cloudformation', 'arm templates', 'pulumi', 'vagrant',
    'serverless', 'lambda', 'api gateway', 'cloudfront', 's3', 'ec2', 'rds'
  ]);

  const HARD_SKILLS = new Set([
    'data analysis', 'data visualization', 'etl', 'reporting', 'requirements gathering',
    'stakeholder management', 'project management', 'process improvement', 'a/b testing',
    'statistical analysis', 'experimentation', 'forecasting', 'account management',
    'customer success', 'partner success', 'renewals', 'expansion', 'negotiation',
    'upsell', 'onboarding', 'enablement', 'health monitoring', 'qbr',
    'quarterly business review', 'pipeline management', 'revenue operations',
    'financial modeling', 'budgeting', 'contract negotiation', 'vendor management',
    'product management', 'scrum', 'agile', 'kanban', 'lean', 'six sigma',
    'machine learning', 'deep learning', 'nlp', 'computer vision', 'ai',
    'api development', 'rest api', 'graphql', 'microservices', 'system design'
  ]);

  const SOFT_SKILLS = new Set([
    'communication', 'written communication', 'verbal communication',
    'relationship-building', 'relationship building', 'relationship-driven',
    'negotiation', 'empathy', 'stakeholder management', 'problem-solving',
    'problem solving', 'critical thinking', 'attention to detail',
    'results-oriented', 'results oriented', 'results-oriented mindset',
    'ownership', 'adaptability', 'teamwork', 'leadership', 'time management',
    'multi-tasking', 'multitasking', 'organized', 'self-motivated', 'self-starter',
    'comfort working independently', 'working independently', 'autonomous',
    'cross-functional', 'cross functional', 'collaboration', 'presentation skills',
    'analytical', 'strategic thinking', 'creative', 'proactive', 'initiative'
  ]);

  // ============ SKILL DICTIONARY (For De-clustering) ============
  
  const SKILL_DICTIONARY = new Set([
    // Merge all category sets
    ...PROGRAMMING_LANGUAGES,
    ...DATA_TOOLS,
    ...CRM_TOOLS,
    ...SECURITY_TOOLS,
    ...CLOUD_DEVOPS,
    ...HARD_SKILLS,
    ...SOFT_SKILLS,
    // Additional common terms for de-clustering
    'management', 'communication', 'relationship', 'building', 'results', 'oriented',
    'mindset', 'organized', 'multi-tasker', 'multitasker', 'comfort', 'comfortable',
    'independently', 'collaboration', 'presentation', 'written', 'verbal',
    'interpersonal', 'customer-facing', 'stakeholder', 'prioritization',
    'saas', 'crm', 'api', 'rest', 'graphql', 'agile', 'scrum', 'kanban',
    'revenue', 'quota', 'pipeline', 'forecast', 'metrics', 'kpi', 'roi', 'budget',
    'contract', 'procurement', 'vendor', 'enterprise', 'smb', 'mid-market', 'startup',
    'fit', 'experience', 'years', 'degree', 'bachelor', 'master', 'certification',
    'customer', 'success', 'account', 'partner', 'channel', 'msp', 'reseller',
    'security', 'awareness', 'training', 'phishing', 'compliance', 'incident', 'response'
  ]);

  // ============ PHRASE LIBRARY ============
  
  const PHRASE_LIBRARY = [
    // Customer Success / Partner Success
    'customer success', 'customer success manager', 'partner success', 'partner success manager',
    'account management', 'account manager', 'account executive', 'customer experience',
    'client success', 'client relationship', 'customer retention', 'customer onboarding',
    'customer lifecycle', 'customer health', 'churn prevention', 'net promoter score',
    
    // Security
    'security awareness training', 'security awareness', 'cybersecurity awareness',
    'incident response', 'threat detection', 'vulnerability management', 'security operations',
    'managed security', 'security posture', 'risk management', 'compliance management',
    'penetration testing', 'security audit', 'soc analyst', 'security engineer',
    
    // SaaS / Tech
    'saas platform', 'cloud platform', 'software as a service', 'platform as a service',
    'managed service provider', 'channel partner', 'technology partner', 'integration partner',
    'api integration', 'system integration', 'enterprise software', 'b2b saas',
    
    // Skills
    'relationship building', 'relationship-building', 'results oriented', 'results-oriented',
    'results oriented mindset', 'results-oriented mindset', 'detail oriented', 'detail-oriented',
    'working independently', 'work independently', 'comfort working independently',
    'comfortable working independently', 'self-motivated', 'self-starter', 'fast learner',
    'quick learner', 'strong communicator', 'excellent communication', 'written communication',
    'verbal communication', 'cross-functional', 'cross functional', 'decision making',
    'decision-making', 'problem solving', 'problem-solving', 'critical thinking',
    'time management', 'project management', 'stakeholder management', 'change management',
    
    // Business
    'quarterly business review', 'qbr', 'business development', 'sales cycle',
    'customer lifecycle', 'revenue growth', 'pipeline management', 'quota attainment',
    'renewals management', 'expansion revenue', 'upsell opportunities', 'cross-sell',
    'contract negotiation', 'enterprise sales', 'solution selling', 'consultative selling',
    
    // Tech tools & concepts
    'salesforce crm', 'crm software', 'crm platform', 'data analysis', 'data analytics',
    'business intelligence', 'reporting tools', 'excel proficiency', 'google suite',
    'microsoft office', 'presentation skills', 'machine learning', 'deep learning',
    'data science', 'data engineering', 'software development', 'full stack',
    'front end', 'back end', 'devops', 'site reliability', 'cloud architecture'
  ];

  // ============ SECTION WEIGHTS ============
  
  const SECTION_WEIGHTS = {
    'responsibilities': 1.2,
    'what you\'ll do': 1.2,
    'your role': 1.2,
    'requirements': 1.4,
    'qualifications': 1.4,
    'what you bring': 1.4,
    'must have': 1.4,
    'required': 1.3,
    'preferred': 1.0,
    'nice to have': 0.9,
    'bonus': 0.8,
    'benefits': 0.3,
    'about us': 0.4,
    'about the company': 0.4,
    'who we are': 0.4,
    'perks': 0.3,
    'legal': 0.2,
    'equal opportunity': 0.1
  };

  // ============ BLACKLISTS ============
  
  const NOISE_BLACKLIST = new Set([
    // Generic job posting words
    'remote', 'hybrid', 'office', 'work', 'team', 'culture', 'apply', 'application',
    'bonus', 'salary', 'benefits', 'perks', 'hiring', 'career', 'job', 'position',
    'role', 'opportunity', 'company', 'organization', 'employer', 'employee', 'candidate',
    'reimbursement', 'accommodations', 'accommodation', 'discriminate', 'privacy',
    'background check', 'drug test', 'visa', 'sponsorship', 'relocation',
    
    // Common verbs/actions (not skills)
    'looking', 'seeking', 'required', 'requirements', 'preferred', 'ability', 'able',
    'etc', 'including', 'include', 'includes', 'new', 'well', 'based', 'using', 'within',
    'across', 'strong', 'excellent', 'good', 'ensure', 'ensuring', 'provide', 'providing',
    'support', 'help', 'helping', 'develop', 'developing', 'build', 'building', 'create',
    'understand', 'understanding', 'knowledge', 'skills', 'skill', 'must', 'shall',
    'ideally', 'highly', 'plus', 'nice', 'have', 'having', 'get', 'getting', 'make',
    'making', 'take', 'taking', 'use', 'used', 'uses', 'per', 'via', 'like', 'want',
    'wants', 'wanted', 'join', 'joining', 'joined', 'lead', 'leading', 'leverage',
    'please', 'review', 'name', 'status', 'process', 'personal', 'fully', 'human',
    'go', 'match', 'tools', 'businesses', 'hackers', 'profile', 'keywords', 'operations',
    
    // Stop words
    'the', 'and', 'for', 'with', 'our', 'you', 'your', 'this', 'that', 'these',
    'those', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'having',
    'does', 'did', 'doing', 'would', 'should', 'could', 'may', 'might', 'can',
    'will', 'shall', 'need', 'needs', 'from', 'into', 'over', 'under', 'about',
    'after', 'before', 'between', 'through', 'during', 'above', 'below', 'such',
    'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'any', 'all',
    'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also', 'now', 'here',
    'there', 'then', 'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom',
    
    // Business buzzwords (not ATS keywords)
    'passionate', 'dynamic', 'innovative', 'fast-paced', 'collaborative', 'driven',
    'motivated', 'team-player', 'hands-on', 'scale', 'grow', 'growth',
    'impact', 'mission', 'vision', 'values', 'diverse', 'inclusive', 'equal'
  ]);

  // ============ PERSISTENT LEARNING STORAGE ============
  
  const STORAGE_KEY = 'ats_tailor_known_keywords_v2';
  let LEARNED_KEYWORDS = new Map(); // keyword -> { categories, frequency, lastSeen }

  function loadLearnedKeywords() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          if (result[STORAGE_KEY]) {
            LEARNED_KEYWORDS = new Map(Object.entries(result[STORAGE_KEY]));
          }
        });
      } else if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          LEARNED_KEYWORDS = new Map(Object.entries(JSON.parse(stored)));
        }
      }
    } catch (e) {
      console.warn('Failed to load learned keywords:', e);
    }
  }

  function saveLearnedKeywords() {
    try {
      const obj = Object.fromEntries([...LEARNED_KEYWORDS].slice(0, 500));
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ [STORAGE_KEY]: obj });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      }
    } catch (e) {
      console.warn('Failed to save learned keywords:', e);
    }
  }

  function learnKeyword(keyword, categories = []) {
    const lower = keyword.toLowerCase().trim();
    if (lower.length < 3 || lower.length > 35 || NOISE_BLACKLIST.has(lower)) return;
    
    const existing = LEARNED_KEYWORDS.get(lower) || { categories: [], frequency: 0 };
    existing.frequency++;
    existing.lastSeen = Date.now();
    existing.categories = [...new Set([...existing.categories, ...categories])];
    LEARNED_KEYWORDS.set(lower, existing);
  }

  function getLearnedBoost(keyword) {
    const data = LEARNED_KEYWORDS.get(keyword.toLowerCase());
    if (!data) return 1.0;
    // Boost based on frequency (max 2.0x)
    return Math.min(2.0, 1.0 + (data.frequency * 0.1));
  }

  // Initialize on load
  loadLearnedKeywords();

  // ============ DE-CLUSTERING LOGIC ============

  function looksClustered(token) {
    if (!token || token.length < 15) return false;
    
    const lower = token.toLowerCase();
    let matchCount = 0;
    
    for (const skill of SKILL_DICTIONARY) {
      if (skill.length >= 4 && lower.includes(skill)) {
        matchCount++;
        if (matchCount >= 2) return true;
      }
    }
    
    if (/[a-z]{4,}\.[a-z]{4,}/i.test(token)) return true;
    if (/[a-z]{3,}[A-Z][a-z]{3,}/.test(token)) return true;
    
    return false;
  }

  function decluster(token) {
    if (!token || token.length < 10) return [token];
    
    const lower = token.toLowerCase();
    const found = [];
    let remaining = lower.replace(/\./g, ' ').replace(/,/g, ' ');
    
    const sortedSkills = [...SKILL_DICTIONARY]
      .filter(s => s.length >= 3)
      .sort((a, b) => b.length - a.length);
    
    for (const skill of sortedSkills) {
      const idx = remaining.indexOf(skill);
      if (idx !== -1) {
        found.push(skill);
        remaining = remaining.replace(skill, ' ');
      }
    }
    
    const leftover = remaining.split(/\s+/).filter(w => 
      w.length >= 3 && !NOISE_BLACKLIST.has(w)
    );
    found.push(...leftover);
    
    const unique = [...new Set(found)].filter(s => s.length >= 3);
    return unique.length > 0 ? unique : [token];
  }

  function declusterText(text) {
    if (!text) return '';
    
    const tokens = text.split(/\s+/);
    const processed = [];
    
    tokens.forEach(token => {
      if (looksClustered(token)) {
        processed.push(...decluster(token));
      } else {
        processed.push(token);
      }
    });
    
    return processed.join(' ');
  }

  // ============ CATEGORY DETECTION ============

  function detectCategories(term) {
    const lower = term.toLowerCase().replace(/-/g, ' ').trim();
    const categories = [];
    
    if (PROGRAMMING_LANGUAGES.has(lower)) categories.push(CATEGORY.PROGRAMMING_LANGUAGE);
    if (DATA_TOOLS.has(lower)) categories.push(CATEGORY.DATA_TOOL);
    if (CRM_TOOLS.has(lower)) categories.push(CATEGORY.CRM_TOOL);
    if (SECURITY_TOOLS.has(lower)) categories.push(CATEGORY.SECURITY_TOOL);
    if (CLOUD_DEVOPS.has(lower)) categories.push(CATEGORY.CLOUD_DEVOPS);
    if (HARD_SKILLS.has(lower)) categories.push(CATEGORY.HARD_SKILL);
    if (SOFT_SKILLS.has(lower)) categories.push(CATEGORY.SOFT_SKILL);
    
    // Check phrase library
    if (PHRASE_LIBRARY.some(p => p.toLowerCase() === lower)) {
      if (!categories.length) categories.push(CATEGORY.HARD_SKILL);
    }
    
    // Check learned keywords
    const learned = LEARNED_KEYWORDS.get(lower);
    if (learned?.categories?.length) {
      categories.push(...learned.categories);
    }
    
    return [...new Set(categories)];
  }

  function getCategoryBoost(categories) {
    let boost = 1.0;
    
    // Technical categories get higher boost
    if (categories.includes(CATEGORY.PROGRAMMING_LANGUAGE)) boost *= 1.4;
    if (categories.includes(CATEGORY.CLOUD_DEVOPS)) boost *= 1.3;
    if (categories.includes(CATEGORY.SECURITY_TOOL)) boost *= 1.3;
    if (categories.includes(CATEGORY.DATA_TOOL)) boost *= 1.2;
    if (categories.includes(CATEGORY.CRM_TOOL)) boost *= 1.2;
    if (categories.includes(CATEGORY.HARD_SKILL)) boost *= 1.1;
    if (categories.includes(CATEGORY.SOFT_SKILL)) boost *= 1.0;
    
    return boost;
  }

  // ============ SECTION DETECTION ============

  function detectSectionWeight(text, position, totalLength) {
    const lower = text.toLowerCase();
    
    // Check for section headers
    for (const [section, weight] of Object.entries(SECTION_WEIGHTS)) {
      if (lower.includes(section)) {
        return weight;
      }
    }
    
    // Position-based weighting (middle of JD often has requirements)
    const relativePosition = position / totalLength;
    if (relativePosition > 0.2 && relativePosition < 0.7) {
      return 1.2; // Middle section likely has requirements
    }
    
    return 1.0;
  }

  // ============ PHRASE DETECTION ============

  function extractKnownPhrases(text, jdTokensSet) {
    if (!text) return [];
    
    const lower = text.toLowerCase();
    const found = [];
    
    const sortedPhrases = [...PHRASE_LIBRARY].sort((a, b) => b.length - a.length);
    
    for (const phrase of sortedPhrases) {
      const normalizedPhrase = phrase.toLowerCase();
      if (lower.includes(normalizedPhrase)) {
        // JD-ONLY CONSTRAINT: Only add if phrase words are in jdTokensSet
        if (!jdTokensSet || phraseWordsInJD(normalizedPhrase, jdTokensSet)) {
          found.push(phrase);
        }
      }
    }
    
    return [...new Set(found)];
  }

  function phraseWordsInJD(phrase, jdTokensSet) {
    const words = phrase.split(/\s+/);
    return words.every(w => jdTokensSet.has(w.toLowerCase()));
  }

  // ============ VALIDATION ============

  function isReliableKeyword(word) {
    if (!word || typeof word !== 'string') return false;
    
    const normalized = word.toLowerCase().trim();
    
    if (normalized.length < 3 || normalized.length > 35) return false;
    if (!/^[a-zA-Z][a-zA-Z0-9\-\+\#\.\s\/]*[a-zA-Z0-9]?$/.test(word)) return false;
    if (NOISE_BLACKLIST.has(normalized)) return false;
    if (/^\d+$/.test(word)) return false;
    if (looksClustered(word)) return false;
    
    return true;
  }

  // ============ JD TOKEN SET BUILDER ============

  function buildJDTokenSet(text) {
    const tokens = new Set();
    const lower = text.toLowerCase();
    
    // Add individual words
    lower.split(/\s+/).forEach(w => {
      const clean = w.replace(/[^a-z0-9\-\+\#]/g, '');
      if (clean.length >= 2) tokens.add(clean);
    });
    
    // Add common variations
    tokens.forEach(t => {
      // Add singular/plural
      if (t.endsWith('s') && t.length > 3) tokens.add(t.slice(0, -1));
      if (!t.endsWith('s') && t.length > 2) tokens.add(t + 's');
      // Add hyphen variants
      if (t.includes('-')) tokens.add(t.replace(/-/g, ' '));
      if (!t.includes('-') && t.includes(' ')) tokens.add(t.replace(/\s+/g, '-'));
    });
    
    return tokens;
  }

  // ============ CORE EXTRACTION ============

  function extractCandidates(text, jdTokensSet) {
    const candidates = new Map(); // term -> { term, frequency, sectionWeight, categories, inJD }
    const declustered = declusterText(text);
    const lower = declustered.toLowerCase();
    const totalLength = lower.length;
    
    // Step 1: Extract known phrases (highest priority)
    const phrases = extractKnownPhrases(declustered, jdTokensSet);
    phrases.forEach(phrase => {
      const phraseLower = phrase.toLowerCase();
      if (jdTokensSet.has(phraseLower) || phraseWordsInJD(phraseLower, jdTokensSet)) {
        candidates.set(phraseLower, {
          term: phrase,
          frequency: 1,
          sectionWeight: 1.3,
          categories: detectCategories(phrase),
          inJD: true
        });
      }
    });
    
    // Step 2: Extract technical patterns
    const techPatterns = [
      /\b(?:python|java|javascript|typescript|c\+\+|c#|ruby|golang?|rust|scala|kotlin|swift|php|perl|sql)\b/gi,
      /\b(?:react|angular|vue|node\.?js|django|flask|spring|rails|express|next\.?js)\b/gi,
      /\b(?:aws|azure|gcp|docker|kubernetes|k8s|terraform|ansible|jenkins|ci\/cd)\b/gi,
      /\b(?:salesforce|hubspot|zendesk|jira|confluence|tableau|powerbi|looker|excel)\b/gi,
      /\b(?:cybersecurity|siem|soc|firewall|endpoint|penetration|compliance|gdpr|hipaa)\b/gi,
      /\b(?:saas|crm|erp|api|rest|graphql|agile|scrum|kanban|kpi|roi)\b/gi,
      /\b[a-z]+[\-][a-z]+(?:[\-][a-z]+)*/gi // hyphenated terms
    ];
    
    techPatterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(declustered)) !== null) {
        const term = match[0].toLowerCase();
        if (isReliableKeyword(term) && jdTokensSet.has(term)) {
          const existing = candidates.get(term) || {
            term: match[0],
            frequency: 0,
            sectionWeight: detectSectionWeight(declustered, match.index, totalLength),
            categories: detectCategories(term),
            inJD: true
          };
          existing.frequency++;
          candidates.set(term, existing);
        }
      }
    });
    
    // Step 3: Extract individual words
    const words = declustered.split(/\s+/);
    words.forEach((word, idx) => {
      const clean = word.replace(/[^a-zA-Z0-9\-\+\#\.]/g, '').toLowerCase();
      if (isReliableKeyword(clean) && jdTokensSet.has(clean)) {
        const existing = candidates.get(clean) || {
          term: clean,
          frequency: 0,
          sectionWeight: detectSectionWeight(declustered, idx / words.length * totalLength, totalLength),
          categories: detectCategories(clean),
          inJD: true
        };
        existing.frequency++;
        candidates.set(clean, existing);
      }
    });
    
    return candidates;
  }

  function scoreCandidates(candidates) {
    const scored = [];
    
    candidates.forEach((data, key) => {
      // CRITICAL: JD-only constraint
      if (!data.inJD) return;
      
      const baseFreq = Math.log2(1 + data.frequency) / Math.log2(10); // Normalize frequency
      const sectionFactor = data.sectionWeight || 1.0;
      const categoryBoost = getCategoryBoost(data.categories);
      const learnedBoost = getLearnedBoost(data.term);
      
      const score = baseFreq * sectionFactor * categoryBoost * learnedBoost;
      
      scored.push({
        term: data.term,
        score,
        categories: data.categories,
        frequency: data.frequency
      });
    });
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    return scored;
  }

  function categorizeByType(keywords) {
    const categorized = {
      programmingLanguages: [],
      dataTools: [],
      crmTools: [],
      securityTools: [],
      cloudDevOps: [],
      hardSkills: [],
      softSkills: []
    };
    
    keywords.forEach(kw => {
      const term = typeof kw === 'string' ? kw : kw.term;
      const cats = typeof kw === 'object' ? kw.categories : detectCategories(term);
      
      if (cats.includes(CATEGORY.PROGRAMMING_LANGUAGE)) categorized.programmingLanguages.push(term);
      if (cats.includes(CATEGORY.DATA_TOOL)) categorized.dataTools.push(term);
      if (cats.includes(CATEGORY.CRM_TOOL)) categorized.crmTools.push(term);
      if (cats.includes(CATEGORY.SECURITY_TOOL)) categorized.securityTools.push(term);
      if (cats.includes(CATEGORY.CLOUD_DEVOPS)) categorized.cloudDevOps.push(term);
      if (cats.includes(CATEGORY.HARD_SKILL)) categorized.hardSkills.push(term);
      if (cats.includes(CATEGORY.SOFT_SKILL)) categorized.softSkills.push(term);
    });
    
    return categorized;
  }

  // ============ MAIN EXTRACTION FUNCTION ============

  function extractReliableKeywords(rawText, maxKeywords = 35) {
    if (!rawText || typeof rawText !== 'string') {
      return { 
        all: [], highPriority: [], mediumPriority: [], lowPriority: [], 
        total: 0, categorized: categorizeByType([])
      };
    }

    // Check cache
    let parsed;
    if (global.UniversalJDParser) {
      const cacheKey = global.UniversalJDParser.getCacheKey(rawText);
      const cached = global.UniversalJDParser.getCached(
        cacheKey + '_keywords_v3', 
        global.UniversalJDParser.KEYWORD_CACHE
      );
      if (cached) return cached;
      
      parsed = global.UniversalJDParser.processAnyJobDescription(rawText);
    } else {
      const temp = document.createElement('div');
      temp.innerHTML = rawText;
      parsed = {
        text: temp.textContent || rawText,
        structure: 'raw_text',
        sections: {}
      };
    }

    // Build JD token set for constraint checking
    const jdTokensSet = buildJDTokenSet(parsed.text);
    
    // Extract and score candidates
    const candidates = extractCandidates(parsed.text, jdTokensSet);
    const scored = scoreCandidates(candidates);
    
    // Take top keywords
    const topKeywords = scored.slice(0, maxKeywords);
    const terms = topKeywords.map(k => k.term);
    
    // Learn high-scoring keywords
    topKeywords.slice(0, 20).forEach(kw => {
      learnKeyword(kw.term, kw.categories);
    });
    if (Math.random() < 0.1) saveLearnedKeywords();
    
    // Build priority lists
    const highCount = Math.min(15, Math.ceil(terms.length * 0.45));
    const mediumCount = Math.min(10, Math.ceil(terms.length * 0.35));
    
    const result = {
      all: terms,
      highPriority: terms.slice(0, highCount),
      mediumPriority: terms.slice(highCount, highCount + mediumCount),
      lowPriority: terms.slice(highCount + mediumCount),
      total: terms.length,
      categorized: categorizeByType(topKeywords)
    };
    
    // Cache result
    if (global.UniversalJDParser) {
      const cacheKey = global.UniversalJDParser.getCacheKey(rawText);
      global.UniversalJDParser.setCache(
        cacheKey + '_keywords_v3', 
        result, 
        global.UniversalJDParser.KEYWORD_CACHE
      );
    }
    
    return result;
  }

  // ============ KEYWORD MATCHING ============

  function matchKeywords(cvText, keywords) {
    if (!cvText || !keywords) {
      const kwList = Array.isArray(keywords) ? keywords : (keywords?.all || []);
      return { matched: [], missing: kwList, matchScore: 0, matchCount: 0 };
    }

    const kwList = Array.isArray(keywords) ? keywords : (keywords.all || []);
    const cvLower = cvText.toLowerCase();
    const matched = [];
    const missing = [];

    kwList.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      const regex = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, 'i');
      
      if (regex.test(cvLower)) {
        matched.push(keyword);
      } else {
        missing.push(keyword);
      }
    });

    return {
      matched,
      missing,
      matchScore: kwList.length > 0 ? Math.round((matched.length / kwList.length) * 100) : 0,
      matchCount: matched.length,
      totalKeywords: kwList.length
    };
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ============ EXPORTS ============
  
  global.ReliableExtractor = {
    // Main functions
    extractReliableKeywords,
    matchKeywords,
    
    // Validation
    isReliableKeyword,
    
    // Categories
    CATEGORY,
    detectCategories,
    getCategoryBoost,
    categorizeByType,
    
    // De-clustering
    looksClustered,
    decluster,
    declusterText,
    
    // Phrase detection
    extractKnownPhrases,
    PHRASE_LIBRARY,
    SKILL_DICTIONARY,
    
    // Section detection
    detectSectionWeight,
    SECTION_WEIGHTS,
    
    // Learning
    learnKeyword,
    loadLearnedKeywords,
    saveLearnedKeywords,
    getLearnedKeywords: () => [...LEARNED_KEYWORDS.entries()],
    getLearnedBoost,
    
    // JD constraint
    buildJDTokenSet
  };

  // Backward compatibility
  global.KeywordExtractor = global.KeywordExtractor || {};
  global.KeywordExtractor.extractKeywords = extractReliableKeywords;
  global.KeywordExtractor.matchKeywords = matchKeywords;

})(typeof window !== 'undefined' ? window : global);
