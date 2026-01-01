// button-fixer.js - Ensures all buttons are clickable with proper event listeners
// Fixes SVG className errors and provides reliable button handling

(function(global) {
  'use strict';

  /**
   * Safely set class on any element (SVG-compatible)
   * @param {Element} element - DOM element
   * @param {string} className - Class string to set
   */
  function safeSetClass(element, className) {
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
  function safeAddClass(element, className) {
    if (!element) return;
    
    if (element instanceof SVGElement) {
      const current = element.getAttribute('class') || '';
      if (!current.includes(className)) {
        element.setAttribute('class', (current + ' ' + className).trim());
      }
    } else if (element.classList) {
      element.classList.add(className);
    } else {
      const current = element.className || '';
      if (!current.includes(className)) {
        element.className = (current + ' ' + className).trim();
      }
    }
  }

  /**
   * Safely remove class from any element (SVG-compatible)
   */
  function safeRemoveClass(element, className) {
    if (!element) return;
    
    if (element instanceof SVGElement) {
      const current = element.getAttribute('class') || '';
      element.setAttribute('class', current.replace(new RegExp(`\\b${className}\\b`, 'g'), '').trim());
    } else if (element.classList) {
      element.classList.remove(className);
    } else {
      const current = element.className || '';
      element.className = current.replace(new RegExp(`\\b${className}\\b`, 'g'), '').trim();
    }
  }

  /**
   * Safely toggle class on any element (SVG-compatible)
   */
  function safeToggleClass(element, className, force) {
    if (!element) return;
    
    const hasClass = element instanceof SVGElement 
      ? (element.getAttribute('class') || '').includes(className)
      : element.classList?.contains(className) || (element.className || '').includes(className);
    
    if (force === true || (!hasClass && force !== false)) {
      safeAddClass(element, className);
    } else {
      safeRemoveClass(element, className);
    }
  }

  /**
   * Set button loading state
   */
  function setButtonLoading(button, loading, loadingText = 'Loading...') {
    if (!button) return;

    const textEl = button.querySelector('.btn-text');
    
    if (loading) {
      button.disabled = true;
      button.dataset.originalText = textEl?.textContent || button.textContent;
      safeAddClass(button, 'btn-loading');
      if (textEl) {
        textEl.textContent = loadingText;
      }
    } else {
      button.disabled = false;
      safeRemoveClass(button, 'btn-loading');
      if (textEl && button.dataset.originalText) {
        textEl.textContent = button.dataset.originalText;
      }
    }
  }

  /**
   * Attach click handler to button with proper event handling
   * Removes existing listeners and adds new one
   * @param {string|Element} buttonOrId - Button element or ID
   * @param {Function} handler - Click handler function
   * @param {Object} options - Options { context, loadingText, showLoading }
   * @returns {boolean} Success
   */
  function attachClickHandler(buttonOrId, handler, options = {}) {
    const button = typeof buttonOrId === 'string' 
      ? document.getElementById(buttonOrId) 
      : buttonOrId;
    
    if (!button) {
      console.warn(`[ButtonFixer] Button not found: ${buttonOrId}`);
      return false;
    }

    const { context, loadingText = 'Processing...', showLoading = true } = options;

    // Create new button to remove all existing listeners
    const newButton = button.cloneNode(true);
    button.parentNode?.replaceChild(newButton, button);

    // Add the new click handler
    newButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (newButton.disabled) return;

      if (showLoading) {
        setButtonLoading(newButton, true, loadingText);
      }

      try {
        if (context) {
          await handler.call(context, e);
        } else {
          await handler(e);
        }
      } catch (error) {
        console.error(`[ButtonFixer] Handler error:`, error);
      } finally {
        if (showLoading) {
          setButtonLoading(newButton, false);
        }
      }
    });

    console.log(`[ButtonFixer] Handler attached to: ${buttonOrId}`);
    return true;
  }

  /**
   * Fix all buttons in a container
   * Ensures buttons are properly clickable
   */
  function fixAllButtons(containerId = null) {
    const container = containerId 
      ? document.getElementById(containerId) 
      : document;
    
    if (!container) return;

    // Find all buttons that might have issues
    const buttons = container.querySelectorAll('button, .btn, [role="button"]');
    
    buttons.forEach(button => {
      // Ensure pointer-events
      if (getComputedStyle(button).pointerEvents === 'none') {
        button.style.pointerEvents = 'auto';
      }

      // Ensure cursor
      if (!button.disabled) {
        button.style.cursor = 'pointer';
      }

      // Fix any tabindex issues
      if (!button.hasAttribute('tabindex')) {
        button.setAttribute('tabindex', '0');
      }

      // Add keyboard accessibility
      if (!button._keyboardFixed) {
        button.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            button.click();
          }
        });
        button._keyboardFixed = true;
      }
    });

    console.log(`[ButtonFixer] Fixed ${buttons.length} buttons`);
  }

  /**
   * Initialize button fixes on page load
   */
  function initButtonFixes() {
    if (typeof document === 'undefined') return;

    const init = () => {
      fixAllButtons();

      // Inject styles for button states
      injectButtonStyles();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  /**
   * Inject button loading styles
   */
  function injectButtonStyles() {
    if (document.getElementById('button-fixer-styles')) return;

    const style = document.createElement('style');
    style.id = 'button-fixer-styles';
    style.textContent = `
      .btn-loading {
        pointer-events: none;
        opacity: 0.7;
        cursor: wait !important;
      }
      
      .btn-loading .btn-text::after {
        content: '';
        animation: btn-dots 1.5s steps(4, end) infinite;
      }
      
      @keyframes btn-dots {
        0%, 20% { content: ''; }
        40% { content: '.'; }
        60% { content: '..'; }
        80%, 100% { content: '...'; }
      }

      button:not(:disabled),
      .btn:not(:disabled),
      [role="button"]:not(:disabled) {
        cursor: pointer;
      }

      button:disabled,
      .btn:disabled,
      [role="button"]:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

      /* Ensure buttons are clickable */
      button, .btn, [role="button"] {
        position: relative;
        z-index: 1;
      }
    `;
    document.head.appendChild(style);
  }

  // Export
  global.ButtonFixer = {
    safeSetClass,
    safeAddClass,
    safeRemoveClass,
    safeToggleClass,
    setButtonLoading,
    attachClickHandler,
    fixAllButtons,
    initButtonFixes,
    injectButtonStyles
  };

  // Auto-init
  initButtonFixes();

})(typeof window !== 'undefined' ? window : global);
