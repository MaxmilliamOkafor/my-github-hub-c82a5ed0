// QuantumHire AI - Indeed Platform Handler
// Handles Indeed Easy Apply and external job applications

const IndeedHandler = {
  name: 'Indeed',
  
  detect() {
    return window.location.hostname.includes('indeed.com');
  },
  
  isEasyApply() {
    const applyBtn = document.querySelector('#indeedApplyButton, .ia-IndeedApplyButton, button[data-indeed-apply-button], .jobsearch-IndeedApplyButton-contentWrapper');
    return !!applyBtn;
  },
  
  extractJob() {
    // Job posting page selectors
    let title = document.querySelector('.jobsearch-JobInfoHeader-title, h1.jobsearch-JobInfoHeader-title, .job-title, [data-testid="jobsearch-JobInfoHeader-title"]')?.innerText?.trim() || '';
    let company = document.querySelector('.jobsearch-InlineCompanyRating-companyHeader, [data-company-name], .jobsearch-InlineCompanyRating a, [data-testid="inlineHeader-companyName"]')?.innerText?.trim() || '';
    let location = document.querySelector('.jobsearch-JobInfoHeader-subtitle .css-1wyy6io, [data-testid="job-location"], .jobsearch-JobInfoHeader-subtitle div:last-child')?.innerText?.trim() || '';
    
    // Try job card if on search results page
    if (!title) {
      const activeCard = document.querySelector('.jobCard_mainContent.selected, .job_seen_beacon.selected, .resultContent');
      if (activeCard) {
        title = activeCard.querySelector('.jobTitle, h2 a span')?.innerText?.trim() || '';
        company = activeCard.querySelector('.companyName, [data-testid="company-name"]')?.innerText?.trim() || '';
        location = activeCard.querySelector('.companyLocation, [data-testid="text-location"]')?.innerText?.trim() || '';
      }
    }
    
    const descriptionEl = document.querySelector('#jobDescriptionText, .jobsearch-JobComponent-description, [id="jobDescriptionText"]');
    const description = descriptionEl?.innerText?.trim() || '';
    
    // Check for external apply
    const externalLink = document.querySelector('a[data-hiring-event="true"], .jobsearch-IndeedApplyButton-directApply a');
    const externalUrl = externalLink?.href || null;
    
    return {
      title,
      company,
      location,
      description,
      platform: 'Indeed',
      isEasyApply: this.isEasyApply(),
      externalUrl,
      url: window.location.href
    };
  },
  
  async startEasyApply(profileData) {
    console.log('QuantumHire: Starting Indeed Easy Apply');
    
    const easyApplyBtn = document.querySelector('#indeedApplyButton, .ia-IndeedApplyButton, button[data-indeed-apply-button]');
    if (!easyApplyBtn) {
      return { success: false, error: 'Easy Apply button not found' };
    }
    
    easyApplyBtn.click();
    await this.wait(2000);
    
    // Indeed often opens in iframe or new window
    const iframe = document.querySelector('iframe[src*="indeed.com/viewjob"], iframe[id*="indeed-ia"]');
    if (iframe) {
      return { success: true, isIframe: true };
    }
    
    // Check for modal
    const modal = document.querySelector('.ia-Modal, [role="dialog"]');
    if (modal) {
      return { success: true, modalOpen: true };
    }
    
    return { success: true };
  },
  
  async fillForm(profileData, tailoredData) {
    let filledCount = 0;
    const container = document.querySelector('.ia-Modal, [role="dialog"], body');
    
    const fieldMappings = [
      { selector: 'input[name="firstName"], input[id*="firstName"], input[placeholder*="First"]', value: profileData.first_name },
      { selector: 'input[name="lastName"], input[id*="lastName"], input[placeholder*="Last"]', value: profileData.last_name },
      { selector: 'input[name="email"], input[type="email"], input[id*="email"]', value: profileData.email },
      { selector: 'input[name="phone"], input[type="tel"], input[id*="phone"]', value: profileData.phone },
      { selector: 'input[name="city"], input[id*="city"]', value: profileData.city },
      { selector: 'input[name="zip"], input[id*="zip"], input[id*="postal"]', value: profileData.zip_code },
    ];
    
    for (const mapping of fieldMappings) {
      const inputs = container.querySelectorAll(mapping.selector);
      for (const input of inputs) {
        if (input && mapping.value && !input.value && input.offsetParent !== null) {
          await this.fillInput(input, mapping.value);
          filledCount++;
        }
      }
    }
    
    // Handle Indeed-specific questions
    const questions = container.querySelectorAll('.ia-Questions-item, .ia-question, [data-testid="question"]');
    for (const question of questions) {
      const questionText = question.querySelector('label, .ia-Questions-itemLabel')?.innerText?.toLowerCase() || '';
      
      // Work authorization
      if (questionText.includes('authorized') || questionText.includes('legally')) {
        const yesOption = question.querySelector('input[value="Yes"], input[value="yes"], input[value="1"]');
        if (yesOption) {
          yesOption.click();
          filledCount++;
        }
      }
      
      // Sponsorship
      if (questionText.includes('sponsor') || questionText.includes('visa')) {
        const noOption = question.querySelector('input[value="No"], input[value="no"], input[value="0"]');
        if (noOption) {
          noOption.click();
          filledCount++;
        }
      }
      
      // Experience years
      if (questionText.includes('years of experience') || questionText.includes('experience')) {
        const input = question.querySelector('input[type="text"], input[type="number"]');
        if (input && !input.value) {
          await this.fillInput(input, profileData.total_experience || '5');
          filledCount++;
        }
      }
    }
    
    return { filled: filledCount };
  },
  
  async navigateForm() {
    const container = document.querySelector('.ia-Modal, [role="dialog"], body');
    
    // Check for continue/next button
    const nextBtn = container?.querySelector('button[type="submit"], button.ia-continueButton, button[data-testid="continue-button"], .ia-Continue button');
    if (nextBtn && !nextBtn.disabled) {
      // Check if it's a submit button
      const btnText = nextBtn.innerText.toLowerCase();
      if (btnText.includes('submit') || btnText.includes('apply')) {
        return { done: true, canSubmit: true };
      }
      
      nextBtn.click();
      await this.wait(1500);
      return { done: false, advanced: true };
    }
    
    return { done: false };
  },
  
  async submitApplication() {
    const container = document.querySelector('.ia-Modal, [role="dialog"], body');
    const submitBtn = container?.querySelector('button[type="submit"]:not([disabled]), .ia-submitButton, button[data-testid="submit-button"]');
    
    if (submitBtn) {
      const btnText = submitBtn.innerText.toLowerCase();
      if (btnText.includes('submit') || btnText.includes('apply')) {
        submitBtn.click();
        await this.wait(3000);
        
        const success = document.querySelector('.ia-success, [data-testid="success"], .jobsearch-ApplicationSuccess');
        return { success: !!success };
      }
    }
    
    return { success: false };
  },
  
  // Utility methods
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  async fillInput(input, value) {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    await this.wait(100);
  }
};

// Export for use in content script
if (typeof window !== 'undefined') {
  window.QuantumHireIndeed = IndeedHandler;
}
