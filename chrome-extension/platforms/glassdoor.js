// QuantumHire AI - Glassdoor Platform Handler
// Handles Glassdoor Easy Apply and external job applications

const GlassdoorHandler = {
  name: 'Glassdoor',
  
  detect() {
    return window.location.hostname.includes('glassdoor.com');
  },
  
  isEasyApply() {
    const easyApplyBtn = document.querySelector('[data-test="applyButton"], .gd-apply-button, button[data-easy-apply="true"]');
    const btnText = easyApplyBtn?.innerText?.toLowerCase() || '';
    return btnText.includes('easy apply') || btnText.includes('apply now');
  },
  
  extractJob() {
    // Job details page
    let title = document.querySelector('[data-test="job-title"], .JobDetails_jobTitle__Rw_gn, h1.heading_Heading__1gBjs')?.innerText?.trim() || '';
    let company = document.querySelector('[data-test="employer-name"], .JobDetails_companyName__jRCe2, a[data-test="employer-link"]')?.innerText?.trim() || '';
    let location = document.querySelector('[data-test="location"], .JobDetails_location__mSg5h, [data-test="job-location"]')?.innerText?.trim() || '';
    
    // Clean up company name (remove rating)
    company = company.replace(/[\d.]+$/, '').trim();
    
    const descriptionEl = document.querySelector('[data-test="job-description-content"], .JobDetails_jobDescription__uW_fK, #JobDescriptionContainer');
    const description = descriptionEl?.innerText?.trim() || '';
    
    // Check for external apply URL
    const externalLink = document.querySelector('a[data-test="external-apply-link"], .gd-apply-button a[href*="http"]');
    const externalUrl = externalLink?.href || null;
    
    return {
      title,
      company,
      location,
      description,
      platform: 'Glassdoor',
      isEasyApply: this.isEasyApply(),
      externalUrl,
      url: window.location.href
    };
  },
  
  async startEasyApply(profileData) {
    console.log('QuantumHire: Starting Glassdoor Easy Apply');
    
    const applyBtn = document.querySelector('[data-test="applyButton"], .gd-apply-button, button[data-easy-apply="true"]');
    if (!applyBtn) {
      return { success: false, error: 'Apply button not found' };
    }
    
    applyBtn.click();
    await this.wait(2000);
    
    // Check for modal
    const modal = await this.waitForElement('[data-test="applicationModal"], .modal-content, [role="dialog"]', 5000);
    if (modal) {
      return { success: true, modalOpen: true };
    }
    
    // Check if redirected to external site
    if (window.location.href !== this.currentUrl) {
      return { success: true, redirected: true };
    }
    
    return { success: true };
  },
  
  async fillForm(profileData, tailoredData) {
    let filledCount = 0;
    const modal = document.querySelector('[data-test="applicationModal"], .modal-content, [role="dialog"], body');
    
    const fieldMappings = [
      { selector: 'input[name="firstName"], input[id*="firstName"]', value: profileData.first_name },
      { selector: 'input[name="lastName"], input[id*="lastName"]', value: profileData.last_name },
      { selector: 'input[name="email"], input[type="email"]', value: profileData.email },
      { selector: 'input[name="phone"], input[type="tel"]', value: profileData.phone },
      { selector: 'input[name="currentCompany"], input[id*="company"]', value: profileData.work_experience?.[0]?.company || '' },
      { selector: 'input[name="currentTitle"], input[id*="title"]', value: profileData.work_experience?.[0]?.title || '' },
    ];
    
    for (const mapping of fieldMappings) {
      const inputs = modal?.querySelectorAll(mapping.selector) || [];
      for (const input of inputs) {
        if (input && mapping.value && !input.value && input.offsetParent !== null) {
          await this.fillInput(input, mapping.value);
          filledCount++;
        }
      }
    }
    
    // Handle resume upload
    const fileInput = modal?.querySelector('input[type="file"]');
    if (fileInput) {
      console.log('QuantumHire: Resume upload field found');
    }
    
    // Handle cover letter textarea
    const coverLetterTextarea = modal?.querySelector('textarea[name*="cover"], textarea[id*="cover"]');
    if (coverLetterTextarea && tailoredData?.coverLetter && !coverLetterTextarea.value) {
      await this.fillInput(coverLetterTextarea, tailoredData.coverLetter);
      filledCount++;
    }
    
    // Handle common dropdown questions
    const selects = modal?.querySelectorAll('select') || [];
    for (const select of selects) {
      if (select.value) continue;
      const label = select.closest('.form-group, .field-wrapper')?.querySelector('label')?.innerText?.toLowerCase() || '';
      
      if (label.includes('experience')) {
        await this.selectOption(select, profileData.total_experience || '5');
        filledCount++;
      }
    }
    
    return { filled: filledCount };
  },
  
  async navigateForm() {
    const modal = document.querySelector('[data-test="applicationModal"], .modal-content, [role="dialog"]');
    
    // Look for next/continue/submit buttons
    const buttons = modal?.querySelectorAll('button') || [];
    for (const btn of buttons) {
      const btnText = btn.innerText.toLowerCase();
      if (btn.disabled) continue;
      
      if (btnText.includes('submit') || btnText.includes('apply')) {
        return { done: true, canSubmit: true };
      }
      
      if (btnText.includes('next') || btnText.includes('continue')) {
        btn.click();
        await this.wait(1500);
        return { done: false, advanced: true };
      }
    }
    
    return { done: false };
  },
  
  async submitApplication() {
    const modal = document.querySelector('[data-test="applicationModal"], .modal-content, [role="dialog"]');
    const buttons = modal?.querySelectorAll('button') || [];
    
    for (const btn of buttons) {
      const btnText = btn.innerText.toLowerCase();
      if (!btn.disabled && (btnText.includes('submit') || btnText.includes('apply'))) {
        btn.click();
        await this.wait(3000);
        
        const success = document.querySelector('[data-test="success"], .application-success, .thank-you');
        return { success: !!success || !document.querySelector('[data-test="applicationModal"]') };
      }
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
  window.QuantumHireGlassdoor = GlassdoorHandler;
}
