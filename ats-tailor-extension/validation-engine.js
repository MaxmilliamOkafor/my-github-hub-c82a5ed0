// validation-engine.js - Score validation and reliability checking
(function(global) {
  'use strict';

  function validateTailoring(cvText, jobKeywords) {
    const keywords = Array.isArray(jobKeywords) ? jobKeywords : (jobKeywords?.all || []);
    const match = global.ReliableExtractor?.matchKeywords(cvText, keywords) || { matchScore: 0, matched: [], missing: keywords };
    
    return {
      score: match.matchScore,
      keywordCount: match.matched?.length || 0,
      reliable: match.matchScore >= 90 && (match.matched?.length || 0) >= 10,
      matched: match.matched || [],
      missing: match.missing || []
    };
  }

  function getScoreStatus(score) {
    if (score >= 95) return { label: 'Excellent', color: 'excellent', emoji: '🎯' };
    if (score >= 90) return { label: 'Great', color: 'great', emoji: '✨' };
    if (score >= 80) return { label: 'Good', color: 'good', emoji: '👍' };
    if (score >= 70) return { label: 'Fair', color: 'fair', emoji: '📈' };
    return { label: 'Needs Work', color: 'needs-work', emoji: '⚠️' };
  }

  global.ValidationEngine = { validateTailoring, getScoreStatus };
})(typeof window !== 'undefined' ? window : global);
