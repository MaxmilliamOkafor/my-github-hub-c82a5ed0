// auto-tailor-95.js - Automatic CV tailoring for guaranteed 95%+ ATS match
// Orchestrates the full auto-tailor workflow with dynamic score updates
// OPTIMIZED: Now uses ReliableExtractor and TailorUniversal for speed

(function(global) {
  'use strict';

  /**
   * Main auto-tailor engine for 95%+ guaranteed match
   * Workflow: Scrape JD → Extract keywords → Show initial score → 
   *           Auto-tailor CV → Recalculate → Show final score → Generate PDF
   */
  class AutoTailor95 {
    constructor(options = {}) {
      this.targetScore = options.targetScore || 95;
      this.maxKeywords = options.maxKeywords || 35;
      this.onProgress = options.onProgress || (() => {});
      this.onScoreUpdate = options.onScoreUpdate || (() => {});
      this.onChipsUpdate = options.onChipsUpdate || (() => {});
    }

    /**
     * Full automatic tailoring workflow
     * @param {string} jobDescription - Job description text
     * @param {string} baseCV - Original CV text
     * @returns {Promise<Object>} Tailored CV with final score
     */
    async autoTailorTo95Plus(jobDescription, baseCV) {
      if (!jobDescription || !baseCV) {
        throw new Error('Job description and CV are required');
      }

      // Step 1: Extract keywords (up to 35, dynamic based on JD length)
      this.onProgress(10, 'Extracting keywords from job description...');
      const keywords = await this.extractJobKeywords(jobDescription);
      
      if (!keywords.all || keywords.all.length === 0) {
        throw new Error('Could not extract keywords from job description');
      }

      // Step 2: Calculate initial match (typically 50-75%)
      this.onProgress(25, 'Analyzing initial match...');
      const initialMatch = this.calculateInitialMatch(baseCV, keywords);
      
      // Show initial score and chips
      this.onScoreUpdate(initialMatch.score, 'initial');
      this.onChipsUpdate(keywords, baseCV, 'initial');

      // Short delay to show initial state
      await this.delay(300); // Reduced from 500ms for speed

      // Step 3: Auto-tailor CV to inject missing keywords
      this.onProgress(50, 'Tailoring CV for ATS optimization...');
      const tailorResult = await this.tailorCVForTarget(baseCV, keywords, initialMatch);
      
      // Step 4: Recalculate with tailored CV (should be 95%+)
      this.onProgress(75, 'Recalculating match score...');
      const finalMatch = this.calculateFinalMatch(tailorResult.tailoredCV, keywords);
      
      // Animate score update
      if (global.DynamicScore) {
        global.DynamicScore.animateScore(
          initialMatch.score, 
          finalMatch.score, 
          (score) => this.onScoreUpdate(score, 'animating'),
          800 // Faster animation
        );
      } else {
        this.onScoreUpdate(finalMatch.score, 'final');
      }
      
      // Update chips with final state
      this.onChipsUpdate(keywords, tailorResult.tailoredCV, 'final');

      // Step 5: Prepare result
      this.onProgress(100, 'Complete!');

      return {
        tailoredCV: tailorResult.tailoredCV,
        originalCV: baseCV,
        keywords,
        initialScore: initialMatch.score,
        finalScore: finalMatch.score,
        matchedKeywords: finalMatch.matched,
        missingKeywords: finalMatch.missing,
        injectedKeywords: tailorResult.injectedKeywords || [],
        stats: {
          keywordsExtracted: keywords.all.length,
          keywordsInjected: tailorResult.injectedKeywords?.length || 0,
          scoreImprovement: finalMatch.score - initialMatch.score
        }
      };
    }

    /**
     * Extract keywords from job description (up to 35, dynamic)
     * OPTIMIZED: Uses ReliableExtractor with caching and universal JD parsing
     */
    async extractJobKeywords(jobText) {
      // Use ReliableExtractor (new optimized module) if available
      if (global.ReliableExtractor) {
        return global.ReliableExtractor.extractReliableKeywords(jobText, this.maxKeywords);
      }
      
      // Fallback to KeywordExtractor for backward compatibility
      if (global.KeywordExtractor) {
        const extracted = global.KeywordExtractor.extractKeywords(jobText, this.maxKeywords);
        
        // Ensure we have proper categorization
        const highCount = Math.min(11, Math.ceil(extracted.all.length * 0.45));
        const mediumCount = Math.min(8, Math.ceil(extracted.all.length * 0.35));
        
        return {
          all: extracted.all.slice(0, this.maxKeywords),
          highPriority: extracted.all.slice(0, highCount),
          mediumPriority: extracted.all.slice(highCount, highCount + mediumCount),
          lowPriority: extracted.all.slice(highCount + mediumCount),
          total: extracted.all.length
        };
      }

      // Ultimate fallback: simple keyword extraction
      return this.simpleKeywordExtraction(jobText);
    }

    /**
     * Simple fallback keyword extraction (only if no modules available)
     */
    simpleKeywordExtraction(text) {
      const stopWords = new Set([
        'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
        'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'this', 'that'
      ]);

      const words = text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 3 && !stopWords.has(word));

      // Count frequency (single-pass)
      const freq = new Map();
      words.forEach(word => {
        freq.set(word, (freq.get(word) || 0) + 1);
      });

      // Sort by frequency
      const sorted = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([word]) => word)
        .slice(0, this.maxKeywords);

      const highCount = Math.ceil(sorted.length * 0.45);
      const mediumCount = Math.ceil(sorted.length * 0.35);

      return {
        all: sorted,
        highPriority: sorted.slice(0, highCount),
        mediumPriority: sorted.slice(highCount, highCount + mediumCount),
        lowPriority: sorted.slice(highCount + mediumCount),
        total: sorted.length
      };
    }

    /**
     * Calculate initial match score
     * OPTIMIZED: Uses ReliableExtractor.matchKeywords with caching
     */
    calculateInitialMatch(cvText, keywords) {
      // Use ReliableExtractor if available
      if (global.ReliableExtractor) {
        return global.ReliableExtractor.matchKeywords(cvText, keywords.all);
      }
      
      // Use DynamicScore if available
      if (global.DynamicScore) {
        return global.DynamicScore.calculateDynamicMatch(cvText, keywords.all);
      }
      
      // Fallback calculation
      const cvLower = cvText.toLowerCase();
      const matched = keywords.all.filter(kw => cvLower.includes(kw.toLowerCase()));
      const missing = keywords.all.filter(kw => !cvLower.includes(kw.toLowerCase()));
      
      return {
        score: Math.round((matched.length / keywords.all.length) * 100),
        matched,
        missing,
        matchCount: matched.length,
        totalKeywords: keywords.all.length
      };
    }

    /**
     * Tailor CV to achieve target score
     * OPTIMIZED: Uses TailorUniversal with async, non-blocking processing
     */
    async tailorCVForTarget(cvText, keywords, initialMatch) {
      // Use TailorUniversal (new optimized module) if available
      if (global.TailorUniversal) {
        return global.TailorUniversal.tailorCV(cvText, keywords, { targetScore: this.targetScore });
      }
      
      // Fallback to CVTailor for backward compatibility
      if (global.CVTailor) {
        const result = await Promise.resolve(global.CVTailor.tailorCV(cvText, keywords, { targetScore: this.targetScore }));
        return result;
      }

      // Ultimate fallback: simple keyword injection
      return this.simpleKeywordInjection(cvText, keywords, initialMatch);
    }

    /**
     * Simple fallback keyword injection (only if no modules available)
     */
    simpleKeywordInjection(cvText, keywords, initialMatch) {
      let tailoredCV = cvText;
      const injected = [];
      const missingKeywords = initialMatch.missing || [];

      // Find skills section or create one
      const skillsPattern = /^(SKILLS|TECHNICAL SKILLS|CORE SKILLS)[\s:]*$/im;
      const hasSkillsSection = skillsPattern.test(cvText);

      if (hasSkillsSection && missingKeywords.length > 0) {
        // Append to existing skills section
        const match = skillsPattern.exec(tailoredCV);
        if (match) {
          const insertPos = tailoredCV.indexOf('\n', match.index) + 1;
          const skillsToAdd = missingKeywords.slice(0, 15);
          const skillsLine = `• Additional: ${skillsToAdd.join(', ')}\n`;
          tailoredCV = tailoredCV.slice(0, insertPos) + skillsLine + tailoredCV.slice(insertPos);
          injected.push(...skillsToAdd);
        }
      } else if (missingKeywords.length > 0) {
        // Add new skills section before education
        const educationPattern = /^(EDUCATION|ACADEMIC)[\s:]*$/im;
        const educationMatch = educationPattern.exec(tailoredCV);
        
        const skillsToAdd = missingKeywords.slice(0, 15);
        const newSkillsSection = `\nSKILLS\n• Technical: ${skillsToAdd.slice(0, 8).join(', ')}\n• Additional: ${skillsToAdd.slice(8).join(', ')}\n\n`;
        
        if (educationMatch) {
          tailoredCV = tailoredCV.slice(0, educationMatch.index) + newSkillsSection + tailoredCV.slice(educationMatch.index);
        } else {
          tailoredCV = tailoredCV + newSkillsSection;
        }
        injected.push(...skillsToAdd);
      }

      // Also add some keywords to summary if present
      const summaryPattern = /^(PROFESSIONAL SUMMARY|SUMMARY|PROFILE)[\s:]*$/im;
      const summaryMatch = summaryPattern.exec(tailoredCV);
      
      if (summaryMatch && missingKeywords.length > injected.length) {
        const remainingKeywords = missingKeywords.filter(kw => !injected.includes(kw));
        if (remainingKeywords.length > 0) {
          const summaryEndPos = tailoredCV.indexOf('\n\n', summaryMatch.index);
          if (summaryEndPos > summaryMatch.index) {
            const keywordsToAdd = remainingKeywords.slice(0, 5);
            const addition = ` Expertise includes ${keywordsToAdd.join(', ')}.`;
            tailoredCV = tailoredCV.slice(0, summaryEndPos) + addition + tailoredCV.slice(summaryEndPos);
            injected.push(...keywordsToAdd);
          }
        }
      }

      // Calculate final match
      const finalMatch = this.calculateFinalMatch(tailoredCV, keywords);

      return {
        tailoredCV,
        injectedKeywords: injected,
        matchScore: finalMatch.score,
        matchedKeywords: finalMatch.matched,
        missingKeywords: finalMatch.missing
      };
    }

    /**
     * Calculate final match score after tailoring
     */
    calculateFinalMatch(cvText, keywords) {
      // Use ValidationEngine if available
      if (global.ValidationEngine) {
        return global.ValidationEngine.validateTailoring(cvText, keywords.all);
      }
      
      // Use ReliableExtractor if available
      if (global.ReliableExtractor) {
        return global.ReliableExtractor.matchKeywords(cvText, keywords.all);
      }
      
      // Use DynamicScore if available
      if (global.DynamicScore) {
        return global.DynamicScore.calculateDynamicMatch(cvText, keywords.all);
      }
      
      // Fallback
      const cvLower = cvText.toLowerCase();
      const matched = keywords.all.filter(kw => cvLower.includes(kw.toLowerCase()));
      const missing = keywords.all.filter(kw => !cvLower.includes(kw.toLowerCase()));
      
      return {
        score: Math.round((matched.length / keywords.all.length) * 100),
        matched,
        missing,
        matchCount: matched.length,
        totalKeywords: keywords.all.length
      };
    }

    /**
     * Utility delay function
     */
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  // Export
  global.AutoTailor95 = AutoTailor95;

})(typeof window !== 'undefined' ? window : global);
