// ui-keyword-chips.js - Screenshot-exact keyword chip rendering
// Renders keyword chips with filled/empty states matching the reference design

(function(global) {
  'use strict';

  /**
   * Render keyword chips to a container
   * Matches screenshot-exact UI with filled (matched) and empty (missing) states
   * @param {string} containerId - Container element ID
   * @param {Array} keywords - Array of keywords to render
   * @param {string} cvText - CV text to check for matches
   * @param {Object} options - Rendering options
   */
  function renderKeywordChips(containerId, keywords, cvText, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`[KeywordChips] Container not found: ${containerId}`);
      return;
    }

    container.innerHTML = '';
    const cvLower = (cvText || '').toLowerCase();
    let matchCount = 0;

    keywords.forEach(keyword => {
      const isMatched = checkKeywordMatch(cvLower, keyword);
      if (isMatched) matchCount++;

      const chip = createChipElement(keyword, isMatched, options.priority || 'medium');
      container.appendChild(chip);
    });

    // Update count element if provided
    if (options.countId) {
      const countEl = document.getElementById(options.countId);
      if (countEl) {
        countEl.textContent = `${matchCount}/${keywords.length}`;
        // Add checkmark icon before count for matched
        if (matchCount === keywords.length && keywords.length > 0) {
          countEl.innerHTML = `✓ ${matchCount}/${keywords.length}`;
          countEl.classList.add('all-matched');
        } else {
          countEl.classList.remove('all-matched');
        }
      }
    }

    return { matchCount, total: keywords.length };
  }

  /**
   * Check if keyword is matched in CV text
   */
  function checkKeywordMatch(cvLower, keyword) {
    const keywordLower = keyword.toLowerCase();
    
    // Try exact word boundary match first
    try {
      const regex = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, 'i');
      if (regex.test(cvLower)) return true;
    } catch (e) {
      // Fallback for invalid regex
    }
    
    // Check for partial matches (e.g., "python" matches "python3")
    return cvLower.includes(keywordLower);
  }

  /**
   * Create a single chip element
   */
  function createChipElement(keyword, isMatched, priority = 'medium') {
    const chip = document.createElement('span');
    chip.className = `keyword-chip ${isMatched ? 'matched' : 'missing'} priority-${priority}`;
    
    // Use innerHTML with escaped keyword and proper icon
    const icon = isMatched ? '✓' : '✗';
    const escapedKeyword = escapeHtml(keyword);
    
    chip.innerHTML = `
      <span class="chip-text">${escapedKeyword}</span>
      <span class="chip-icon">${icon}</span>
    `;
    
    // Add click handler for potential interactions
    chip.addEventListener('click', () => {
      chip.classList.add('chip-clicked');
      setTimeout(() => chip.classList.remove('chip-clicked'), 200);
    });
    
    return chip;
  }

  /**
   * Update all keyword sections in the panel
   * Matches screenshot layout: High Priority (11), Medium Priority (8), Low Priority (4)
   * @param {Object} keywords - Keywords object with highPriority, mediumPriority, lowPriority arrays
   * @param {string} cvText - CV text to check for matches
   * @returns {Object} Total match counts
   */
  function updateAllKeywordSections(keywords, cvText) {
    const results = {
      high: { matched: 0, total: 0 },
      medium: { matched: 0, total: 0 },
      low: { matched: 0, total: 0 }
    };

    // Update High Priority section
    if (keywords.highPriority && keywords.highPriority.length > 0) {
      const highResult = renderKeywordChips(
        'highPriorityChips',
        keywords.highPriority,
        cvText,
        { countId: 'highPriorityCount', priority: 'high' }
      );
      if (highResult) {
        results.high = { matched: highResult.matchCount, total: highResult.total };
      }
      showSection('highPrioritySection', true);
    } else {
      showSection('highPrioritySection', false);
    }

    // Update Medium Priority section
    if (keywords.mediumPriority && keywords.mediumPriority.length > 0) {
      const medResult = renderKeywordChips(
        'mediumPriorityChips',
        keywords.mediumPriority,
        cvText,
        { countId: 'mediumPriorityCount', priority: 'medium' }
      );
      if (medResult) {
        results.medium = { matched: medResult.matchCount, total: medResult.total };
      }
      showSection('mediumPrioritySection', true);
    } else {
      showSection('mediumPrioritySection', false);
    }

    // Update Low Priority section
    if (keywords.lowPriority && keywords.lowPriority.length > 0) {
      const lowResult = renderKeywordChips(
        'lowPriorityChips',
        keywords.lowPriority,
        cvText,
        { countId: 'lowPriorityCount', priority: 'low' }
      );
      if (lowResult) {
        results.low = { matched: lowResult.matchCount, total: lowResult.total };
      }
      showSection('lowPrioritySection', true);
    } else {
      showSection('lowPrioritySection', false);
    }

    // Calculate totals
    const totalMatched = results.high.matched + results.medium.matched + results.low.matched;
    const totalKeywords = results.high.total + results.medium.total + results.low.total;

    return {
      ...results,
      total: { matched: totalMatched, total: totalKeywords },
      score: totalKeywords > 0 ? Math.round((totalMatched / totalKeywords) * 100) : 0
    };
  }

  /**
   * Show/hide a section
   */
  function showSection(sectionId, show) {
    const section = document.getElementById(sectionId);
    if (section) {
      if (show) {
        section.classList.remove('hidden');
        section.style.display = '';
      } else {
        section.classList.add('hidden');
        section.style.display = 'none';
      }
    }
  }

  /**
   * Update the main match gauge
   */
  function updateMatchGauge(score, matched, total) {
    // Update gauge circle (SVG-safe)
    const gaugeCircle = document.getElementById('matchGaugeCircle');
    if (gaugeCircle) {
      const circumference = 2 * Math.PI * 45; // ~283
      const dashOffset = circumference - (score / 100) * circumference;
      gaugeCircle.setAttribute('stroke-dashoffset', dashOffset.toString());
      
      // Update color based on score
      const strokeColor = getScoreColor(score);
      gaugeCircle.setAttribute('stroke', strokeColor);
    }

    // Update percentage text
    const percentEl = document.getElementById('matchPercentage');
    if (percentEl) {
      percentEl.textContent = `${score}%`;
    }

    // Update subtitle
    const subtitleEl = document.getElementById('matchSubtitle');
    if (subtitleEl) {
      subtitleEl.textContent = getScoreLabel(score);
    }

    // Update badge
    const badgeEl = document.getElementById('keywordCountBadge');
    if (badgeEl) {
      badgeEl.textContent = `${matched} of ${total} keywords matched`;
    }
  }

  /**
   * Get color for score
   */
  function getScoreColor(score) {
    if (score >= 90) return '#2ed573'; // Green
    if (score >= 70) return '#00d4ff'; // Blue
    if (score >= 50) return '#ffa502'; // Orange
    return '#ff4757'; // Red
  }

  /**
   * Get label for score
   */
  function getScoreLabel(score) {
    if (score >= 95) return 'Excellent match!';
    if (score >= 90) return 'Great match!';
    if (score >= 80) return 'Good match';
    if (score >= 70) return 'Fair match';
    if (score >= 50) return 'Needs improvement';
    return 'Low match - consider tailoring';
  }

  /**
   * Animate chips from missing to matched state
   * Used when boost/tailor completes
   */
  function animateChipTransition(containerId, keywords, cvTextBefore, cvTextAfter, duration = 1500) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const cvLowerBefore = (cvTextBefore || '').toLowerCase();
    const cvLowerAfter = (cvTextAfter || '').toLowerCase();

    const chips = container.querySelectorAll('.keyword-chip');
    let delay = 0;
    const delayIncrement = duration / chips.length;

    chips.forEach((chip, index) => {
      const text = chip.querySelector('.chip-text')?.textContent || '';
      const wasMatched = checkKeywordMatch(cvLowerBefore, text);
      const isMatched = checkKeywordMatch(cvLowerAfter, text);

      if (!wasMatched && isMatched) {
        // Animate transition from missing to matched
        setTimeout(() => {
          chip.classList.add('transitioning');
          chip.classList.remove('missing');
          chip.classList.add('matched');
          
          const icon = chip.querySelector('.chip-icon');
          if (icon) icon.textContent = '✓';

          setTimeout(() => chip.classList.remove('transitioning'), 300);
        }, delay);

        delay += delayIncrement;
      }
    });
  }

  /**
   * Inject additional styles for chip animations
   */
  function injectChipStyles() {
    if (document.getElementById('keyword-chips-styles')) return;

    const style = document.createElement('style');
    style.id = 'keyword-chips-styles';
    style.textContent = `
      .keyword-chip.transitioning {
        animation: chip-flash 0.3s ease-in-out;
      }
      
      @keyframes chip-flash {
        0% { transform: scale(1); }
        50% { transform: scale(1.15); background: rgba(46,213,115,0.4); }
        100% { transform: scale(1); }
      }
      
      .keyword-chip.chip-clicked {
        transform: scale(0.95);
      }
      
      .section-count.all-matched {
        background: rgba(46,213,115,0.25) !important;
        color: #2ed573 !important;
      }
      
      .keyword-section.hidden {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Escape HTML for safe rendering
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape regex special characters
   */
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Auto-inject styles on load
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectChipStyles);
    } else {
      injectChipStyles();
    }
  }

  // Export
  global.KeywordChips = {
    renderKeywordChips,
    updateAllKeywordSections,
    updateMatchGauge,
    animateChipTransition,
    injectChipStyles,
    checkKeywordMatch,
    getScoreColor,
    getScoreLabel
  };

})(typeof window !== 'undefined' ? window : global);
