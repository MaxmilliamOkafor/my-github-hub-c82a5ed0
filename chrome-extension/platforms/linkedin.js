// QuantumHire AI - LinkedIn Platform Handler
// Handles LinkedIn Easy Apply and external job applications

const LinkedInHandler = {
  name: 'LinkedIn',
  
  detect() {
    return window.location.hostname.includes('linkedin.com');
  },
  
  isEasyApply() {
    return !!document.querySelector('.jobs-apply-button--top-card, .jobs-s-apply button, [data-control-name="jobdetails_topcard_inapply"]');
  },
  
  extractJob() {
    const title = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.t-24')?.innerText?.trim() || '';
    const company = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, a.ember-view.t-black')?.innerText?.trim() || '';
    const location = document.querySelector('.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet')?.innerText?.trim() || '';
    const descriptionEl = document.querySelector('.jobs-description__content, .jobs-box__html-content, #job-details');
    const description = descriptionEl?.innerText?.trim() || '';
    
    // Get external apply URL if not Easy Apply
    let externalUrl = null;
    const externalLink = document.querySelector('a[data-tracking-control-name="public_jobs_apply-link-offsite"], .jobs-apply-button a[href*="http"]');
    if (externalLink) {
      externalUrl = externalLink.href;
    }
    
    return {
      title,
      company,
      location,
      description,
      platform: 'LinkedIn',
      isEasyApply: this.isEasyApply(),
      externalUrl,
      url: window.location.href
    };
  },
  
  async startEasyApply(profileData) {
    console.log('QuantumHire: Starting LinkedIn Easy Apply');
    
    // Find and click Easy Apply button
    const easyApplyBtn = document.querySelector('.jobs-apply-button--top-card, .jobs-s-apply button, [data-control-name="jobdetails_topcard_inapply"]');
    if (!easyApplyBtn) {
      return { success: false, error: 'Easy Apply button not found' };
    }
    
    easyApplyBtn.click();
    await this.wait(1500);
    
    // Wait for modal
    const modal = await this.waitForElement('.jobs-easy-apply-modal, .artdeco-modal--layer-default', 5000);
    if (!modal) {
      return { success: false, error: 'Easy Apply modal did not open' };
    }
    
    return { success: true, modalOpen: true };
  },
  
  async fillEasyApplyForm(profileData, tailoredData) {
    const modal = document.querySelector('.jobs-easy-apply-modal, .artdeco-modal--layer-default');
    if (!modal) return { filled: 0 };
    
    let filledCount = 0;
    
    // Fill basic fields
    const fieldMappings = [
      { selector: 'input[name="firstName"], input[id*="first-name"]', value: profileData.first_name },
      { selector: 'input[name="lastName"], input[id*="last-name"]', value: profileData.last_name },
      { selector: 'input[name="email"], input[type="email"]', value: profileData.email },
      { selector: 'input[name="phone"], input[type="tel"]', value: profileData.phone },
      { selector: 'input[name="city"], input[id*="city"]', value: profileData.city },
    ];
    
    for (const mapping of fieldMappings) {
      const input = modal.querySelector(mapping.selector);
      if (input && mapping.value && !input.value) {
        await this.fillInput(input, mapping.value);
        filledCount++;
      }
    }
    
    // Handle file upload (resume)
    const fileInput = modal.querySelector('input[type="file"]');
    if (fileInput && tailoredData?.resumeBlob) {
      // Resume upload would be handled here
      console.log('QuantumHire: Resume upload available');
    }
    
    // Handle dropdown questions
    const selects = modal.querySelectorAll('select');
    for (const select of selects) {
      if (select.value) continue;
      const label = select.closest('div')?.querySelector('label')?.innerText?.toLowerCase() || '';
      
      if (label.includes('experience') || label.includes('years')) {
        await this.selectOption(select, profileData.total_experience || '5');
        filledCount++;
      }
    }
    
    return { filled: filledCount };
  },
  
  async navigateEasyApply() {
    const modal = document.querySelector('.jobs-easy-apply-modal, .artdeco-modal--layer-default');
    if (!modal) return { done: false };
    
    // Check for submit button
    const submitBtn = modal.querySelector('button[aria-label*="Submit"], button[data-control-name="submit_unify"]');
    if (submitBtn && !submitBtn.disabled) {
      return { done: true, canSubmit: true };
    }
    
    // Check for next button
    const nextBtn = modal.querySelector('button[aria-label*="Continue"], button[aria-label*="Next"], button[data-control-name="continue_unify"]');
    if (nextBtn && !nextBtn.disabled) {
      nextBtn.click();
      await this.wait(1000);
      return { done: false, advanced: true };
    }
    
    // Check for review button
    const reviewBtn = modal.querySelector('button[aria-label*="Review"]');
    if (reviewBtn && !reviewBtn.disabled) {
      reviewBtn.click();
      await this.wait(1000);
      return { done: false, advanced: true };
    }
    
    return { done: false };
  },
  
  async submitApplication() {
    const modal = document.querySelector('.jobs-easy-apply-modal, .artdeco-modal--layer-default');
    if (!modal) return { success: false };
    
    const submitBtn = modal.querySelector('button[aria-label*="Submit"], button[data-control-name="submit_unify"]');
    if (submitBtn && !submitBtn.disabled) {
      submitBtn.click();
      await this.wait(2000);
      
      // Check for success
      const success = document.querySelector('.artdeco-inline-feedback--success, .jobs-apply-success');
      return { success: !!success };
    }
    
    return { success: false };
  },
  
  // Utility methods
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  async waitForElement(selector, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = document.querySelector(selector);
      if (el) return el;
      await this.wait(200);
    }
    return null;
  },
  
  async fillInput(input, value) {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await this.wait(100);
  },
  
  async selectOption(select, value) {
    const options = Array.from(select.options);
    const match = options.find(o => 
      o.text.toLowerCase().includes(value.toLowerCase()) ||
      o.value.toLowerCase().includes(value.toLowerCase())
    );
    if (match) {
      select.value = match.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
};

// Export for use in content script
if (typeof window !== 'undefined') {
  window.QuantumHireLinkedIn = LinkedInHandler;
}
