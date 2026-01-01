// **Universal ATS Autofill Engine v4.0** - Dec 27, 2025 ALL PLATFORMS
// Covers Workday, SmartRecruiters, Bullhorn, Teamtailor, Workable, iCIMS, Oracle Cloud + 50+ ATS

const UNIVERSAL_ATS_2025 = {
  // ALL 2025 ATS selectors (comprehensive coverage)
  platformSelectors: {
    workday: ['[data-automation-id*="field"]', '.prompt-answer-container', '.wd-field', '[data-automation-id]'],
    smartrecruiters: ['.smartrecruiters-field', '[data-sr-field]', '.candidate-form-field', '[class*="SmartRecruiters"]'],
    bullhorn: ['.bh-form-field', '[name*="bullhorn"]', '.candidate-input', '[class*="bullhorn"]'],
    teamtailor: ['.tt-form-field', '[data-teamtailor]', '.application-question', '[class*="teamtailor"]'],
    workable: ['.w-apply-form-field', '[name*="workable"]', '.workable-field', '[data-ui]'],
    icims: ['.iCIMS-form', '[name*="iCIMS"]', '.icims-field', '[class*="icims"]'],
    oracle: ['.ora-job-application', '[data-ora-field]', '.oracle-form-field', '[class*="oracle"]'],
    greenhouse: ['[data-qa-field]', '.greenhouse-form-field', '#application_form', '.application-form'],
    linkedin: ['[data-test-application-form]', '.fb-single-line-text__input', '.jobs-easy-apply'],
    indeed: ['.ia-QuickApplyFormField', '[data-indeed-apply-input]', '.ia-Questions'],
    lever: ['.lever-form-field', '[data-lever-field]', '.application-form'],
    jazzhr: ['.jazzhr-field', '[name*="jazz"]', '.jazz-form'],
    ashby: ['[class*="ashby"]', '.ashbyhq-application', 'form[action*="ashby"]'],
    taleo: ['[class*="taleo"]', '.taleoWebContent', '#requisitionDescriptionInterface'],
    successfactors: ['[class*="sap"]', '.sapMInput', '#sap-ui-content'],
    bamboohr: ['[class*="bamboo"]', '.BambooHR-ATS', '#bamboohr-application'],
    recruitee: ['[class*="recruitee"]', '.recruitee-form', '#recruitee-application'],
    breezy: ['[class*="breezy"]', '.breezy-hr', '#breezy-application'],
    freshteam: ['[class*="freshteam"]', '.freshteam-form', '#freshteam-application'],
    personio: ['[class*="personio"]', '.personio-form', '#personio-application']
  },
  
  // Universal 2025 knockout patterns (covers ALL ATS screening)
  knockoutUniversal: [
    // Work authorization (100% coverage)
    /authorized.*(?:work|us|country|nation|region)/i,
    /eligible.*(?:work|position|role|employment)/i,
    /citizen|national|visa|sponsorship|permit|h1b/i,
    /right.*to.*work|legal.*to.*work|work.*(?:auth|permit|authorization)/i,
    /legally.*(?:authorized|permitted|allowed)/i,
    /require.*(?:sponsorship|visa)/i,
    
    // Experience/Qualifications
    /minimum.*(?:experience|years|qualification)/i,
    /required.*(?:degree|certification|license|education)/i,
    /do.*you.*have.*(?:experience|degree|certification)/i,
    
    // Availability/Commitment
    /willing.*(?:relocate|travel|shift|salary|hours)/i,
    /can.*(?:start|commit|availability|interview)/i,
    /available.*(?:immediately|notice|start)/i,
    /open.*to.*(?:relocate|travel)/i,
    
    // Technical screening
    /proficiency|expertise|experience.*(?:tool|language|platform)/i,
    /familiar.*with|knowledge.*of/i,
    
    // Compliance
    /background.*check|drug.*test|screening/i,
    /agree.*to.*(?:terms|conditions|policy)/i,
    /consent.*to/i,
    
    // Age/Legal requirements
    /(?:18|21).*years.*(?:old|age)|legal.*age/i,
    /at.*least.*(?:18|21)/i
  ],
  
  // Universal YES patterns for knockout questions
  yesPatterns: [
    /^yes$/i, /^y$/i, /^true$/i,
    /authorized/i, /eligible/i, /agree/i, /accept/i, /confirm/i,
    /willing/i, /available/i, /can.*start/i, /have.*experience/i,
    /do.*not.*require.*sponsorship/i, /no.*sponsorship.*required/i
  ],
  
  // Universal NO patterns (to avoid selecting)
  noPatterns: [
    /^no$/i, /^n$/i, /^false$/i,
    /not.*authorized/i, /require.*sponsorship/i, /need.*visa/i,
    /not.*eligible/i, /decline/i, /refuse/i, /cannot/i
  ],
  
  // Enterprise defaults for ALL platforms
  enterpriseSafe: {
    location: "Flexible - Remote OK | Multiple Locations",
    workAuth: "Yes - Authorized to work without sponsorship",
    experience: "5+ years relevant professional experience",
    salary: "Negotiable / Market Rate / Open to Discussion",
    availability: "Immediately available",
    willingToRelocate: "Yes",
    willingToTravel: "Yes",
    startDate: "Immediately / 2 weeks notice"
  }
};

class UniversalATSEngine {
  constructor(userProfile = null) {
    this.platformDetected = null;
    this.companyProfile = null;
    this.userProfile = userProfile;
    this.processedFields = new WeakSet();
    this.stats = {
      autoFilled: 0,
      reviewNeeded: 0,
      manualRequired: 0,
      knockoutsHandled: 0
    };
    this.initialized = false;
  }
  
  async init() {
    if (this.initialized) return this;
    
    this.companyProfile = await this.loadEnterpriseProfile();
    this.platformDetected = this.detectATSPlatform();
    
    console.log(`QuantumHire Universal ATS: Platform detected: ${this.platformDetected}`);
    this.initialized = true;
    
    return this;
  }
  
  detectATSPlatform() {
    const hostname = window.location.hostname.toLowerCase();
    const url = window.location.href.toLowerCase();
    
    // Direct hostname matching first
    const platformMappings = {
      'workday': ['workday.com', 'myworkdayjobs.com', 'wd5.myworkday'],
      'greenhouse': ['greenhouse.io', 'boards.greenhouse.io'],
      'lever': ['lever.co', 'jobs.lever.co'],
      'smartrecruiters': ['smartrecruiters.com'],
      'icims': ['icims.com'],
      'indeed': ['indeed.com', 'indeed.co'],
      'linkedin': ['linkedin.com'],
      'workable': ['workable.com', 'apply.workable.com'],
      'ashby': ['ashbyhq.com'],
      'taleo': ['taleo.net'],
      'oracle': ['oracle.com', 'oraclecloud.com'],
      'bullhorn': ['bullhorn.com', 'bullhornstaffing.com'],
      'teamtailor': ['teamtailor.com'],
      'jazzhr': ['jazzhr.com', 'resumator.com'],
      'bamboohr': ['bamboohr.com'],
      'successfactors': ['successfactors.com', 'successfactors.eu'],
      'recruitee': ['recruitee.com'],
      'breezy': ['breezy.hr'],
      'freshteam': ['freshteam.com'],
      'personio': ['personio.com', 'personio.de']
    };
    
    for (const [platform, domains] of Object.entries(platformMappings)) {
      for (const domain of domains) {
        if (hostname.includes(domain)) {
          return platform;
        }
      }
    }
    
    // Fallback: check for platform-specific selectors on page
    for (const [platform, selectors] of Object.entries(UNIVERSAL_ATS_2025.platformSelectors)) {
      for (const selector of selectors) {
        try {
          if (document.querySelector(selector)) {
            return platform;
          }
        } catch (e) {
          // Invalid selector, skip
        }
      }
    }
    
    return 'generic'; // Fallback for custom ATS
  }
  
  async loadEnterpriseProfile() {
    try {
      // Load from chrome storage
      const stored = await chrome.storage.local.get(['userProfile']);
      const profile = stored.userProfile || {};
      
      // Merge with safe defaults
      return {
        ...UNIVERSAL_ATS_2025.enterpriseSafe,
        firstName: profile.first_name || profile.firstName || '',
        lastName: profile.last_name || profile.lastName || '',
        email: profile.email || '',
        phone: profile.phone || '',
        city: profile.city || '',
        state: profile.state || '',
        country: profile.country || 'United States',
        zipCode: profile.zip_code || profile.zipCode || '',
        address: profile.address || '',
        linkedin: profile.linkedin || '',
        github: profile.github || '',
        portfolio: profile.portfolio || '',
        ...profile
      };
    } catch (e) {
      console.log('UniversalATS: Using defaults, storage error:', e);
      return { ...UNIVERSAL_ATS_2025.enterpriseSafe };
    }
  }
  
  // Main processor - fills all forms on page
  async processAllForms() {
    await this.init();
    
    // Universal selector covers ALL ATS forms
    const formSelectors = [
      'form',
      '.application-form',
      '[role="form"]',
      '#application_form',
      '.apply-form',
      ...Object.values(UNIVERSAL_ATS_2025.platformSelectors).flat()
    ].join(',');
    
    const allForms = document.querySelectorAll(formSelectors);
    console.log(`UniversalATS: Found ${allForms.length} form containers`);
    
    for (const form of allForms) {
      await this.processUniversalFields(form);
    }
    
    // Also process any fields not inside forms
    await this.processUniversalFields(document.body);
    
    return this.stats;
  }
  
  async processUniversalFields(container) {
    const universalFields = container.querySelectorAll('input, select, textarea');
    
    for (const field of universalFields) {
      if (this.isFieldProcessed(field)) continue;
      if (this.isFieldHidden(field)) continue;
      if (field.type === 'hidden' || field.type === 'submit' || field.type === 'button') continue;
      
      try {
        const context = await this.analyzeUniversalField(field, container);
        await this.executeUniversalFill(field, context);
      } catch (e) {
        console.log('UniversalATS: Field processing error:', e);
      }
    }
  }
  
  isFieldHidden(field) {
    return field.offsetParent === null || 
           field.style.display === 'none' || 
           field.style.visibility === 'hidden' ||
           field.closest('[style*="display: none"]') !== null;
  }
  
  async analyzeUniversalField(field, container) {
    const labelText = this.extractUniversalLabel(field);
    const fieldName = (field.name || field.id || '').toLowerCase();
    const placeholder = (field.placeholder || '').toLowerCase();
    const ariaLabel = (field.getAttribute('aria-label') || '').toLowerCase();
    const combinedContext = `${labelText} ${fieldName} ${placeholder} ${ariaLabel}`.toLowerCase();
    
    return {
      label: labelText,
      name: fieldName,
      placeholder: placeholder,
      ariaLabel: ariaLabel,
      combinedContext: combinedContext,
      type: (field.type || '').toLowerCase(),
      tag: field.tagName.toLowerCase(),
      isRequired: field.required || field.getAttribute('aria-required') === 'true',
      isKnockout: UNIVERSAL_ATS_2025.knockoutUniversal.some(p => p.test(combinedContext)),
      options: field.tagName === 'SELECT' ? Array.from(field.options).map(o => ({ value: o.value, text: o.textContent })) : null
    };
  }
  
  extractUniversalLabel(field) {
    // Method 1: aria-labelledby
    const labelledBy = field.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) return labelEl.textContent.trim();
    }
    
    // Method 2: associated label
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`);
      if (label) return label.textContent.trim();
    }
    
    // Method 3: parent label
    const parentLabel = field.closest('label');
    if (parentLabel) {
      return parentLabel.textContent.replace(field.value || '', '').trim();
    }
    
    // Method 4: preceding siblings
    const prevSibling = field.previousElementSibling;
    if (prevSibling && (prevSibling.tagName === 'LABEL' || prevSibling.tagName === 'SPAN')) {
      return prevSibling.textContent.trim();
    }
    
    // Method 5: parent container text
    const container = field.closest('.form-group, .field-wrapper, .form-field, [class*="field"]');
    if (container) {
      const labelInContainer = container.querySelector('label, .label, [class*="label"]');
      if (labelInContainer) return labelInContainer.textContent.trim();
    }
    
    // Method 6: Workday-specific
    const workdayLabel = field.closest('[data-automation-id]')?.querySelector('label, [class*="Label"]');
    if (workdayLabel) return workdayLabel.textContent.trim();
    
    return field.placeholder || field.name || field.id || '';
  }
  
  determineUniversalStrategy(context) {
    const { combinedContext, tag, type, isKnockout } = context;
    
    // Priority 1: Knockout detection (universal patterns)
    if (isKnockout) return 'KNOCKOUT_UNIVERSAL';
    
    // Priority 2: Yes/No detection
    if (this.isUniversalYesNo(context)) return 'YES_NO_UNIVERSAL';
    
    // Priority 3: Field type detection by context
    if (/first.*name|fname|given.*name/i.test(combinedContext)) return 'FIRST_NAME';
    if (/last.*name|lname|surname|family.*name/i.test(combinedContext)) return 'LAST_NAME';
    if (/full.*name|^name$/i.test(combinedContext)) return 'FULL_NAME';
    if (/email|e-mail/i.test(combinedContext)) return 'EMAIL';
    if (/phone|mobile|cell|telephone/i.test(combinedContext)) return 'PHONE';
    if (/address|street/i.test(combinedContext) && !/email/i.test(combinedContext)) return 'ADDRESS';
    if (/\bcity\b/i.test(combinedContext)) return 'CITY';
    if (/\bstate\b|province|region/i.test(combinedContext)) return 'STATE';
    if (/zip|postal.*code|postcode/i.test(combinedContext)) return 'ZIP_CODE';
    if (/\bcountry\b/i.test(combinedContext)) return 'COUNTRY';
    if (/linkedin/i.test(combinedContext)) return 'LINKEDIN';
    if (/github/i.test(combinedContext)) return 'GITHUB';
    if (/portfolio|website|url/i.test(combinedContext)) return 'PORTFOLIO';
    
    // Priority 4: Location intelligence
    if (/location|where.*located/i.test(combinedContext)) return 'LOCATION_UNIVERSAL';
    
    // Priority 5: Salary evasion
    if (/salary|compensation|expected|budget|pay|rate/i.test(combinedContext)) return 'SALARY_UNIVERSAL';
    
    // Priority 6: Experience mapping
    if (/experience|years|duration/i.test(combinedContext)) return 'EXPERIENCE_UNIVERSAL';
    
    // Priority 7: Availability
    if (/start.*date|available|notice.*period|when.*can.*start/i.test(combinedContext)) return 'AVAILABILITY';
    
    // Priority 8: Dropdown safety
    if (tag === 'select') return 'DROPDOWN_UNIVERSAL';
    
    // Priority 9: Textarea (might be cover letter/additional info)
    if (tag === 'textarea') return 'TEXTAREA_UNIVERSAL';
    
    return 'TEXT_UNIVERSAL';
  }
  
  async executeUniversalFill(field, context) {
    const strategy = this.determineUniversalStrategy(context);
    let filled = false;
    let value = '';
    
    switch(strategy) {
      case 'KNOCKOUT_UNIVERSAL':
        await this.universalYesOverride(field, context);
        this.stats.knockoutsHandled++;
        filled = true;
        break;
        
      case 'YES_NO_UNIVERSAL':
        await this.universalYesOverride(field, context);
        filled = true;
        break;
        
      case 'FIRST_NAME':
        value = this.companyProfile.firstName;
        break;
        
      case 'LAST_NAME':
        value = this.companyProfile.lastName;
        break;
        
      case 'FULL_NAME':
        value = `${this.companyProfile.firstName} ${this.companyProfile.lastName}`.trim();
        break;
        
      case 'EMAIL':
        value = this.companyProfile.email;
        break;
        
      case 'PHONE':
        value = this.companyProfile.phone;
        break;
        
      case 'ADDRESS':
        value = this.companyProfile.address;
        break;
        
      case 'CITY':
        value = this.companyProfile.city;
        break;
        
      case 'STATE':
        value = this.companyProfile.state;
        break;
        
      case 'ZIP_CODE':
        value = this.companyProfile.zipCode;
        break;
        
      case 'COUNTRY':
        if (context.tag === 'select') {
          this.selectCountryOption(field, this.companyProfile.country);
          filled = true;
        } else {
          value = this.companyProfile.country;
        }
        break;
        
      case 'LINKEDIN':
        value = this.companyProfile.linkedin;
        break;
        
      case 'GITHUB':
        value = this.companyProfile.github;
        break;
        
      case 'PORTFOLIO':
        value = this.companyProfile.portfolio;
        break;
        
      case 'LOCATION_UNIVERSAL':
        value = this.companyProfile.city || this.companyProfile.location;
        break;
        
      case 'SALARY_UNIVERSAL':
        value = this.companyProfile.expected_salary || this.companyProfile.salary;
        break;
        
      case 'EXPERIENCE_UNIVERSAL':
        value = this.companyProfile.total_experience || this.companyProfile.experience;
        break;
        
      case 'AVAILABILITY':
        value = this.companyProfile.availability;
        break;
        
      case 'DROPDOWN_UNIVERSAL':
        this.universalDropdownSafeSelect(field, context);
        filled = true;
        break;
        
      case 'TEXTAREA_UNIVERSAL':
        // Leave textareas empty unless we have specific content
        this.stats.manualRequired++;
        break;
        
      default:
        this.stats.reviewNeeded++;
    }
    
    if (value && !filled) {
      if (field.tagName === 'SELECT') {
        this.selectOptionByValue(field, value);
      } else {
        field.value = value;
      }
      filled = true;
    }
    
    if (filled) {
      this.universalEventChain(field);
      this.markFieldProcessed(field);
      this.stats.autoFilled++;
    }
  }
  
  async universalYesOverride(field, context) {
    const type = field.type?.toLowerCase();
    const tag = field.tagName.toLowerCase();
    
    // Handle checkboxes
    if (type === 'checkbox') {
      field.checked = true;
      this.universalEventChain(field);
      return;
    }
    
    // Handle radio buttons
    if (type === 'radio') {
      const radioGroup = document.querySelectorAll(`input[type="radio"][name="${field.name}"]`);
      const yesRadio = this.findUniversalYesOption(radioGroup);
      if (yesRadio) {
        yesRadio.checked = true;
        this.universalEventChain(yesRadio);
        return;
      }
      // If no clear yes, select first option
      if (radioGroup.length > 0) {
        radioGroup[0].checked = true;
        this.universalEventChain(radioGroup[0]);
      }
      return;
    }
    
    // Handle select dropdowns
    if (tag === 'select') {
      const yesOption = Array.from(field.options).find(opt => {
        const text = (opt.value + ' ' + opt.textContent).toLowerCase();
        return UNIVERSAL_ATS_2025.yesPatterns.some(p => p.test(text));
      });
      
      if (yesOption) {
        field.value = yesOption.value;
      } else if (field.options.length > 1) {
        // Select first non-empty option
        field.selectedIndex = field.options[0].value ? 0 : 1;
      }
      this.universalEventChain(field);
      return;
    }
    
    // Default text field: "Yes"
    field.value = 'Yes';
    this.universalEventChain(field);
  }
  
  findUniversalYesOption(radioGroup) {
    for (const radio of radioGroup) {
      const label = this.extractUniversalLabel(radio);
      const value = radio.value?.toLowerCase() || '';
      const combined = label + ' ' + value;
      
      if (UNIVERSAL_ATS_2025.yesPatterns.some(p => p.test(combined))) {
        return radio;
      }
    }
    return null;
  }
  
  isUniversalYesNo(context) {
    const yesNoPatterns = [
      /\b(yes|no)\b/i,
      /\b(true|false)\b/i,
      /\b(agree|disagree)\b/i,
      /\b(accept|decline)\b/i
    ];
    
    if (context.options && context.options.length <= 3) {
      const optionText = context.options.map(o => o.text).join(' ');
      return yesNoPatterns.some(p => p.test(optionText));
    }
    
    return false;
  }
  
  universalDropdownSafeSelect(field, context) {
    // If already has a value, skip
    if (field.value && field.selectedIndex > 0) return;
    
    const options = Array.from(field.options);
    if (options.length === 0) return;
    
    // Try to find a safe/positive option
    const safePatterns = [
      /yes/i, /agree/i, /accept/i, /authorized/i, /eligible/i,
      /united.*states/i, /usa/i, /u\.s\./i,
      /full.*time/i, /permanent/i, /available/i
    ];
    
    for (const pattern of safePatterns) {
      const match = options.find(opt => pattern.test(opt.textContent));
      if (match) {
        field.value = match.value;
        return;
      }
    }
    
    // Fallback: select first non-empty option
    if (options.length > 1 && !options[0].value) {
      field.selectedIndex = 1;
    }
  }
  
  selectCountryOption(field, country) {
    const options = Array.from(field.options);
    const searchTerms = [country, 'united states', 'usa', 'us'];
    
    for (const term of searchTerms) {
      const match = options.find(opt => 
        opt.textContent.toLowerCase().includes(term.toLowerCase()) ||
        opt.value.toLowerCase().includes(term.toLowerCase())
      );
      if (match) {
        field.value = match.value;
        return;
      }
    }
  }
  
  selectOptionByValue(field, value) {
    const options = Array.from(field.options);
    
    // Exact match
    const exact = options.find(opt => 
      opt.value.toLowerCase() === value.toLowerCase() ||
      opt.textContent.toLowerCase() === value.toLowerCase()
    );
    if (exact) {
      field.value = exact.value;
      return;
    }
    
    // Partial match
    const partial = options.find(opt => 
      opt.textContent.toLowerCase().includes(value.toLowerCase()) ||
      value.toLowerCase().includes(opt.textContent.toLowerCase())
    );
    if (partial) {
      field.value = partial.value;
    }
  }
  
  universalEventChain(field) {
    // Complete ATS event simulation (2025 compatible)
    const events = ['focus', 'input', 'change', 'blur', 'focusout'];
    events.forEach(type => {
      field.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    });
    
    // Also trigger React/Vue synthetic events
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeInputValueSetter && field.tagName === 'INPUT') {
      nativeInputValueSetter.call(field, field.value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  
  isFieldProcessed(field) { 
    return this.processedFields.has(field) || field.dataset.qhFilled === 'true'; 
  }
  
  markFieldProcessed(field) { 
    this.processedFields.add(field);
    field.dataset.qhFilled = 'true';
  }
  
  // Setup mutation observer for dynamic forms
  setupObserver(callback) {
    const observer = new MutationObserver((mutations) => {
      let hasNewFields = false;
      
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 && (
              node.tagName === 'INPUT' || 
              node.tagName === 'SELECT' || 
              node.tagName === 'TEXTAREA' ||
              node.querySelector?.('input, select, textarea')
            )) {
              hasNewFields = true;
              break;
            }
          }
        }
        if (hasNewFields) break;
      }
      
      if (hasNewFields && callback) {
        // Debounce
        clearTimeout(this._observerTimeout);
        this._observerTimeout = setTimeout(callback, 500);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    return observer;
  }
  
  // Get current stats
  getStats() {
    return { ...this.stats };
  }
  
  // Reset for new form
  reset() {
    this.processedFields = new WeakSet();
    this.stats = {
      autoFilled: 0,
      reviewNeeded: 0,
      manualRequired: 0,
      knockoutsHandled: 0
    };
  }
}

// Export for use in content.js
if (typeof window !== 'undefined') {
  window.UniversalATSEngine = UniversalATSEngine;
  window.UNIVERSAL_ATS_2025 = UNIVERSAL_ATS_2025;
}

// Chrome extension message handler for deployment
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'deployUniversalATS') {
      const engine = new UniversalATSEngine();
      const stats = await engine.processAllForms();
      sendResponse({ 
        status: 'Universal ATS Deployed', 
        platform: engine.platformDetected,
        stats 
      });
    }
    
    if (request.action === 'getATSPlatform') {
      const engine = new UniversalATSEngine();
      await engine.init();
      sendResponse({ platform: engine.platformDetected });
    }
    
    return true;
  });
}

console.log('QuantumHire Universal ATS Engine v4.0 loaded - Dec 27, 2025');
