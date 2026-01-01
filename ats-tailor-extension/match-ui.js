// match-ui.js - SVG-safe UI rendering for ATS Match Analysis
// Fixes className errors and provides clickable button functionality

(function(global) {
  'use strict';

  /**
   * Safely set class on any element (SVG-compatible)
   * @param {Element} element - DOM element
   * @param {string} className - Class string to set
   */
  function setElementClass(element, className) {
    if (!element) return;
    
    if (element instanceof SVGElement) {
      element.setAttribute('class', className);
    } else {
      element.className = className;
    }
  }

  /**
   * Safely add class to any element (SVG-compatible)
   */
  function addElementClass(element, className) {
    if (!element) return;
    
    if (element instanceof SVGElement) {
      const current = element.getAttribute('class') || '';
      if (!current.includes(className)) {
        element.setAttribute('class', (current + ' ' + className).trim());
      }
    } else if (element.classList) {
      element.classList.add(className);
    }
  }

  /**
   * Safely remove class from any element (SVG-compatible)
   */
  function removeElementClass(element, className) {
    if (!element) return;
    
    if (element instanceof SVGElement) {
      const current = element.getAttribute('class') || '';
      element.setAttribute('class', current.replace(new RegExp(`\\b${className}\\b`, 'g'), '').trim());
    } else if (element.classList) {
      element.classList.remove(className);
    }
  }

  /**
   * Safely toggle class on any element (SVG-compatible)
   */
  function toggleElementClass(element, className, force) {
    if (!element) return;
    
    if (element instanceof SVGElement) {
      const current = element.getAttribute('class') || '';
      const hasClass = current.includes(className);
      
      if (force === true || (!hasClass && force !== false)) {
        addElementClass(element, className);
      } else {
        removeElementClass(element, className);
      }
    } else if (element.classList) {
      element.classList.toggle(className, force);
    }
  }

  /**
   * Create circular progress gauge using HTML/CSS (no SVG className issues)
   * @param {number} percentage - Match percentage (0-100)
   * @param {number} matched - Number of matched keywords
   * @param {number} total - Total keywords
   * @returns {HTMLElement} The gauge element
   */
  function createMatchGauge(percentage, matched, total) {
    const container = document.createElement('div');
    container.className = 'ats-match-gauge';
    
    // Calculate the circle dash offset
    const circumference = 2 * Math.PI * 45; // radius = 45
    const dashOffset = circumference - (percentage / 100) * circumference;
    
    // Determine color based on score
    let strokeColor = '#ff4757'; // red < 50%
    if (percentage >= 90) strokeColor = '#2ed573'; // green 90%+
    else if (percentage >= 70) strokeColor = '#00d4ff'; // blue 70-89%
    else if (percentage >= 50) strokeColor = '#ffa502'; // orange 50-69%
    
    container.innerHTML = `
      <div class="gauge-circle">
        <svg viewBox="0 0 100 100" class="gauge-svg">
          <circle 
            class="gauge-bg" 
            cx="50" 
            cy="50" 
            r="45" 
            fill="none" 
            stroke="rgba(255,255,255,0.1)" 
            stroke-width="8"
          />
          <circle 
            class="gauge-progress" 
            cx="50" 
            cy="50" 
            r="45" 
            fill="none" 
            stroke="${strokeColor}" 
            stroke-width="8"
            stroke-linecap="round"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${dashOffset}"
            transform="rotate(-90 50 50)"
            style="transition: stroke-dashoffset 0.5s ease-in-out"
          />
        </svg>
        <div class="gauge-text">
          <span class="gauge-percentage">${percentage}%</span>
        </div>
      </div>
      <div class="gauge-label">
        <span class="gauge-title">Profile Match</span>
        <span class="gauge-subtitle">${matched} of ${total} keywords matched</span>
      </div>
    `;
    
    return container;
  }

  /**
   * Create keyword chip element
   * @param {string} keyword - The keyword text
   * @param {boolean} matched - Whether keyword is matched
   * @param {string} priority - 'high', 'medium', or 'low'
   * @returns {HTMLElement} The chip element
   */
  function createKeywordChip(keyword, matched, priority = 'medium') {
    const chip = document.createElement('span');
    chip.className = `keyword-chip ${matched ? 'matched' : 'missing'} priority-${priority}`;
    chip.innerHTML = `
      <span class="chip-text">${keyword}</span>
      <span class="chip-icon">${matched ? '✓' : '✗'}</span>
    `;
    return chip;
  }

  /**
   * Create keyword section with chips
   * @param {string} title - Section title (e.g., "High Priority")
   * @param {Array} matchedKeywords - Keywords that are matched
   * @param {Array} missingKeywords - Keywords that are missing
   * @param {string} priority - Priority level
   * @returns {HTMLElement} The section element
   */
  function createKeywordSection(title, matchedKeywords, missingKeywords, priority) {
    const section = document.createElement('div');
    section.className = `keyword-section priority-${priority}`;
    
    const header = document.createElement('div');
    header.className = 'keyword-section-header';
    
    const total = matchedKeywords.length + missingKeywords.length;
    const matchedCount = matchedKeywords.length;
    
    header.innerHTML = `
      <span class="section-title">${title}</span>
      <span class="section-count">${matchedCount}/${total}</span>
    `;
    
    const chips = document.createElement('div');
    chips.className = 'keyword-chips';
    
    // Add matched keywords first
    matchedKeywords.forEach(kw => {
      chips.appendChild(createKeywordChip(kw, true, priority));
    });
    
    // Add missing keywords
    missingKeywords.forEach(kw => {
      chips.appendChild(createKeywordChip(kw, false, priority));
    });
    
    section.appendChild(header);
    section.appendChild(chips);
    
    return section;
  }

  /**
   * Create full AI Match Analysis panel
   * @param {Object} analysisResult - Result from KeywordExtractor.analyzeMatch
   * @returns {HTMLElement} The panel element
   */
  function createMatchAnalysisPanel(analysisResult) {
    const panel = document.createElement('div');
    panel.className = 'ai-match-panel';
    panel.id = 'ats-match-panel';
    
    const { keywords, match, categorizedMatched, categorizedMissing } = analysisResult;
    
    // Header
    const header = document.createElement('div');
    header.className = 'match-panel-header';
    header.innerHTML = `
      <div class="panel-logo">
        <span class="logo-icon">🎯</span>
        <div class="logo-text">
          <span class="panel-title">AI Match Analysis</span>
          <span class="panel-subtitle">Powered by ATS Tailor</span>
        </div>
      </div>
    `;
    
    // Gauge
    const gaugeContainer = document.createElement('div');
    gaugeContainer.className = 'gauge-container';
    gaugeContainer.appendChild(
      createMatchGauge(match.matchScore, match.matchCount, match.totalKeywords)
    );
    
    // Keywords sections
    const keywordsContainer = document.createElement('div');
    keywordsContainer.className = 'keywords-container';
    
    const keywordHeader = document.createElement('div');
    keywordHeader.className = 'keyword-match-header';
    keywordHeader.innerHTML = `
      <span class="keyword-icon">🔍</span>
      <span class="keyword-title">Keyword Match</span>
    `;
    keywordsContainer.appendChild(keywordHeader);
    
    const keywordDesc = document.createElement('p');
    keywordDesc.className = 'keyword-description';
    keywordDesc.textContent = "See which job keywords match your profile and what's missing to improve your score.";
    keywordsContainer.appendChild(keywordDesc);
    
    // Add keyword sections
    if (keywords.highPriority.length > 0) {
      keywordsContainer.appendChild(
        createKeywordSection('High Priority', categorizedMatched.high, categorizedMissing.high, 'high')
      );
    }
    
    if (keywords.mediumPriority.length > 0) {
      keywordsContainer.appendChild(
        createKeywordSection('Medium Priority', categorizedMatched.medium, categorizedMissing.medium, 'medium')
      );
    }
    
    if (keywords.lowPriority.length > 0) {
      keywordsContainer.appendChild(
        createKeywordSection('Low Priority', categorizedMatched.low, categorizedMissing.low, 'low')
      );
    }
    
    panel.appendChild(header);
    panel.appendChild(gaugeContainer);
    panel.appendChild(keywordsContainer);
    
    return panel;
  }

  /**
   * Inject CSS styles for match UI components
   */
  function injectMatchUIStyles() {
    if (document.getElementById('ats-match-ui-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'ats-match-ui-styles';
    style.textContent = `
      .ai-match-panel {
        background: linear-gradient(135deg, #1a1a3e 0%, #0f0f23 100%);
        border-radius: 12px;
        padding: 16px;
        margin: 12px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #fff;
      }
      
      .match-panel-header {
        margin-bottom: 16px;
      }
      
      .panel-logo {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .logo-icon {
        font-size: 24px;
        background: linear-gradient(135deg, #7c3aed, #00d4ff);
        padding: 8px;
        border-radius: 8px;
      }
      
      .panel-title {
        display: block;
        font-size: 16px;
        font-weight: 700;
        color: #fff;
      }
      
      .panel-subtitle {
        display: block;
        font-size: 11px;
        color: rgba(255,255,255,0.6);
      }
      
      .gauge-container {
        display: flex;
        justify-content: center;
        margin-bottom: 20px;
      }
      
      .ats-match-gauge {
        display: flex;
        align-items: center;
        gap: 20px;
        background: rgba(0,0,0,0.3);
        border-radius: 12px;
        padding: 16px 24px;
        width: 100%;
      }
      
      .gauge-circle {
        position: relative;
        width: 100px;
        height: 100px;
        flex-shrink: 0;
      }
      
      .gauge-svg {
        width: 100%;
        height: 100%;
      }
      
      .gauge-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
      }
      
      .gauge-percentage {
        font-size: 24px;
        font-weight: 700;
        color: #fff;
      }
      
      .gauge-label {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      
      .gauge-title {
        font-size: 18px;
        font-weight: 600;
        color: #fff;
      }
      
      .gauge-subtitle {
        font-size: 12px;
        color: rgba(255,255,255,0.7);
        background: rgba(0,212,255,0.2);
        padding: 4px 12px;
        border-radius: 12px;
        display: inline-block;
      }
      
      .keywords-container {
        background: rgba(0,0,0,0.2);
        border-radius: 10px;
        padding: 14px;
      }
      
      .keyword-match-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      
      .keyword-icon {
        font-size: 16px;
      }
      
      .keyword-title {
        font-size: 14px;
        font-weight: 600;
        color: #fff;
      }
      
      .keyword-description {
        font-size: 11px;
        color: rgba(255,255,255,0.6);
        margin-bottom: 12px;
        line-height: 1.4;
      }
      
      .keyword-section {
        margin-bottom: 12px;
      }
      
      .keyword-section:last-child {
        margin-bottom: 0;
      }
      
      .keyword-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .section-title {
        font-size: 12px;
        font-weight: 600;
        color: rgba(255,255,255,0.9);
      }
      
      .keyword-section.priority-high .section-title { color: #ff6b6b; }
      .keyword-section.priority-medium .section-title { color: #ffa502; }
      .keyword-section.priority-low .section-title { color: #00d4ff; }
      
      .section-count {
        font-size: 11px;
        color: rgba(255,255,255,0.5);
        background: rgba(255,255,255,0.1);
        padding: 2px 8px;
        border-radius: 10px;
      }
      
      .keyword-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      
      .keyword-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 16px;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.2s;
      }
      
      .keyword-chip.matched {
        background: rgba(46, 213, 115, 0.2);
        border: 1px solid rgba(46, 213, 115, 0.4);
        color: #2ed573;
      }
      
      .keyword-chip.missing {
        background: rgba(255, 71, 87, 0.15);
        border: 1px solid rgba(255, 71, 87, 0.3);
        color: #ff4757;
      }
      
      .chip-icon {
        font-size: 10px;
      }
      
      .keyword-chip.matched .chip-icon { color: #2ed573; }
      .keyword-chip.missing .chip-icon { color: #ff4757; }
      
      /* Button loading states */
      .btn-loading {
        pointer-events: none;
        opacity: 0.7;
      }
      
      .btn-loading .btn-text::after {
        content: '...';
        animation: dots 1.5s steps(4, end) infinite;
      }
      
      @keyframes dots {
        0%, 20% { content: ''; }
        40% { content: '.'; }
        60% { content: '..'; }
        80%, 100% { content: '...'; }
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Make a button show loading state
   */
  function setButtonLoading(button, loading, originalText = null) {
    if (!button) return;
    
    if (loading) {
      button.disabled = true;
      addElementClass(button, 'btn-loading');
      button.dataset.originalText = button.querySelector('.btn-text')?.textContent || button.textContent;
    } else {
      button.disabled = false;
      removeElementClass(button, 'btn-loading');
      if (originalText || button.dataset.originalText) {
        const textEl = button.querySelector('.btn-text');
        if (textEl) {
          textEl.textContent = originalText || button.dataset.originalText;
        }
      }
    }
  }

  /**
   * Attach click handler with loading state
   */
  function attachClickHandler(buttonId, handler, context = null) {
    const button = document.getElementById(buttonId);
    if (!button) {
      console.warn(`[MatchUI] Button not found: ${buttonId}`);
      return false;
    }
    
    // Remove existing listeners by cloning
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    newButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      setButtonLoading(newButton, true);
      
      try {
        if (context) {
          await handler.call(context, e);
        } else {
          await handler(e);
        }
      } catch (error) {
        console.error(`[MatchUI] Button handler error for ${buttonId}:`, error);
      } finally {
        setButtonLoading(newButton, false);
      }
    });
    
    console.log(`[MatchUI] Click handler attached to: ${buttonId}`);
    return true;
  }

  // Export functions
  global.MatchUI = {
    setElementClass,
    addElementClass,
    removeElementClass,
    toggleElementClass,
    createMatchGauge,
    createKeywordChip,
    createKeywordSection,
    createMatchAnalysisPanel,
    injectMatchUIStyles,
    setButtonLoading,
    attachClickHandler
  };

})(typeof window !== 'undefined' ? window : global);
