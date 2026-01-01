// dynamic-score.js - Dynamic fluctuating match score calculation
// Calculates real-time ATS match scores based on actual keywords present in CV

(function(global) {
  'use strict';

  /**
   * Calculate dynamic match score based on keywords found in CV
   * Score fluctuates between 85-100% based on real keyword injection
   * @param {string} cvText - The CV/resume text
   * @param {Array} jobKeywords - Array of keywords from job description
   * @returns {Object} Score details with matched/missing keywords
   */
  function calculateDynamicMatch(cvText, jobKeywords) {
    if (!cvText || !jobKeywords || jobKeywords.length === 0) {
      return {
        score: 0,
        matched: [],
        missing: jobKeywords || [],
        matchCount: 0,
        totalKeywords: jobKeywords?.length || 0
      };
    }

    const cvLower = cvText.toLowerCase();
    const cvWords = extractWords(cvLower);
    const matched = [];
    const missing = [];

    jobKeywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      // Check for exact word boundary match
      const regex = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, 'i');
      
      // Also check for partial matches in compound words
      const hasMatch = regex.test(cvLower) || 
                       cvWords.some(word => word.includes(keywordLower) || keywordLower.includes(word));
      
      if (hasMatch) {
        matched.push(keyword);
      } else {
        missing.push(keyword);
      }
    });

    const score = jobKeywords.length > 0 
      ? Math.round((matched.length / jobKeywords.length) * 100) 
      : 0;

    return {
      score,
      matched,
      missing,
      matchCount: matched.length,
      totalKeywords: jobKeywords.length
    };
  }

  /**
   * Extract words from text for matching
   */
  function extractWords(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s\+\#\.\-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 2);
  }

  /**
   * Escape regex special characters
   */
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Calculate match score with priority weighting
   * High priority keywords count more than low priority
   * @param {string} cvText - CV text
   * @param {Object} keywords - Keywords object with high/medium/low priority arrays
   * @returns {Object} Weighted score and details
   */
  function calculateWeightedMatch(cvText, keywords) {
    if (!keywords) return { score: 0, matched: [], missing: [] };

    const weights = { high: 3, medium: 2, low: 1 };
    let totalWeight = 0;
    let matchedWeight = 0;
    const allMatched = [];
    const allMissing = [];

    // Calculate weighted scores for each priority
    ['highPriority', 'mediumPriority', 'lowPriority'].forEach(priority => {
      const priorityKey = priority.replace('Priority', '');
      const weight = weights[priorityKey] || 1;
      const keywordList = keywords[priority] || [];

      keywordList.forEach(keyword => {
        totalWeight += weight;
        const result = calculateDynamicMatch(cvText, [keyword]);
        
        if (result.matchCount > 0) {
          matchedWeight += weight;
          allMatched.push(keyword);
        } else {
          allMissing.push(keyword);
        }
      });
    });

    const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

    return {
      score,
      matched: allMatched,
      missing: allMissing,
      matchCount: allMatched.length,
      totalKeywords: allMatched.length + allMissing.length
    };
  }

  /**
   * Animate score change with fluctuation effect
   * @param {number} currentScore - Current displayed score
   * @param {number} targetScore - Target score to animate to
   * @param {function} onUpdate - Callback with each score value
   * @param {number} duration - Animation duration in ms
   */
  function animateScore(currentScore, targetScore, onUpdate, duration = 1000) {
    const startTime = Date.now();
    const diff = targetScore - currentScore;

    function update() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      // Add slight fluctuation during animation
      const fluctuation = progress < 1 ? Math.sin(progress * Math.PI * 4) * 2 : 0;
      
      const currentValue = Math.round(currentScore + (diff * easeOutQuart) + fluctuation);
      onUpdate(Math.max(0, Math.min(100, currentValue)));

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        onUpdate(targetScore); // Ensure we end on exact target
      }
    }

    requestAnimationFrame(update);
  }

  /**
   * Get score status label based on percentage
   * @param {number} score - Match score percentage
   * @returns {Object} Status label and color class
   */
  function getScoreStatus(score) {
    if (score >= 95) return { label: 'Excellent', color: 'excellent', emoji: '🎯' };
    if (score >= 90) return { label: 'Great', color: 'great', emoji: '✨' };
    if (score >= 80) return { label: 'Good', color: 'good', emoji: '👍' };
    if (score >= 70) return { label: 'Fair', color: 'fair', emoji: '📈' };
    if (score >= 50) return { label: 'Needs Work', color: 'needs-work', emoji: '⚠️' };
    return { label: 'Low Match', color: 'low', emoji: '❌' };
  }

  /**
   * Get stroke color for gauge based on score
   * @param {number} score - Match score percentage
   * @returns {string} HSL color value
   */
  function getScoreColor(score) {
    if (score >= 90) return '#2ed573'; // Green
    if (score >= 70) return '#00d4ff'; // Blue
    if (score >= 50) return '#ffa502'; // Orange
    return '#ff4757'; // Red
  }

  // Export functions
  global.DynamicScore = {
    calculateDynamicMatch,
    calculateWeightedMatch,
    animateScore,
    getScoreStatus,
    getScoreColor,
    extractWords
  };

})(typeof window !== 'undefined' ? window : global);
