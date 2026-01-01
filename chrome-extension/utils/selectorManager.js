// QuantumHire AI - Dynamic Selector Manager
// Handles fallback selectors and remote updates for changing DOM structures

const SelectorManager = {
  // Version for tracking updates
  version: '2.0.0',
  lastUpdated: null,

  // Platform selectors with multiple fallbacks
  selectors: {
    workday: {
      // Personal info fields
      firstName: [
        'input[data-automation-id="firstName"]',
        'input[data-automation-id="legalNameSection_firstName"]',
        'input[name*="firstName" i]',
        'input[id*="firstName" i]',
        'input[aria-label*="first name" i]',
      ],
      lastName: [
        'input[data-automation-id="lastName"]',
        'input[data-automation-id="legalNameSection_lastName"]',
        'input[name*="lastName" i]',
        'input[id*="lastName" i]',
        'input[aria-label*="last name" i]',
      ],
      email: [
        'input[data-automation-id="email"]',
        'input[data-automation-id="emailAddress"]',
        'input[type="email"]',
        'input[name*="email" i]',
        'input[id*="email" i]',
      ],
      phone: [
        'input[data-automation-id="phone"]',
        'input[data-automation-id="phoneNumber"]',
        'input[type="tel"]',
        'input[name*="phone" i]',
        'input[id*="phone" i]',
      ],
      // Address fields
      address: [
        'input[data-automation-id="addressLine1"]',
        'input[data-automation-id="addressSection_addressLine1"]',
        'input[name*="address" i]',
        'input[aria-label*="address" i]',
      ],
      city: [
        'input[data-automation-id="city"]',
        'input[data-automation-id="addressSection_city"]',
        'input[name*="city" i]',
        'input[aria-label*="city" i]',
      ],
      state: [
        'input[data-automation-id="state"]',
        'input[data-automation-id="addressSection_countryRegion"]',
        'select[data-automation-id="state"]',
        'input[name*="state" i]',
      ],
      zipCode: [
        'input[data-automation-id="postalCode"]',
        'input[data-automation-id="addressSection_postalCode"]',
        'input[name*="zip" i]',
        'input[name*="postal" i]',
      ],
      country: [
        'select[data-automation-id="country"]',
        'button[data-automation-id="countryDropdown"]',
        'input[data-automation-id="country"]',
      ],
      // Resume upload
      resume: [
        'input[type="file"][data-automation-id*="file"]',
        'input[type="file"][data-automation-id*="resume"]',
        'input[type="file"][accept*="pdf"]',
        'input[type="file"]',
      ],
      // Navigation
      nextButton: [
        '[data-automation-id="bottom-navigation-next-button"]',
        'button[data-automation-id="nextButton"]',
        'button[data-automation-id="continueButton"]',
        'button:contains("Next")',
        'button:contains("Continue")',
      ],
      submitButton: [
        '[data-automation-id="bottom-navigation-submit-button"]',
        'button[type="submit"]',
        'button:contains("Submit")',
      ],
      applyButton: [
        'button[data-automation-id="jobPostingApplyButton"]',
        'a[data-automation-id="jobPostingApplyButton"]',
        'button[aria-label*="Apply"]',
        'a[aria-label*="Apply"]',
      ],
    },
    greenhouse: {
      firstName: ['#first_name', 'input[name="first_name"]', 'input[id*="first" i][id*="name" i]'],
      lastName: ['#last_name', 'input[name="last_name"]', 'input[id*="last" i][id*="name" i]'],
      email: ['#email', 'input[name="email"]', 'input[type="email"]'],
      phone: ['#phone', 'input[name="phone"]', 'input[type="tel"]'],
      linkedin: ['input[name*="linkedin" i]', 'input[id*="linkedin" i]'],
      resume: ['input[type="file"][name*="resume"]', 'input[type="file"]'],
      coverLetter: ['textarea[name*="cover_letter"]', 'textarea[id*="cover" i]'],
      submitButton: ['#submit_app', 'button[type="submit"]', 'input[type="submit"]'],
    },
    lever: {
      fullName: ['input[name="name"]', 'input[id*="name" i]'],
      email: ['input[name="email"]', 'input[type="email"]'],
      phone: ['input[name="phone"]', 'input[type="tel"]'],
      linkedin: ['input[name="urls[LinkedIn]"]', 'input[placeholder*="linkedin" i]'],
      github: ['input[name="urls[GitHub]"]', 'input[placeholder*="github" i]'],
      portfolio: ['input[name="urls[Portfolio]"]', 'input[placeholder*="portfolio" i]'],
      resume: ['input[type="file"][name="resume"]', 'input[type="file"]'],
      coverLetter: ['textarea[name="comments"]', 'textarea'],
      submitButton: ['button[type="submit"]'],
    },
    linkedin: {
      easyApplyButton: [
        'button.jobs-apply-button',
        'button[data-control-name="jobdetails_topcard_inapply"]',
        'button:contains("Easy Apply")',
      ],
      firstName: ['input[name="firstName"]', 'input[id*="first" i]'],
      lastName: ['input[name="lastName"]', 'input[id*="last" i]'],
      email: ['input[name="email"]', 'input[type="email"]'],
      phone: ['input[name="phoneNumber"]', 'input[type="tel"]'],
      resume: ['input[type="file"]'],
      nextButton: [
        'button[aria-label="Continue to next step"]',
        'button:contains("Next")',
        'footer button[type="button"]',
      ],
      submitButton: [
        'button[aria-label="Submit application"]',
        'button:contains("Submit application")',
      ],
    },
    indeed: {
      firstName: ['input[id="input-firstName"]', 'input[name="firstName"]'],
      lastName: ['input[id="input-lastName"]', 'input[name="lastName"]'],
      email: ['input[id="input-email"]', 'input[type="email"]'],
      phone: ['input[id="input-phoneNumber"]', 'input[type="tel"]'],
      resume: ['input[type="file"]'],
      continueButton: ['button[type="submit"]', 'button:contains("Continue")'],
    },
    ashby: {
      firstName: ['input[name="firstName"]', 'input[id*="first" i]'],
      lastName: ['input[name="lastName"]', 'input[id*="last" i]'],
      email: ['input[name="email"]', 'input[type="email"]'],
      phone: ['input[name="phone"]', 'input[type="tel"]'],
      linkedin: ['input[name="linkedInUrl"]', 'input[placeholder*="linkedin" i]'],
      resume: ['input[type="file"]'],
      submitButton: ['button[type="submit"]'],
    },
    smartrecruiters: {
      firstName: ['input[name="firstName"]', '#firstName'],
      lastName: ['input[name="lastName"]', '#lastName'],
      email: ['input[name="email"]', 'input[type="email"]'],
      phone: ['input[name="phone"]', 'input[type="tel"]'],
      resume: ['input[type="file"]'],
      submitButton: ['button[type="submit"]'],
    },
    workable: {
      firstName: [
        'input[name="firstname"]',
        'input[data-ui="firstname"]',
        'input[id*="firstname" i]',
        'input[placeholder*="first name" i]',
        'input[aria-label*="first name" i]',
      ],
      lastName: [
        'input[name="lastname"]',
        'input[data-ui="lastname"]',
        'input[id*="lastname" i]',
        'input[placeholder*="last name" i]',
        'input[aria-label*="last name" i]',
      ],
      email: [
        'input[name="email"]',
        'input[type="email"]',
        'input[data-ui="email"]',
        'input[id*="email" i]',
      ],
      phone: [
        'input[name="phone"]',
        'input[type="tel"]',
        'input[data-ui="phone"]',
        'input[id*="phone" i]',
      ],
      linkedin: [
        'input[name="linkedin"]',
        'input[placeholder*="linkedin" i]',
        'input[id*="linkedin" i]',
      ],
      resume: [
        'input[type="file"]',
        'input[name="resume"]',
        'input[data-ui="resume"]',
      ],
      coverLetter: [
        'textarea[name="cover_letter"]',
        'textarea[data-ui="cover-letter"]',
        'textarea[id*="cover" i]',
        'textarea[placeholder*="cover" i]',
      ],
      applyButton: [
        'button[data-ui="overview-apply-now"]',
        'button[data-ui="apply-now"]',
        'a[data-ui="apply-now"]',
        'button:contains("Apply")',
        'a:contains("Apply")',
      ],
      submitButton: [
        'button[type="submit"]',
        'button[data-ui="submit"]',
        'button:contains("Submit")',
      ],
    },
  },

  // Custom selectors (can be updated remotely)
  customSelectors: {},

  /**
   * Find element using fallback selectors
   */
  findElement(platform, fieldName) {
    const platformSelectors = this.selectors[platform] || {};
    const customPlatformSelectors = this.customSelectors[platform] || {};
    
    // Combine custom + default selectors (custom first for priority)
    const selectorList = [
      ...(customPlatformSelectors[fieldName] || []),
      ...(platformSelectors[fieldName] || []),
    ];
    
    for (const selector of selectorList) {
      try {
        // Handle :contains pseudo-selector
        if (selector.includes(':contains(')) {
          const match = selector.match(/(.+):contains\(\"(.+)\"\)/);
          if (match) {
            const [, baseSelector, text] = match;
            const elements = document.querySelectorAll(baseSelector);
            for (const el of elements) {
              if (el.textContent?.includes(text) && el.offsetParent !== null) {
                return el;
              }
            }
          }
          continue;
        }
        
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) {
          console.log(`QuantumHire AI: Found ${fieldName} using: ${selector}`);
          return element;
        }
      } catch (e) {
        // Invalid selector, skip
        console.debug(`QuantumHire AI: Invalid selector: ${selector}`);
      }
    }
    
    return null;
  },

  /**
   * Find all elements matching any fallback selector
   */
  findAllElements(platform, fieldName) {
    const platformSelectors = this.selectors[platform] || {};
    const customPlatformSelectors = this.customSelectors[platform] || {};
    
    const selectorList = [
      ...(customPlatformSelectors[fieldName] || []),
      ...(platformSelectors[fieldName] || []),
    ];
    
    const found = [];
    
    for (const selector of selectorList) {
      try {
        if (selector.includes(':contains(')) continue;
        
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (el.offsetParent !== null && !found.includes(el)) {
            found.push(el);
          }
        }
      } catch (e) {
        // Skip invalid selectors
      }
    }
    
    return found;
  },

  /**
   * Add custom selector (runtime updates)
   */
  addCustomSelector(platform, fieldName, selector) {
    if (!this.customSelectors[platform]) {
      this.customSelectors[platform] = {};
    }
    if (!this.customSelectors[platform][fieldName]) {
      this.customSelectors[platform][fieldName] = [];
    }
    
    // Add at beginning for priority
    if (!this.customSelectors[platform][fieldName].includes(selector)) {
      this.customSelectors[platform][fieldName].unshift(selector);
      console.log(`QuantumHire AI: Added custom selector for ${platform}.${fieldName}: ${selector}`);
    }
  },

  /**
   * Load selector updates from remote
   */
  async loadRemoteUpdates() {
    try {
      const response = await fetch(
        'https://wntpldomgjutwufphnpg.supabase.co/storage/v1/object/public/extension-config/selectors.json',
        { cache: 'no-cache' }
      );
      
      if (!response.ok) {
        console.log('QuantumHire AI: No remote selector updates available');
        return false;
      }
      
      const updates = await response.json();
      
      if (updates.version && updates.selectors) {
        this.customSelectors = { ...this.customSelectors, ...updates.selectors };
        this.lastUpdated = Date.now();
        console.log(`QuantumHire AI: Loaded selector updates v${updates.version}`);
        
        // Cache locally
        await chrome.storage.local.set({ 
          cachedSelectors: updates.selectors,
          selectorVersion: updates.version,
          selectorUpdateTime: Date.now(),
        });
        
        return true;
      }
    } catch (error) {
      console.log('QuantumHire AI: Could not load remote selectors:', error.message);
    }
    
    // Try to load from cache
    try {
      const cached = await chrome.storage.local.get(['cachedSelectors', 'selectorVersion']);
      if (cached.cachedSelectors) {
        this.customSelectors = cached.cachedSelectors;
        console.log(`QuantumHire AI: Loaded cached selectors v${cached.selectorVersion}`);
        return true;
      }
    } catch (e) {
      // Ignore cache errors
    }
    
    return false;
  },

  /**
   * Report a failed selector for analytics
   */
  async reportFailedSelector(platform, fieldName, pageUrl) {
    try {
      // Store locally for batch reporting
      const data = await chrome.storage.local.get(['failedSelectors']);
      const failures = data.failedSelectors || [];
      
      failures.push({
        platform,
        fieldName,
        pageUrl: pageUrl.split('?')[0], // Remove query params
        timestamp: Date.now(),
      });
      
      // Keep only last 100 failures
      const trimmed = failures.slice(-100);
      await chrome.storage.local.set({ failedSelectors: trimmed });
      
    } catch (error) {
      console.error('QuantumHire AI: Could not report failed selector:', error);
    }
  },

  /**
   * Get selector statistics
   */
  async getStats() {
    const data = await chrome.storage.local.get([
      'failedSelectors',
      'selectorVersion',
      'selectorUpdateTime',
    ]);
    
    const failures = data.failedSelectors || [];
    const byPlatform = {};
    const byField = {};
    
    for (const f of failures) {
      byPlatform[f.platform] = (byPlatform[f.platform] || 0) + 1;
      byField[f.fieldName] = (byField[f.fieldName] || 0) + 1;
    }
    
    return {
      totalFailures: failures.length,
      byPlatform,
      byField,
      version: data.selectorVersion || this.version,
      lastUpdate: data.selectorUpdateTime || null,
    };
  },
};

// Export for use in extension
if (typeof window !== 'undefined') {
  window.QuantumHireSelectorManager = SelectorManager;
}
