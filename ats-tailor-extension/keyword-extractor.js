// keyword-extractor.js - TF-IDF based keyword extraction for ATS matching
// Extracts up to 35 keywords from job descriptions with priority categorization

(function(global) {
  'use strict';

  // Common stop words to filter out
  const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'shall', 'can', 'need', 'this', 'that', 'these', 'those', 'it', 'its', 'we', 'you',
    'your', 'our', 'their', 'my', 'his', 'her', 'they', 'them', 'he', 'she', 'i', 'me',
    'who', 'what', 'where', 'when', 'why', 'how', 'which', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then',
    'about', 'after', 'before', 'above', 'below', 'between', 'under', 'over', 'through',
    'during', 'into', 'out', 'up', 'down', 'off', 'again', 'further', 'once', 'any',
    'work', 'working', 'job', 'position', 'role', 'team', 'company', 'opportunity',
    'looking', 'seeking', 'required', 'requirements', 'preferred', 'ability', 'able',
    'experience', 'years', 'year', 'etc', 'including', 'include', 'includes', 'new',
    'well', 'based', 'using', 'within', 'across', 'strong', 'excellent', 'good',
    'ensure', 'ensuring', 'provide', 'providing', 'support', 'supporting', 'help',
    'helping', 'develop', 'developing', 'build', 'building', 'create', 'creating',
    'understand', 'understanding', 'knowledge', 'skills', 'skill', 'candidate',
    'candidates', 'applicant', 'applicants', 'must', 'shall', 'will', 'ideally',
    'highly', 'plus', 'bonus', 'nice', 'have', 'having', 'get', 'getting', 'make',
    'making', 'take', 'taking', 'use', 'used', 'uses', 'per', 'via', 'like', 'want',
    'wants', 'wanted', 'join', 'joining', 'joined', 'lead', 'leading', 'leverage'
  ]);

  // High-value technical and business keywords to boost
  const HIGH_VALUE_KEYWORDS = new Set([
    // Programming Languages
    'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'ruby', 'go', 'rust',
    'swift', 'kotlin', 'scala', 'php', 'perl', 'r', 'matlab', 'julia',
    // Frameworks & Libraries
    'react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'spring',
    'tensorflow', 'pytorch', 'keras', 'pandas', 'numpy', 'scikit-learn', 'spark',
    // Databases
    'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'cassandra',
    'oracle', 'snowflake', 'bigquery', 'redshift', 'dynamodb', 'firebase',
    // Cloud & DevOps
    'aws', 'azure', 'gcp', 'kubernetes', 'docker', 'terraform', 'jenkins', 'ci/cd',
    'circleci', 'github', 'gitlab', 'ansible', 'puppet', 'chef', 'cloudformation',
    // Data & Analytics
    'tableau', 'powerbi', 'looker', 'excel', 'analytics', 'visualization', 'etl',
    'data warehouse', 'machine learning', 'deep learning', 'nlp', 'ai', 'ml',
    'statistics', 'regression', 'classification', 'forecasting', 'modeling',
    // Business & Soft Skills
    'agile', 'scrum', 'kanban', 'jira', 'confluence', 'stakeholder', 'communication',
    'presentation', 'leadership', 'cross-functional', 'strategic', 'analytical',
    // Industry Terms
    'saas', 'b2b', 'b2c', 'fintech', 'healthcare', 'e-commerce', 'api', 'rest',
    'graphql', 'microservices', 'architecture', 'scalability', 'optimization'
  ]);

  // Multi-word phrases to detect
  const COMMON_PHRASES = [
    'data visualization', 'machine learning', 'deep learning', 'natural language processing',
    'computer vision', 'data science', 'data analysis', 'data engineering', 'data pipeline',
    'business intelligence', 'business analyst', 'product management', 'project management',
    'software development', 'software engineering', 'full stack', 'front end', 'back end',
    'cloud computing', 'cloud infrastructure', 'continuous integration', 'continuous deployment',
    'version control', 'unit testing', 'integration testing', 'test automation',
    'agile methodology', 'scrum master', 'product owner', 'user experience', 'user interface',
    'customer success', 'account management', 'sales operations', 'marketing automation',
    'financial analysis', 'financial modeling', 'risk management', 'supply chain',
    'cross functional', 'stakeholder management', 'problem solving', 'critical thinking',
    'attention to detail', 'time management', 'team collaboration', 'remote work'
  ];

  /**
   * Clean and normalize text for processing
   */
  function cleanText(text) {
    if (!text) return '';
    
    // Remove HTML tags
    let cleaned = text.replace(/<[^>]*>/g, ' ');
    
    // Replace common separators with spaces
    cleaned = cleaned.replace(/[•\-–—|\/\\:;,]/g, ' ');
    
    // Remove special characters except alphanumeric, spaces, and some punctuation
    cleaned = cleaned.replace(/[^a-zA-Z0-9\s\+\#\.]/g, ' ');
    
    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned.toLowerCase();
  }

  /**
   * Tokenize text into words
   */
  function tokenize(text) {
    return text.split(/\s+/).filter(word => 
      word.length >= 2 && 
      !STOP_WORDS.has(word) &&
      !/^\d+$/.test(word)
    );
  }

  /**
   * Extract multi-word phrases from text
   */
  function extractPhrases(text) {
    const foundPhrases = [];
    const lowerText = text.toLowerCase();
    
    for (const phrase of COMMON_PHRASES) {
      if (lowerText.includes(phrase)) {
        foundPhrases.push({
          term: phrase,
          frequency: (lowerText.match(new RegExp(phrase, 'g')) || []).length,
          isPhrase: true
        });
      }
    }
    
    return foundPhrases;
  }

  /**
   * Calculate term frequency
   */
  function calculateTF(tokens) {
    const tf = {};
    const totalTerms = tokens.length;
    
    tokens.forEach(token => {
      tf[token] = (tf[token] || 0) + 1;
    });
    
    // Normalize by total terms
    Object.keys(tf).forEach(term => {
      tf[term] = tf[term] / totalTerms;
    });
    
    return tf;
  }

  /**
   * Calculate inverse document frequency weight (simplified for single doc)
   * Uses word length and high-value keyword boost
   */
  function calculateIDF(term) {
    let score = 1.0;
    
    // Boost for longer terms (more specific)
    if (term.length >= 8) score *= 1.5;
    else if (term.length >= 6) score *= 1.2;
    
    // Boost for high-value keywords
    if (HIGH_VALUE_KEYWORDS.has(term)) score *= 2.0;
    
    // Boost for terms with numbers or special chars (often technical)
    if (/\d/.test(term) || /[\+\#]/.test(term)) score *= 1.3;
    
    return score;
  }

  /**
   * Extract keywords using TF-IDF ranking
   * @param {string} jobDescription - The job description text
   * @param {number} maxKeywords - Maximum keywords to extract (default 35)
   * @returns {Object} Keywords categorized by priority
   */
  function extractKeywords(jobDescription, maxKeywords = 35) {
    if (!jobDescription || typeof jobDescription !== 'string') {
      return { all: [], highPriority: [], mediumPriority: [], lowPriority: [], total: 0 };
    }

    const cleaned = cleanText(jobDescription);
    const tokens = tokenize(cleaned);
    
    // Extract phrases first
    const phrases = extractPhrases(cleaned);
    
    // Calculate TF for single words
    const tf = calculateTF(tokens);
    
    // Calculate TF-IDF scores
    const scores = [];
    
    Object.keys(tf).forEach(term => {
      const tfidf = tf[term] * calculateIDF(term);
      scores.push({
        term,
        score: tfidf,
        frequency: Math.round(tf[term] * tokens.length),
        isPhrase: false
      });
    });
    
    // Add phrases with boosted scores
    phrases.forEach(phrase => {
      scores.push({
        term: phrase.term,
        score: phrase.frequency * 3.0, // Phrases get high boost
        frequency: phrase.frequency,
        isPhrase: true
      });
    });
    
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    
    // Remove duplicates (phrases might contain single words)
    const seen = new Set();
    const unique = [];
    
    for (const item of scores) {
      const normalized = item.term.toLowerCase().replace(/\s+/g, '');
      if (!seen.has(normalized)) {
        seen.add(normalized);
        // Also mark individual words from phrases as seen
        if (item.isPhrase) {
          item.term.split(' ').forEach(word => seen.add(word));
        }
        unique.push(item);
      }
    }
    
    // Take top keywords up to max
    const topKeywords = unique.slice(0, maxKeywords);
    
    // Categorize by priority
    const highCount = Math.min(15, Math.ceil(topKeywords.length * 0.4));
    const mediumCount = Math.min(10, Math.ceil(topKeywords.length * 0.35));
    
    const highPriority = topKeywords.slice(0, highCount).map(k => k.term);
    const mediumPriority = topKeywords.slice(highCount, highCount + mediumCount).map(k => k.term);
    const lowPriority = topKeywords.slice(highCount + mediumCount).map(k => k.term);
    
    return {
      all: topKeywords.map(k => k.term),
      highPriority,
      mediumPriority,
      lowPriority,
      total: topKeywords.length,
      details: topKeywords.map(k => ({
        term: k.term,
        score: Math.round(k.score * 100) / 100,
        frequency: k.frequency,
        isPhrase: k.isPhrase
      }))
    };
  }

  /**
   * Check which keywords are present in CV text
   * @param {string} cvText - The CV/resume text
   * @param {Array} keywords - Array of keywords to check
   * @returns {Object} Matched and missing keywords with match score
   */
  function matchKeywords(cvText, keywords) {
    if (!cvText || !keywords || !keywords.length) {
      return { matched: [], missing: [], matchScore: 0, matchCount: 0 };
    }
    
    const cvLower = cvText.toLowerCase();
    const matched = [];
    const missing = [];
    
    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      // Check for exact match or word boundary match
      const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(cvLower)) {
        matched.push(keyword);
      } else {
        missing.push(keyword);
      }
    });
    
    const matchScore = keywords.length > 0 
      ? Math.round((matched.length / keywords.length) * 100) 
      : 0;
    
    return {
      matched,
      missing,
      matchScore,
      matchCount: matched.length,
      totalKeywords: keywords.length
    };
  }

  /**
   * Full analysis: extract keywords from job and match against CV
   */
  function analyzeMatch(jobDescription, cvText, maxKeywords = 35) {
    const extracted = extractKeywords(jobDescription, maxKeywords);
    const matchResult = matchKeywords(cvText, extracted.all);
    
    // Categorize matched and missing by priority
    const categorizedMatched = {
      high: extracted.highPriority.filter(k => matchResult.matched.includes(k)),
      medium: extracted.mediumPriority.filter(k => matchResult.matched.includes(k)),
      low: extracted.lowPriority.filter(k => matchResult.matched.includes(k))
    };
    
    const categorizedMissing = {
      high: extracted.highPriority.filter(k => matchResult.missing.includes(k)),
      medium: extracted.mediumPriority.filter(k => matchResult.missing.includes(k)),
      low: extracted.lowPriority.filter(k => matchResult.missing.includes(k))
    };
    
    return {
      keywords: extracted,
      match: matchResult,
      categorizedMatched,
      categorizedMissing
    };
  }

  // Export functions
  global.KeywordExtractor = {
    extractKeywords,
    matchKeywords,
    analyzeMatch,
    cleanText,
    HIGH_VALUE_KEYWORDS,
    STOP_WORDS
  };

})(typeof window !== 'undefined' ? window : global);
