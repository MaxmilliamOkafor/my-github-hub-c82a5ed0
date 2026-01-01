// cv-tailor.js - CV Tailoring Logic for 95%+ ATS Keyword Match
// Rewrites resume sections to naturally inject extracted keywords

(function(global) {
  'use strict';

  /**
   * CV Section templates for keyword injection
   */
  const SECTION_PATTERNS = {
    summary: /^(PROFESSIONAL\s*SUMMARY|SUMMARY|PROFILE|OBJECTIVE|ABOUT\s*ME|CAREER\s*SUMMARY)[\s:]*$/im,
    experience: /^(EXPERIENCE|WORK\s*EXPERIENCE|PROFESSIONAL\s*EXPERIENCE|EMPLOYMENT\s*HISTORY)[\s:]*$/im,
    skills: /^(SKILLS|TECHNICAL\s*SKILLS|CORE\s*SKILLS|KEY\s*SKILLS|COMPETENCIES)[\s:]*$/im,
    education: /^(EDUCATION|ACADEMIC\s*BACKGROUND|QUALIFICATIONS)[\s:]*$/im,
    certifications: /^(CERTIFICATIONS|CERTIFICATES|LICENSES|CREDENTIALS)[\s:]*$/im,
    achievements: /^(ACHIEVEMENTS|ACCOMPLISHMENTS|AWARDS|HONORS)[\s:]*$/im
  };

  /**
   * Action verbs for bullet point enhancement
   */
  const ACTION_VERBS = [
    'Developed', 'Implemented', 'Designed', 'Created', 'Built', 'Optimized',
    'Managed', 'Led', 'Directed', 'Orchestrated', 'Spearheaded', 'Drove',
    'Analyzed', 'Evaluated', 'Assessed', 'Investigated', 'Researched',
    'Improved', 'Enhanced', 'Streamlined', 'Automated', 'Transformed',
    'Delivered', 'Achieved', 'Exceeded', 'Accomplished', 'Generated',
    'Collaborated', 'Partnered', 'Coordinated', 'Facilitated', 'Mentored'
  ];

  /**
   * Parse CV into sections
   * @param {string} cvText - Raw CV text
   * @returns {Object} Parsed sections
   */
  function parseCV(cvText) {
    if (!cvText) return { raw: '', sections: {} };

    const lines = cvText.split('\n');
    const sections = {
      header: [],
      summary: [],
      experience: [],
      skills: [],
      education: [],
      certifications: [],
      achievements: [],
      other: []
    };

    let currentSection = 'header';
    let lineIndex = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      let foundSection = false;

      // Check if this line is a section header
      for (const [sectionName, pattern] of Object.entries(SECTION_PATTERNS)) {
        if (pattern.test(trimmed)) {
          currentSection = sectionName;
          foundSection = true;
          sections[sectionName].push(line); // Include the header
          break;
        }
      }

      if (!foundSection) {
        // Add to current section
        if (sections[currentSection]) {
          sections[currentSection].push(line);
        } else {
          sections.other.push(line);
        }
      }

      lineIndex++;
    }

    return {
      raw: cvText,
      sections,
      lineCount: lines.length
    };
  }

  /**
   * Check if a keyword is already present in text
   */
  function hasKeyword(text, keyword) {
    if (!text || !keyword) return false;
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
    return regex.test(text);
  }

  /**
   * Escape special regex characters
   */
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Find best position to inject keyword naturally
   */
  function findInjectionPoint(sentence, keyword) {
    // Common patterns where keywords fit naturally
    const patterns = [
      { regex: /\b(using|with|in|through|via|leveraging)\s+/gi, position: 'after' },
      { regex: /\b(expertise in|experience with|proficient in|skilled in)\s*/gi, position: 'after' },
      { regex: /\b(including|such as|like)\s*/gi, position: 'after' },
      { regex: /\b(and|,)\s*$/gi, position: 'end' }
    ];

    for (const pattern of patterns) {
      const match = pattern.regex.exec(sentence);
      if (match) {
        return {
          index: match.index + match[0].length,
          type: pattern.position
        };
      }
    }

    return null;
  }

  /**
   * Inject keywords into summary section naturally
   * Target: 6-8 high-priority keywords
   * @param {Array} summaryLines - Lines in summary section
   * @param {Array} highPriorityKeywords - Keywords to inject
   * @param {Array} existingMatched - Already matched keywords
   * @returns {Object} Enhanced summary with injection stats
   */
  function enhanceSummary(summaryLines, highPriorityKeywords, existingMatched = []) {
    if (!summaryLines.length || !highPriorityKeywords.length) {
      return { lines: summaryLines, injected: [], count: 0 };
    }

    const injected = [];
    const targetCount = Math.min(8, highPriorityKeywords.length);
    const linesToEnhance = [...summaryLines];
    const summaryText = summaryLines.join(' ');
    
    // Find keywords not yet in summary
    const missingKeywords = highPriorityKeywords.filter(
      kw => !hasKeyword(summaryText, kw) && !existingMatched.includes(kw)
    );

    if (missingKeywords.length === 0) {
      return { lines: summaryLines, injected: [], count: 0 };
    }

    // Strategy 1: Add to existing sentences with "including" or "such as"
    for (let i = 1; i < linesToEnhance.length && injected.length < targetCount; i++) {
      const line = linesToEnhance[i];
      if (line.trim().length < 20) continue; // Skip short lines
      
      // Find sentences ending with period
      if (line.includes('.') && missingKeywords.length > 0) {
        const kw = missingKeywords.shift();
        const enhancedLine = line.replace(
          /\.(\s*)$/,
          `, including ${kw}.$1`
        );
        if (enhancedLine !== line) {
          linesToEnhance[i] = enhancedLine;
          injected.push(kw);
        }
      }
    }

    // Strategy 2: Add a new comprehensive sentence if we haven't injected enough
    if (injected.length < 4 && missingKeywords.length >= 3) {
      const keywordsToAdd = missingKeywords.splice(0, Math.min(4, missingKeywords.length));
      const lastKeyword = keywordsToAdd.pop();
      const keywordList = keywordsToAdd.length > 0 
        ? `${keywordsToAdd.join(', ')} and ${lastKeyword}`
        : lastKeyword;
      
      const newSentence = `Proficient in ${keywordList} with a proven track record of delivering results.`;
      
      // Insert before the last line or at the end
      const insertIndex = Math.max(1, linesToEnhance.length - 1);
      linesToEnhance.splice(insertIndex, 0, newSentence);
      injected.push(...keywordsToAdd, lastKeyword);
    }

    return {
      lines: linesToEnhance,
      injected,
      count: injected.length
    };
  }

  /**
   * Enhance experience bullet points with keywords
   * Target: 2 keywords per bullet for top 3-4 roles
   * @param {Array} experienceLines - Lines in experience section
   * @param {Object} keywords - All priority keywords
   * @param {Array} existingMatched - Already matched keywords
   * @returns {Object} Enhanced experience with injection stats
   */
  function enhanceExperience(experienceLines, keywords, existingMatched = []) {
    if (!experienceLines.length) {
      return { lines: experienceLines, injected: [], count: 0 };
    }

    const injected = [];
    const linesToEnhance = [...experienceLines];
    const allKeywords = [
      ...keywords.highPriority,
      ...keywords.mediumPriority
    ];
    
    const experienceText = experienceLines.join(' ');
    const availableKeywords = allKeywords.filter(
      kw => !hasKeyword(experienceText, kw) && !existingMatched.includes(kw)
    );

    let bulletCount = 0;
    const maxBullets = 10; // Enhance up to 10 bullet points
    let keywordIndex = 0;

    for (let i = 0; i < linesToEnhance.length && bulletCount < maxBullets; i++) {
      const line = linesToEnhance[i];
      const trimmed = line.trim();

      // Identify bullet points
      if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
        bulletCount++;
        
        if (keywordIndex >= availableKeywords.length) continue;
        
        // Try to inject 1-2 keywords per bullet
        let enhancedLine = line;
        let injectedInBullet = 0;

        for (let j = 0; j < 2 && keywordIndex < availableKeywords.length; j++) {
          const kw = availableKeywords[keywordIndex];
          
          // Check if keyword can fit naturally
          if (!hasKeyword(enhancedLine, kw)) {
            // Strategy: Add "utilizing [keyword]" or "leveraging [keyword]" before period
            if (enhancedLine.includes('.') || enhancedLine.includes(',')) {
              const insertPhrase = j === 0 ? `utilizing ${kw}` : `and ${kw}`;
              enhancedLine = enhancedLine.replace(
                /([.,])(\s*)$/,
                ` ${insertPhrase}$1$2`
              );
              injected.push(kw);
              injectedInBullet++;
              keywordIndex++;
            } else if (!enhancedLine.endsWith('.')) {
              // Add at end for lines without punctuation
              enhancedLine = `${enhancedLine.trimEnd()} using ${kw}`;
              injected.push(kw);
              injectedInBullet++;
              keywordIndex++;
            }
          }
        }

        linesToEnhance[i] = enhancedLine;
      }
    }

    return {
      lines: linesToEnhance,
      injected,
      count: injected.length
    };
  }

  /**
   * Enhance skills section to include all high + most medium priority keywords
   * @param {Array} skillsLines - Lines in skills section
   * @param {Object} keywords - All priority keywords
   * @param {Array} existingMatched - Already matched keywords
   * @returns {Object} Enhanced skills with injection stats
   */
  function enhanceSkills(skillsLines, keywords, existingMatched = []) {
    if (!skillsLines.length) {
      // Create new skills section if missing
      const allSkills = [
        ...keywords.highPriority,
        ...keywords.mediumPriority.slice(0, 7)
      ];
      
      if (allSkills.length === 0) {
        return { lines: [], injected: [], count: 0 };
      }

      const newSection = [
        'SKILLS',
        `• Technical: ${allSkills.slice(0, Math.ceil(allSkills.length / 2)).join(', ')}`,
        `• Additional: ${allSkills.slice(Math.ceil(allSkills.length / 2)).join(', ')}`
      ];

      return {
        lines: newSection,
        injected: allSkills,
        count: allSkills.length,
        isNew: true
      };
    }

    const injected = [];
    const linesToEnhance = [...skillsLines];
    const skillsText = skillsLines.join(' ');
    
    // Find keywords not in skills
    const missingSkills = [
      ...keywords.highPriority,
      ...keywords.mediumPriority
    ].filter(kw => !hasKeyword(skillsText, kw) && !existingMatched.includes(kw));

    if (missingSkills.length === 0) {
      return { lines: skillsLines, injected: [], count: 0 };
    }

    // Find the best line to append skills to (usually a bullet or list)
    let targetLineIndex = -1;
    for (let i = linesToEnhance.length - 1; i >= 0; i--) {
      const line = linesToEnhance[i].trim();
      if (line.startsWith('•') || line.startsWith('-') || line.includes(':') || line.includes(',')) {
        targetLineIndex = i;
        break;
      }
    }

    if (targetLineIndex === -1) {
      // Add new bullet with skills
      const skillsToAdd = missingSkills.slice(0, 10);
      linesToEnhance.push(`• Additional: ${skillsToAdd.join(', ')}`);
      injected.push(...skillsToAdd);
    } else {
      // Append to existing line
      const skillsToAdd = missingSkills.slice(0, 8);
      const currentLine = linesToEnhance[targetLineIndex];
      
      if (currentLine.includes(':')) {
        // Append after colon list
        linesToEnhance[targetLineIndex] = `${currentLine.trimEnd()}, ${skillsToAdd.join(', ')}`;
      } else {
        // Append to bullet
        linesToEnhance[targetLineIndex] = `${currentLine.trimEnd()}, ${skillsToAdd.join(', ')}`;
      }
      injected.push(...skillsToAdd);
    }

    return {
      lines: linesToEnhance,
      injected,
      count: injected.length
    };
  }

  /**
   * Main CV tailoring function - rewrite CV for 95%+ match
   * @param {string} cvText - Original CV text
   * @param {Object} keywords - Extracted keywords from KeywordExtractor
   * @param {Object} options - Tailoring options
   * @returns {Object} Tailored CV with stats
   */
  function tailorCV(cvText, keywords, options = {}) {
    if (!cvText || !keywords || !keywords.all || keywords.all.length === 0) {
      return {
        tailoredCV: cvText,
        originalText: cvText,
        injectedKeywords: [],
        matchScore: 0,
        stats: { summary: 0, experience: 0, skills: 0, total: 0 }
      };
    }

    // Parse CV into sections
    const parsed = parseCV(cvText);
    
    // Get initial match status
    const initialMatch = global.KeywordExtractor 
      ? global.KeywordExtractor.matchKeywords(cvText, keywords.all)
      : { matched: [], missing: keywords.all, matchScore: 0 };
    
    const stats = { summary: 0, experience: 0, skills: 0, total: 0 };
    const allInjected = [];
    
    // Enhance each section
    const enhancedSections = { ...parsed.sections };
    
    // 1. Enhance Summary (6-8 high priority keywords)
    if (parsed.sections.summary.length > 0) {
      const summaryResult = enhanceSummary(
        parsed.sections.summary,
        keywords.highPriority,
        initialMatch.matched
      );
      enhancedSections.summary = summaryResult.lines;
      stats.summary = summaryResult.count;
      allInjected.push(...summaryResult.injected);
    }

    // 2. Enhance Experience (2 keywords per bullet)
    if (parsed.sections.experience.length > 0) {
      const experienceResult = enhanceExperience(
        parsed.sections.experience,
        keywords,
        [...initialMatch.matched, ...allInjected]
      );
      enhancedSections.experience = experienceResult.lines;
      stats.experience = experienceResult.count;
      allInjected.push(...experienceResult.injected);
    }

    // 3. Enhance Skills (all high + most medium)
    const skillsResult = enhanceSkills(
      parsed.sections.skills,
      keywords,
      [...initialMatch.matched, ...allInjected]
    );
    enhancedSections.skills = skillsResult.lines;
    stats.skills = skillsResult.count;
    allInjected.push(...skillsResult.injected);

    // Reconstruct CV
    const tailoredCV = reconstructCV(enhancedSections, parsed);
    
    // Calculate final match score
    const finalMatch = global.KeywordExtractor 
      ? global.KeywordExtractor.matchKeywords(tailoredCV, keywords.all)
      : { 
          matchScore: Math.min(98, Math.round(((initialMatch.matched.length + allInjected.length) / keywords.all.length) * 100)),
          matched: [...initialMatch.matched, ...allInjected]
        };

    stats.total = allInjected.length;

    return {
      tailoredCV,
      originalText: cvText,
      injectedKeywords: allInjected,
      matchScore: finalMatch.matchScore,
      matchedKeywords: finalMatch.matched || [...initialMatch.matched, ...allInjected],
      missingKeywords: finalMatch.missing || keywords.all.filter(k => !finalMatch.matched?.includes(k)),
      stats,
      keywords
    };
  }

  /**
   * Reconstruct CV from enhanced sections
   */
  function reconstructCV(sections, originalParsed) {
    const parts = [];

    // Header first
    if (sections.header && sections.header.length > 0) {
      parts.push(sections.header.join('\n'));
    }

    // Standard section order
    const sectionOrder = ['summary', 'experience', 'education', 'skills', 'certifications', 'achievements', 'other'];

    for (const sectionName of sectionOrder) {
      if (sections[sectionName] && sections[sectionName].length > 0) {
        // Add blank line before section if not first
        if (parts.length > 0) {
          parts.push('');
        }
        parts.push(sections[sectionName].join('\n'));
      }
    }

    return parts.join('\n');
  }

  /**
   * Quick optimization - add missing keywords with minimal changes
   * For when a full rewrite isn't needed
   */
  function quickOptimize(cvText, missingKeywords, maxAdditions = 10) {
    if (!cvText || !missingKeywords || missingKeywords.length === 0) {
      return { optimizedCV: cvText, added: [], count: 0 };
    }

    let optimizedCV = cvText;
    const added = [];
    const keywordsToAdd = missingKeywords.slice(0, maxAdditions);

    // Find skills section and append
    const skillsMatch = SECTION_PATTERNS.skills.exec(optimizedCV);
    if (skillsMatch) {
      const insertIndex = optimizedCV.indexOf('\n', skillsMatch.index + skillsMatch[0].length);
      if (insertIndex > -1) {
        // Find end of skills section or next section
        let endIndex = optimizedCV.length;
        for (const [name, pattern] of Object.entries(SECTION_PATTERNS)) {
          if (name === 'skills') continue;
          const match = pattern.exec(optimizedCV.substring(insertIndex));
          if (match && (insertIndex + match.index) < endIndex) {
            endIndex = insertIndex + match.index;
          }
        }

        // Insert additional skills line
        const additionalSkills = `• Additional: ${keywordsToAdd.join(', ')}`;
        optimizedCV = 
          optimizedCV.substring(0, endIndex).trimEnd() + 
          '\n' + additionalSkills + '\n' +
          optimizedCV.substring(endIndex);
        
        added.push(...keywordsToAdd);
      }
    } else {
      // No skills section - add one
      const newSkillsSection = `\nSKILLS\n• Technical: ${keywordsToAdd.join(', ')}\n`;
      
      // Insert before education or at end
      const eduMatch = SECTION_PATTERNS.education.exec(optimizedCV);
      if (eduMatch) {
        optimizedCV = 
          optimizedCV.substring(0, eduMatch.index) +
          newSkillsSection + '\n' +
          optimizedCV.substring(eduMatch.index);
      } else {
        optimizedCV = optimizedCV.trimEnd() + '\n' + newSkillsSection;
      }
      added.push(...keywordsToAdd);
    }

    return {
      optimizedCV,
      added,
      count: added.length
    };
  }

  /**
   * Calculate potential match score if keywords were added
   */
  function calculatePotentialScore(currentScore, currentMatched, totalKeywords, keywordsToAdd) {
    const newMatched = currentMatched + keywordsToAdd;
    return Math.round((newMatched / totalKeywords) * 100);
  }

  /**
   * Generate tailoring suggestions based on analysis
   */
  function generateSuggestions(analysisResult) {
    const suggestions = [];
    const { categorizedMissing, match } = analysisResult;

    if (categorizedMissing.high.length > 0) {
      suggestions.push({
        priority: 'high',
        type: 'missing_keywords',
        message: `Add ${categorizedMissing.high.length} high-priority keywords: ${categorizedMissing.high.slice(0, 3).join(', ')}${categorizedMissing.high.length > 3 ? '...' : ''}`,
        keywords: categorizedMissing.high,
        impact: `Could improve match by ~${Math.round((categorizedMissing.high.length / match.totalKeywords) * 100)}%`
      });
    }

    if (categorizedMissing.medium.length > 0) {
      suggestions.push({
        priority: 'medium',
        type: 'missing_keywords',
        message: `Consider adding ${categorizedMissing.medium.length} medium-priority keywords`,
        keywords: categorizedMissing.medium,
        impact: `Could improve match by ~${Math.round((categorizedMissing.medium.length / match.totalKeywords) * 100)}%`
      });
    }

    if (match.matchScore < 70) {
      suggestions.push({
        priority: 'high',
        type: 'overall',
        message: 'CV needs significant keyword optimization for ATS compatibility',
        action: 'Use full CV tailoring to achieve 95%+ match'
      });
    }

    return suggestions;
  }

  // Export functions
  global.CVTailor = {
    tailorCV,
    parseCV,
    enhanceSummary,
    enhanceExperience,
    enhanceSkills,
    quickOptimize,
    calculatePotentialScore,
    generateSuggestions,
    hasKeyword,
    SECTION_PATTERNS,
    ACTION_VERBS
  };

})(typeof window !== 'undefined' ? window : global);
