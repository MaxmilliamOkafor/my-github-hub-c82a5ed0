// QuantumHire AI - Advanced Content Script v2.0
// Automatic multi-page workflow, smart form filling, PDF generation & upload

console.log('QuantumHire AI: Advanced content script v2.0 loaded');

// ============= EXTENSION DETECTION MARKER =============
// Add a marker to the page so the web app can detect if the extension is installed
(function addExtensionMarker() {
  const marker = document.createElement('div');
  marker.id = 'quantumhire-extension-marker';
  marker.setAttribute('data-quantumhire-extension', 'true');
  marker.setAttribute('data-version', '2.0');
  marker.style.display = 'none';
  document.body.appendChild(marker);
  console.log('QuantumHire AI: Extension marker added');
})();

// ============= CHROME RUNTIME MESSAGE LISTENER =============
// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SPEED_CHANGED') {
    console.log('QuantumHire AI: Speed changed to', message.speed, 'ms');
    // Speed is automatically picked up from storage on next getDelayForSpeed() call
  }
  return true;
});
// ============= WEB APP COMMUNICATION =============
// Listen for messages from the web app for auto-apply mode
window.addEventListener('message', async (event) => {
  // Only accept messages from the same origin or trusted sources
  if (event.source !== window) return;
  
  const { type, action, data } = event.data || {};
  
  if (type !== 'QUANTUMHIRE_WEBAPP') return;
  
  console.log('QuantumHire AI: Received webapp message:', action, data);
  
  switch (action) {
    case 'AUTO_APPLY_START':
      // Trigger autofill with the job data
      if (data?.jobUrl) {
        try {
          // Get profile and tailored data from storage
          const storageData = await chrome.storage.local.get(['userProfile', 'accessToken', 'autofillEnabled']);
          
          // Auto-show the control panel
          autoShowControlPanel(data);
          
          if (storageData.autofillEnabled !== false && storageData.userProfile) {
            // Start autofill process
            setTimeout(() => {
              startAutofillProcess(storageData.userProfile, data.tailoredData || {});
            }, 2000);
          }
          
          // Send confirmation back to webapp
          window.postMessage({
            type: 'QUANTUMHIRE_EXTENSION',
            action: 'AUTO_APPLY_STARTED',
            success: true,
          }, '*');
        } catch (error) {
          window.postMessage({
            type: 'QUANTUMHIRE_EXTENSION',
            action: 'AUTO_APPLY_ERROR',
            error: error.message,
          }, '*');
        }
      }
      break;
    
    case 'SHOW_CONTROL_PANEL':
      // Trigger to show the floating control panel
      autoShowControlPanel(data);
      break;
      
    case 'CHECK_EXTENSION':
      window.postMessage({
        type: 'QUANTUMHIRE_EXTENSION',
        action: 'EXTENSION_DETECTED',
        version: '2.0',
      }, '*');
      break;
      
    case 'GET_STATUS':
      window.postMessage({
        type: 'QUANTUMHIRE_EXTENSION',
        action: 'STATUS_RESPONSE',
        status: {
          isRunning: automationState.isRunning,
          isPaused: automationState.isPaused,
          currentStep: automationState.currentStep,
        },
      }, '*');
      break;
  }
});

// Helper to start autofill on current page
async function startAutofillProcess(profile, tailoredData) {
  console.log('QuantumHire AI: Starting autofill process from webapp trigger');
  
  // Detect platform
  const platform = detectCurrentPlatform();
  if (!platform) {
    console.log('QuantumHire AI: Unknown platform, using generic autofill');
  }
  
  // Wait for page to be fully loaded
  await new Promise(r => setTimeout(r, 1500));
  
  // Trigger main autofill
  try {
    await autofillForm(tailoredData || {}, null, {
      autoMode: true,
      autoSubmit: false,
      generatePdfs: true,
    });
    
    window.postMessage({
      type: 'QUANTUMHIRE_EXTENSION',
      action: 'AUTOFILL_COMPLETE',
      success: true,
    }, '*');
  } catch (error) {
    window.postMessage({
      type: 'QUANTUMHIRE_EXTENSION',
      action: 'AUTOFILL_ERROR',
      error: error.message,
    }, '*');
  }
}

// Auto-show control panel when triggered from webapp
async function autoShowControlPanel(data = {}) {
  console.log('QuantumHire AI: Auto-showing control panel');
  
  // Wait a moment for page to load
  await new Promise(r => setTimeout(r, 500));
  
  // Create and show the control panel if QHControlPanel is available
  if (typeof window.QHControlPanel !== 'undefined' && window.QHControlPanel.create) {
    window.QHControlPanel.create();
    
    // Update with job info if available
    if (data?.jobTitle || data?.company) {
      setTimeout(() => {
        window.QHControlPanel.showCurrentJob(data.jobTitle || 'Job Application', data.company || 'Company');
        window.QHControlPanel.updateStatus('ready', 'Ready to Apply', 'Extension panel auto-opened');
      }, 300);
    }
    
    // Load queue progress from storage
    try {
      const storageData = await chrome.storage.local.get(['batchProgress', 'jobQueue']);
      const progress = storageData.batchProgress || { total: 0, applied: 0, skipped: 0 };
      const queue = storageData.jobQueue || [];
      
      if (queue.length > 0 || progress.total > 0) {
        // Show stats row with queue info
        const panel = document.getElementById('qh-control-panel');
        if (panel) {
          const statsRow = panel.querySelector('#qh-stats-row');
          if (statsRow) {
            statsRow.style.display = 'flex';
            panel.querySelector('#qh-stat-applied').textContent = progress.applied || 0;
            panel.querySelector('#qh-stat-failed').textContent = progress.skipped || 0;
            panel.querySelector('#qh-stat-skipped').textContent = queue.length;
          }
        }
      }
    } catch (e) {
      console.log('Failed to load queue progress:', e);
    }
  } else {
    console.log('QuantumHire AI: Control panel not available, creating fallback');
    // Fallback: create a simple notification
    showSimpleNotification('QuantumHire AI is ready!', 'The extension will auto-fill the application form.');
  }
  
  // Notify webapp that panel is shown
  window.postMessage({
    type: 'QUANTUMHIRE_EXTENSION',
    action: 'PANEL_SHOWN',
    success: true,
  }, '*');
}

// Simple notification fallback
function showSimpleNotification(title, message) {
  const existing = document.getElementById('qh-simple-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.id = 'qh-simple-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: slideIn 0.3s ease;
  `;
  notification.innerHTML = `
    <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${title}</div>
    <div style="font-size: 12px; opacity: 0.9;">${message}</div>
  `;
  
  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(notification);
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// ============= PLATFORM DETECTION & CONFIGURATION =============

const PLATFORM_CONFIG = {
  workday: {
    detect: () => window.location.hostname.includes('workday.com') || window.location.hostname.includes('myworkdayjobs.com'),
    nextButton: '[data-automation-id="bottom-navigation-next-button"], button[data-automation-id="nextButton"], button[data-automation-id="continueButton"]',
    submitButton: '[data-automation-id="bottom-navigation-submit-button"]',
    // Workday-specific pre-application flow: Apply → Apply Manually
    preApplyFlow: true,
    selectors: {
      firstName: 'input[data-automation-id="firstName"], input[data-automation-id="legalNameSection_firstName"]',
      lastName: 'input[data-automation-id="lastName"], input[data-automation-id="legalNameSection_lastName"]',
      email: 'input[data-automation-id="email"], input[data-automation-id="emailAddress"]',
      phone: 'input[data-automation-id="phone"], input[data-automation-id="phoneNumber"]',
      address: 'input[data-automation-id="addressLine1"], input[data-automation-id="addressSection_addressLine1"]',
      city: 'input[data-automation-id="city"], input[data-automation-id="addressSection_city"]',
      state: 'input[data-automation-id="state"], input[data-automation-id="addressSection_countryRegion"]',
      zipCode: 'input[data-automation-id="postalCode"], input[data-automation-id="addressSection_postalCode"]',
      country: 'select[data-automation-id="country"], input[data-automation-id="country"], button[data-automation-id="countryDropdown"]',
      resume: 'input[type="file"][data-automation-id*="file"], input[type="file"]',
    },
    // Workday dropdown patterns
    dropdownTrigger: 'button[aria-haspopup="listbox"], [data-automation-id*="dropdown"], [data-automation-id*="select"]',
    listboxOption: '[data-automation-id*="promptOption"], [role="option"]',
  },
  greenhouse: {
    detect: () => window.location.hostname.includes('greenhouse.io') || window.location.hostname.includes('boards.greenhouse.io') || window.location.hostname.includes('job-boards.greenhouse.io'),
    nextButton: 'button[type="submit"], input[type="submit"]',
    submitButton: '#submit_app, button[type="submit"]',
    selectors: {
      firstName: '#first_name',
      lastName: '#last_name',
      email: '#email',
      phone: '#phone',
      linkedin: 'input[name*="linkedin"], input[id*="linkedin"]',
      resume: 'input[type="file"][name*="resume"], input[type="file"][id*="resume"]',
      coverLetter: 'textarea[name*="cover_letter"], textarea[id*="cover_letter"]',
      city: 'input[name*="location"], input[id*="location"], input[name*="city"]',
      country: 'select[name*="country"], select[id*="country"]',
    },
    // Greenhouse custom field patterns - for dynamic dropdown detection
    dropdownPatterns: {
      location: 'where would you like to be based|preferred.*location|work.*location',
      usStatus: 'us person|us.*person',
      ukWorkRight: 'right to work.*uk|uk.*right.*work',
    }
  },
  lever: {
    detect: () => window.location.hostname.includes('lever.co') || window.location.hostname.includes('jobs.lever.co'),
    nextButton: 'button[type="submit"]',
    submitButton: 'button[type="submit"]',
    selectors: {
      fullName: 'input[name="name"]',
      email: 'input[name="email"]',
      phone: 'input[name="phone"]',
      linkedin: 'input[name="urls[LinkedIn]"]',
      github: 'input[name="urls[GitHub]"]',
      portfolio: 'input[name="urls[Portfolio]"]',
      resume: 'input[type="file"][name="resume"]',
      coverLetter: 'textarea[name="comments"]',
    }
  },
  icims: {
    detect: () => window.location.hostname.includes('icims.com'),
    nextButton: 'button.next, input[value="Next"], button:contains("Next")',
    submitButton: 'button.submit, input[value="Submit"]',
    selectors: { firstName: '#firstName', lastName: '#lastName', email: '#email', phone: '#phone' }
  },
  taleo: {
    detect: () => window.location.hostname.includes('taleo.net'),
    nextButton: 'input[type="submit"][value*="Next"], button:contains("Next")',
    submitButton: 'input[type="submit"][value*="Submit"]',
    selectors: {}
  },
  ashby: {
    detect: () => window.location.hostname.includes('ashbyhq.com'),
    nextButton: 'button[type="submit"]',
    submitButton: 'button[type="submit"]',
    selectors: { firstName: 'input[name="firstName"]', lastName: 'input[name="lastName"]', email: 'input[name="email"]', phone: 'input[name="phone"]', linkedin: 'input[name="linkedInUrl"]' }
  },
  smartrecruiters: {
    detect: () => window.location.hostname.includes('smartrecruiters.com'),
    nextButton: 'button[type="submit"]',
    submitButton: 'button[type="submit"]',
    selectors: { firstName: 'input[name="firstName"]', lastName: 'input[name="lastName"]', email: 'input[name="email"]', phone: 'input[name="phone"]' }
  },
  workable: {
    detect: () => window.location.hostname.includes('workable.com') || window.location.hostname.includes('apply.workable.com'),
    nextButton: 'button[type="submit"], button[data-ui="overview-apply-now"]',
    submitButton: 'button[type="submit"]',
    selectors: {
      firstName: 'input[name="firstname"], input[data-ui="firstname"]',
      lastName: 'input[name="lastname"], input[data-ui="lastname"]',
      email: 'input[name="email"], input[type="email"]',
      phone: 'input[name="phone"], input[type="tel"]',
      resume: 'input[type="file"]',
      coverLetter: 'textarea[name="cover_letter"], textarea[data-ui="cover-letter"]',
      linkedin: 'input[name="linkedin"], input[placeholder*="linkedin"]',
    },
    // Workable job details extraction
    jobTitle: 'h1[data-ui="job-title"], h1, .job-title',
    company: '[data-ui="company-name"], .company-name, header a[href="/"]',
    location: '[data-ui="job-location"], .location, [data-ui="job-info"] span',
    description: '[data-ui="job-description"], .job-description, section[data-ui="description"]',
  }
};

// ============= WORKDAY PRE-APPLICATION FLOW =============
// Handles: Click "Apply" → Wait for menu → Select "Apply Manually"

async function handleWorkdayPreApplyFlow() {
  console.log('QuantumHire AI: Checking Workday pre-apply flow...');
  
  // Step 1: Check if we're on a job posting page (not yet in application form)
  const isJobPostingPage = !document.querySelector('[data-automation-id="applicationForm"], form[data-automation-id]');
  if (!isJobPostingPage) {
    console.log('QuantumHire AI: Already in application form, skipping pre-apply');
    return { success: true, skipped: true };
  }
  
  // Step 2: Find and click "Apply" button
  const applyButtonSelectors = [
    'button[data-automation-id="jobPostingApplyButton"]',
    'a[data-automation-id="jobPostingApplyButton"]',
    'button[aria-label*="Apply"]',
    'a[aria-label*="Apply"]',
  ];
  
  let applyButton = null;
  for (const sel of applyButtonSelectors) {
    applyButton = document.querySelector(sel);
    if (applyButton && applyButton.offsetParent !== null) break;
  }
  
  // Fallback: find by text
  if (!applyButton) {
    const buttons = document.querySelectorAll('button, a[role="button"], a.css-*');
    for (const btn of buttons) {
      const text = btn.innerText?.trim().toLowerCase() || '';
      if (text === 'apply' || text === 'apply now' || text.includes('apply for')) {
        if (btn.offsetParent !== null) {
          applyButton = btn;
          break;
        }
      }
    }
  }
  
  if (!applyButton) {
    console.log('QuantumHire AI: No Apply button found (may already be in form)');
    return { success: true, skipped: true, reason: 'No Apply button found' };
  }
  
  console.log('QuantumHire AI: Clicking Apply button...');
  showToast('Clicking Apply...', 'info');
  
  try {
    applyButton.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 300));
    applyButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  } catch {
    applyButton.click();
  }
  
  // Step 3: Wait for Apply Method menu to appear
  await new Promise(r => setTimeout(r, 1500));
  
  // Step 4: Look for "Apply Manually" option
  const applyManuallySelectors = [
    '[data-automation-id="applyManually"]',
    '[data-automation-id*="applyManually"]',
    'button[data-automation-id*="manual"]',
    '[role="menuitem"]',
    '[role="option"]',
    '.css-1dbjc4n button', // Workday React buttons
    'button, a',
  ];
  
  let applyManuallyOption = null;
  
  for (const sel of applyManuallySelectors) {
    const candidates = document.querySelectorAll(sel);
    for (const el of candidates) {
      const text = el.innerText?.toLowerCase() || el.getAttribute('aria-label')?.toLowerCase() || '';
      if (text.includes('apply manually') || text.includes('manual')) {
        if (el.offsetParent !== null) {
          applyManuallyOption = el;
          break;
        }
      }
    }
    if (applyManuallyOption) break;
  }
  
  if (!applyManuallyOption) {
    // Check if a modal/dialog appeared
    const dialog = document.querySelector('[role="dialog"], [data-automation-id="dialog"], .wd-popup, .modal');
    if (dialog) {
      const options = dialog.querySelectorAll('button, a, [role="button"], [role="menuitem"]');
      for (const opt of options) {
        const text = opt.innerText?.toLowerCase() || '';
        if (text.includes('manually') || text.includes('manual')) {
          applyManuallyOption = opt;
          break;
        }
      }
    }
  }
  
  if (!applyManuallyOption) {
    console.log('QuantumHire AI: Apply Manually option not found, checking if form loaded directly');
    // Maybe clicking Apply went directly to form (some Workday configs skip the menu)
    await new Promise(r => setTimeout(r, 1000));
    const formLoaded = document.querySelector('[data-automation-id="applicationForm"], form input[type="text"], input[data-automation-id]');
    if (formLoaded) {
      console.log('QuantumHire AI: Form loaded directly, proceeding');
      return { success: true, directForm: true };
    }
    return { success: false, error: 'Apply Manually option not found' };
  }
  
  console.log('QuantumHire AI: Clicking Apply Manually...');
  showToast('Selecting Apply Manually...', 'info');
  
  try {
    applyManuallyOption.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 200));
    applyManuallyOption.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  } catch {
    applyManuallyOption.click();
  }
  
  // Wait for form to load
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('QuantumHire AI: Workday pre-apply flow complete');
  showToast('Application form loading...', 'success');
  
  return { success: true };
}

// ============= WORKDAY DROPDOWN FILLING (Enhanced) =============
// Workday uses custom dropdowns with data-automation-id and aria-haspopup="listbox"

async function fillWorkdayDropdown(dropdownButton, answerValue) {
  if (!dropdownButton) return false;
  const answerLower = String(answerValue).toLowerCase().trim();
  
  try {
    console.log(`QuantumHire AI: Filling Workday dropdown with "${answerValue}"`);
    
    // Click to open dropdown
    dropdownButton.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 150));
    
    dropdownButton.focus();
    dropdownButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    
    await new Promise(r => setTimeout(r, 400));
    
    // Find listbox
    const ariaControls = dropdownButton.getAttribute('aria-controls');
    let listbox = ariaControls ? document.getElementById(ariaControls) : null;
    
    if (!listbox) {
      listbox = document.querySelector('[role="listbox"], [data-automation-id*="promptOption-"]')?.closest('[role="listbox"]');
    }
    
    if (!listbox) {
      // Try popup/dialog
      listbox = document.querySelector('[role="dialog"] [role="listbox"], .wd-popup [role="listbox"], [data-automation-id*="dropdown"] + [role="listbox"]');
    }
    
    if (!listbox) {
      // Last resort: find any visible options
      const visibleOptions = Array.from(document.querySelectorAll('[role="option"], [data-automation-id*="promptOption"]'))
        .filter(o => o.offsetParent !== null);
      if (visibleOptions.length > 0) {
        listbox = visibleOptions[0].closest('[role="listbox"]') || visibleOptions[0].parentElement;
      }
    }
    
    if (!listbox) {
      console.log('QuantumHire AI: Workday listbox not found');
      return false;
    }
    
    // Get all options
    const options = Array.from(listbox.querySelectorAll('[role="option"], [data-automation-id*="promptOption"], li, div'))
      .filter(o => o.offsetParent !== null && o.innerText?.trim());
    
    // Try exact match
    let match = options.find(o => o.innerText.toLowerCase().trim() === answerLower);
    
    // Try partial match
    if (!match) {
      match = options.find(o => {
        const optText = o.innerText.toLowerCase().trim();
        return optText.includes(answerLower) || answerLower.includes(optText);
      });
    }
    
    // Yes/No variations
    if (!match && (answerLower === 'yes' || answerLower === 'no')) {
      match = options.find(o => {
        const t = o.innerText.toLowerCase().trim();
        if (answerLower === 'yes') return t === 'yes' || t.includes('i agree') || t === 'true';
        return t === 'no' || t === 'false';
      });
    }
    
    if (!match) {
      console.log(`QuantumHire AI: No Workday option match for "${answerValue}". Options:`, options.map(o => o.innerText.trim()));
      // Close dropdown
      document.body.click();
      return false;
    }
    
    console.log(`QuantumHire AI: Selecting Workday option: "${match.innerText.trim()}"`);
    
    match.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 100));
    
    match.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    
    dropdownButton.classList.add('quantumhire-filled');
    return true;
  } catch (e) {
    console.error('QuantumHire AI: Workday dropdown error', e);
    return false;
  }
}

// ============= AUTOMATION CONTROL STATE =============

let automationState = {
  speed: 1,
  isPaused: false,
  isRunning: false,
  shouldSkip: false,
  shouldQuit: false,
  autoMode: true, // Auto-advance through pages
  autoSubmit: false, // Auto-submit final application
  autoNavigate: true, // Auto-click Next on multi-page apps
  smartApplyEnabled: true, // Full automation mode
  currentStep: 0, // Track which step we're on
  stepLock: false // Prevent concurrent step execution
};

// Reset automation state before starting new automation
function resetAutomationState() {
  automationState.isPaused = false;
  automationState.shouldSkip = false;
  automationState.shouldQuit = false;
  automationState.currentStep = 0;
  automationState.stepLock = false;
  automationState.isRunning = true;
  console.log('QuantumHire AI: Automation state reset');
}

// Stop all automation immediately
function stopAutomation() {
  automationState.shouldQuit = true;
  automationState.isRunning = false;
  automationState.isPaused = false;
  automationState.stepLock = false;
  console.log('QuantumHire AI: Automation stopped');
}

// Toggle pause state
function togglePause() {
  automationState.isPaused = !automationState.isPaused;
  console.log('QuantumHire AI: Automation', automationState.isPaused ? 'paused' : 'resumed');
  return automationState.isPaused;
}

// Skip current step
function skipCurrentStep() {
  if (automationState.isRunning) {
    automationState.shouldSkip = true;
    console.log('QuantumHire AI: Skipping current step');
  }
}

// Speed multiplier configuration - uses SPEED_CONFIGS from humanTyping.js
// Extended config with page load delays (humanTyping.js has the base config)
const SPEED_CONFIGS_EXTENDED = {
  1: { loadMin: 1000, loadMax: 2000, label: 'Normal (Safest)' },
  1.5: { loadMin: 700, loadMax: 1500, label: 'Fast' },
  2: { loadMin: 500, loadMax: 1000, label: 'Faster' },
  3: { loadMin: 300, loadMax: 700, label: 'Aggressive' }
};

// Get current speed multiplier from storage
async function getSpeedMultiplier() {
  try {
    const data = await chrome.storage.local.get(['speedMultiplier']);
    return data.speedMultiplier || 1;
  } catch (e) {
    return 1;
  }
}

// Get delay configuration for current speed (merges with humanTyping config)
async function getSpeedConfig() {
  const multiplier = await getSpeedMultiplier();
  const baseConfig = (typeof SPEED_CONFIGS !== 'undefined' ? SPEED_CONFIGS[multiplier] : null) || 
    { typeMin: 300, typeMax: 600, clickMin: 400, clickMax: 600 };
  const extendedConfig = SPEED_CONFIGS_EXTENDED[multiplier] || SPEED_CONFIGS_EXTENDED[1];
  return { ...baseConfig, ...extendedConfig };
}

// Get typing delay with jitter for human-like behavior
async function getTypingDelay() {
  const config = await getSpeedConfig();
  const base = config.typeMin + Math.random() * (config.typeMax - config.typeMin);
  // Add jitter (±20%) for realism
  return Math.floor(base * (0.8 + Math.random() * 0.4));
}

// Get click delay with jitter
async function getClickDelay() {
  const config = await getSpeedConfig();
  const base = config.clickMin + Math.random() * (config.clickMax - config.clickMin);
  return Math.floor(base * (0.8 + Math.random() * 0.4));
}

// Get page load/transition delay with jitter
async function getPageLoadDelay() {
  const config = await getSpeedConfig();
  const base = config.loadMin + Math.random() * (config.loadMax - config.loadMin);
  return Math.floor(base * (0.8 + Math.random() * 0.4));
}

// Legacy function - returns page load delay for compatibility
async function getDelayForSpeed() {
  return await getPageLoadDelay();
}

async function waitWithControls(ms) {
  const startTime = Date.now();
  const checkInterval = 50; // Check every 50ms for responsiveness
  
  while (Date.now() - startTime < ms) {
    // Check quit first (highest priority)
    if (automationState.shouldQuit) {
      console.log('QuantumHire AI: Quit detected in waitWithControls');
      throw new Error('QUIT');
    }
    
    // Check skip
    if (automationState.shouldSkip) {
      automationState.shouldSkip = false;
      console.log('QuantumHire AI: Skip detected in waitWithControls');
      throw new Error('SKIP');
    }
    
    // Handle pause
    while (automationState.isPaused && !automationState.shouldQuit) {
      await new Promise(r => setTimeout(r, 100));
      if (automationState.shouldQuit) {
        console.log('QuantumHire AI: Quit detected while paused');
        throw new Error('QUIT');
      }
    }
    
    await new Promise(r => setTimeout(r, checkInterval));
  }
}

// Check controls during long operations
async function checkControls() {
  if (automationState.shouldQuit) throw new Error('QUIT');
  if (automationState.shouldSkip) {
    automationState.shouldSkip = false;
    throw new Error('SKIP');
  }
  while (automationState.isPaused && !automationState.shouldQuit) {
    await new Promise(r => setTimeout(r, 100));
  }
  if (automationState.shouldQuit) throw new Error('QUIT');
}

// ============= COMPREHENSIVE KNOCKOUT QUESTION ANSWER BANK =============

const KNOCKOUT_ANSWER_BANK = {
  // WORK AUTHORIZATION
  'legal documentation.*identity.*eligibility|legally authorized|eligib.*employed|right to work|authorization to work|authorised to work': { answer: 'Yes', selectValue: 'yes' },
  'authorized.*work.*united states|authorized.*work.*us|work.*authorization.*us|legally.*work.*us|eligible.*work.*us|can you work.*us': { answer: 'Yes', selectValue: 'yes' },
  'authorized.*work.*canada|authorized.*work.*uk|authorized.*work.*europe|work.*authorization': { answer: 'Yes', selectValue: 'yes' },
  
  // VISA SPONSORSHIP
  'require.*sponsorship|need.*sponsorship|sponsorship.*required|sponsor.*visa|visa.*sponsor|future.*sponsorship|now or.*future.*sponsor|employment.*sponsorship': { answer: 'No', selectValue: 'no' },
  'sponsor.*h1b|h-1b.*sponsor|h1-b.*sponsor|need.*h1b|require.*h1b|tn.*visa|l1.*visa|o1.*visa': { answer: 'No', selectValue: 'no' },
  'work.*without.*sponsorship|employment.*without.*sponsorship': { answer: 'Yes', selectValue: 'yes' },
  
  // AGE VERIFICATION
  'age 18|over 18|18 years|eighteen|at least 18|older than 18|minimum age|legal age|are you.*18|21 years|over 21|at least 21': { answer: 'Yes', selectValue: 'yes' },
  
  // BACKGROUND & DRUG SCREENING
  'background check|criminal background|background investigation|submit.*background|consent.*background|background screening|pre-employment.*background': { answer: 'Yes', selectValue: 'yes' },
  'drug screen|drug test|substance test|submit.*drug|pre-employment.*drug|toxicology|controlled substance': { answer: 'Yes', selectValue: 'yes' },
  'motor vehicle|mvr.*check|driving record.*check': { answer: 'Yes', selectValue: 'yes' },
  'credit check|credit history|financial background': { answer: 'Yes', selectValue: 'yes' },
  
  // DRIVER'S LICENSE
  'driver.*license|driving license|valid license|valid driver|possess.*license|current.*license|unrestricted.*license': { answer: 'Yes', selectValue: 'yes' },
  'good driving|driving history|driving record|clean driving|safe driving': { answer: 'Yes', selectValue: 'yes' },
  'own.*vehicle|reliable.*transportation|access.*vehicle|means.*transportation|personal.*transportation': { answer: 'Yes', selectValue: 'yes' },
  
  // RELOCATION & AVAILABILITY
  'willing.*relocate|open.*relocation|relocate.*position|able.*relocate|consider.*relocating|move.*location': { answer: 'Yes', selectValue: 'yes' },
  'available.*start|start date|earliest.*start|when.*start|how soon|soonest.*start|when.*begin': { answer: 'Immediately', selectValue: 'immediately' },
  'immediate.*start|start immediately|available immediately': { answer: 'Yes', selectValue: 'yes' },
  'notice period|current.*notice|weeks.*notice|days.*notice|resignation.*period': { answer: '2 weeks' },
  'currently employed|presently working|actively working': { answer: 'Yes', selectValue: 'yes' },
  
  // JOB FUNCTIONS & PHYSICAL REQUIREMENTS
  'essential functions|perform.*duties|physical requirements|able to perform|perform.*job|job.*functions': { answer: 'Yes', selectValue: 'yes' },
  'reasonable accommodation|disability accommodation|with or without.*accommodation|request.*accommodation': { answer: 'Yes', selectValue: 'yes' },
  'lift.*pounds|carry.*lbs|physical demands|standing.*hours|sitting.*hours|walk.*hours|bend.*lift|push.*pull': { answer: 'Yes', selectValue: 'yes' },
  'work.*environment|outdoor.*work|indoor.*work|office.*environment|warehouse.*environment|manufacturing.*environment': { answer: 'Yes', selectValue: 'yes' },
  
  // TRAVEL & SCHEDULE
  'willing.*travel|travel.*required|travel.*percent|overnight.*travel|domestic.*travel|international.*travel|business.*travel': { answer: 'Yes', selectValue: 'yes' },
  'travel.*frequency|how much.*travel|percentage.*travel|amount.*travel': { answer: 'Up to 50%' },
  'work.*weekends|weekend.*availability|weekend.*work|saturday.*sunday': { answer: 'Yes', selectValue: 'yes' },
  'work.*shifts|shift.*work|rotating.*shifts|night.*shift|evening.*shift|flexible.*hours': { answer: 'Yes', selectValue: 'yes' },
  'overtime|extra.*hours|additional.*hours|extended.*hours': { answer: 'Yes', selectValue: 'yes' },
  'on-call|on call|standby|pager.*duty|after.*hours.*support': { answer: 'Yes', selectValue: 'yes' },
  'flexible.*schedule|flexible.*working|hybrid.*work|remote.*work|work.*from.*home': { answer: 'Yes', selectValue: 'yes' },
  'full-time|full time|permanent.*position|permanent.*role': { answer: 'Yes', selectValue: 'yes' },
  
  // PREVIOUS EMPLOYMENT
  'employed by.*llc|employed by.*company|worked.*before|previous.*employee|ever been employed|formerly employed|worked.*previously': { answer: 'No', selectValue: 'no' },
  'referred by|employee referral|know anyone|current employee.*refer|referral.*source': { answer: 'No', selectValue: 'no' },
  'applied.*before|previously.*applied|past.*application|former.*applicant': { answer: 'No', selectValue: 'no' },
  'interview.*before|interviewed.*previously': { answer: 'No', selectValue: 'no' },
  
  // LEGAL & AGREEMENTS
  'terms and conditions|agree.*terms|certification|certify|read and agree|responding.*yes.*certify|acknowledge|attestation': { answer: 'Yes', selectValue: 'yes' },
  'non-compete|non-disclosure|nda|confidentiality|confidential.*agreement|proprietary.*agreement': { answer: 'Yes', selectValue: 'yes' },
  'agree.*policy|accept.*terms|consent.*processing|consent.*data|privacy.*consent|gdpr.*consent': { answer: 'Yes', selectValue: 'yes' },
  'truthful.*information|accurate.*information|certify.*accurate|information.*true': { answer: 'Yes', selectValue: 'yes' },
  'at-will.*employment|at will.*employment|employment.*at-will': { answer: 'Yes', selectValue: 'yes' },
  
  // CRIMINAL HISTORY
  'convicted.*felony|criminal.*conviction|been convicted|pleaded guilty|pending.*charges|criminal.*record|arrest.*record': { answer: 'No', selectValue: 'no' },
  'misdemeanor|criminal.*offense|criminal.*history': { answer: 'No', selectValue: 'no' },
  
  // SECURITY CLEARANCE
  'security clearance|clearance.*level|active.*clearance|current.*clearance|secret.*clearance|top secret|ts/sci|public trust': { answerFromProfile: 'security_clearance', defaultAnswer: 'No, but willing to obtain' },
  'obtain.*clearance|eligible.*clearance|pass.*clearance|clearance.*investigation': { answer: 'Yes', selectValue: 'yes' },
  
  // EEO & DEMOGRAPHICS - with profile-based answers
  'veteran status|military service|protected veteran|veteran.*self|served.*military|us.*veteran|armed forces|vevraa': { answerFromProfile: 'veteran_status', defaultAnswer: 'I am not a protected veteran', selectValue: 'i am not a protected veteran' },
  'disability status|disabled|have.*disability|disability.*self|individual.*disability|form cc-305|voluntary.*disability': { answerFromProfile: 'disability', defaultAnswer: 'I do not wish to answer', selectValue: 'i do not wish to answer' },
  'race|ethnicity|ethnic background|race.*ethnicity|racial.*identity|racial.*ethnic|african.*american|asian|caucasian|hispanic.*latino|white|black': { answerFromProfile: 'race_ethnicity', defaultAnswer: 'Decline to self-identify', selectValue: 'decline' },
  'gender|sex|male.*female|gender.*identity|what is your gender|your gender': { answerFromProfile: 'gender', defaultAnswer: 'Male', selectValue: 'male' },
  'hispanic.*latino|latino.*hispanic|are you hispanic|hispanic or latino': { answerFromProfile: 'hispanic_latino', defaultAnswer: 'No', selectValue: 'no' },
  'sexual orientation|lgbtq|lgbtqia': { answer: 'Prefer not to answer', selectValue: 'prefer not to answer' },
  
  // COMPANY-SPECIFIC QUESTIONS
  'worked.*microsoft|ever worked for microsoft|microsoft.*employee|microsoft.*vendor|employee or vendor.*microsoft': { answer: 'No', selectValue: 'no' },
  'worked.*google|ever worked.*google|google.*employee': { answer: 'No', selectValue: 'no' },
  'worked.*amazon|ever worked.*amazon|amazon.*employee': { answer: 'No', selectValue: 'no' },
  'worked.*apple|ever worked.*apple|apple.*employee': { answer: 'No', selectValue: 'no' },
  'worked.*meta|worked.*facebook|ever worked.*meta|meta.*employee': { answer: 'No', selectValue: 'no' },

  // LOCATION & IDENTITY (auto-fill from profile)
  '^country$|choose.*country|country.*located|country.*residence|current.*country|please choose the country': { answerFromProfile: 'country', defaultAnswer: 'United States' },
  '^location \(city\)$|city of residence|current city|location \(city\)': { answerFromProfile: 'city', defaultAnswer: 'Remote' },
  'pronouns|what pronouns': { customHandler: 'pronouns', defaultAnswer: 'They/Them' },

  // REGION / LANGUAGE ELIGIBILITY
  'are you based in europe|based in europe|located in europe': { customHandler: 'basedInEurope', defaultAnswer: 'No' },
  'do you speak german|speak german|german language': { customHandler: 'speakGerman', defaultAnswer: 'No' },

  // CONSENT / ACKNOWLEDGEMENTS (short labels often used by ATS)
  '^privacy notice$|privacy notice|privacy policy': { answer: 'Yes', selectValue: 'yes' },
  'transparency|committed to transparency|committed to innovation': { answer: 'Yes', selectValue: 'yes' },

  // WORK ELIGIBILITY (short labels)
  'work eligibility': { answer: 'Yes', selectValue: 'yes' },

  // ROLE-SPECIFIC SCREENERS (best-effort automation)
  'high growth b2b tech saas|high-growth b2b|b2b saas': { customHandler: 'b2bSaas', defaultAnswer: 'Yes' },
  'solutions consulting|solution consulting': { customHandler: 'solutionsConsulting', defaultAnswer: 'Yes' },

  // U.S. CITIZENSHIP - Security Requirements
  'u\\.s\\. citizen|us citizen|united states citizen|american citizen|citizenship.*u\\.s|require.*u\\.s\\. citizenship|security requirements.*u\\.s': { answer: 'No', selectValue: 'no' },

  // GREENHOUSE SPECIFIC
  'are you legally.*18|confirm.*legal age|minimum.*working age': { answer: 'Yes', selectValue: 'yes' },
  'linkedin.*profile|linkedin url|linkedin.*url': { answerFromProfile: 'linkedin' },
  'github.*profile|github url|github.*url': { answerFromProfile: 'github' },
  'portfolio.*url|website.*url|personal.*website': { answerFromProfile: 'portfolio' },
  
  // GREENHOUSE LOCATION QUESTIONS
  'where would you like to be based|where.*based|prefer.*location|preferred.*office|work.*location.*preference|which.*location|office.*location': { answerFromProfile: 'city', defaultAnswer: 'Remote' },
  
  // US PERSON QUESTION (Monzo-style)
  'are you a us person|us person|born.*united states|parent.*born.*us|naturalised citizen.*us|green card.*holder|us tax resident': { answer: 'No', selectValue: 'no' },
  
  // UK RIGHT TO WORK
  'uk right to work|right to work.*uk|right to work status|confirm.*uk.*right.*work|uk work.*status|work.*uk.*status': { answer: 'Require sponsorship - Skilled Worker', selectValue: 'require sponsorship' },
  
  // UK/EU SPECIFIC WORK AUTHORIZATION
  'settled status|pre-settled status|share code|biometric residence': { answer: 'Require sponsorship - Skilled Worker', selectValue: 'require sponsorship' },
  'uk.*citizen|british citizen|irish citizen|eu citizen.*uk': { answer: 'No', selectValue: 'no' },
  
  // NEURODIVERGENT / DIVERSITY QUESTIONS
  'neurodivergent|neurodiverse|adhd|autism|dyslexia|consider yourself.*neurodivergent': { answer: 'I do not wish to answer', selectValue: 'i do not wish to answer' },
  'transgender|identify as transgender|gender identity.*transgender': { answer: 'I do not wish to answer', selectValue: 'i do not wish to answer' },
  
  // CANDIDATE DATA PRIVACY
  'candidate data privacy|data privacy notice|keeping.*data safe|privacy.*notice.*confirm|looked at.*privacy': { answer: 'Yes', selectValue: 'yes' },
  
  // PRONUNCIATION / NAME
  'spell out your name|name.*pronounced|pronunciation|how.*say.*name': { answer: '' },

  // WORKDAY SPECIFIC
  'have you ever worked for|previously.*employed.*by|past.*employment.*with': { answer: 'No', selectValue: 'no' },
  'current.*employment.*status|employment.*status|work.*status': { answer: 'Currently Employed', selectValue: 'employed' },

  // LEVER SPECIFIC
  'how did you hear|where did you find|source.*application|how.*learn.*position': { answer: 'Company Website', selectValue: 'company website' },
  'why.*interested|interest.*role|interest.*position|attracted.*role': { answer: 'I am passionate about this opportunity and believe my skills align perfectly with the requirements.' },

  // iCIMS SPECIFIC
  'shift.*preference|preferred.*shift|work.*schedule.*preference': { answer: 'Flexible/Any', selectValue: 'flexible' },

  // TALEO SPECIFIC
  'country.*residence|residing.*country|current.*country': { answerFromProfile: 'country', defaultAnswer: 'United States' },
  
  // EDUCATION
  'highest.*degree|degree.*obtained|education.*level|completed.*degree|highest.*education': { answerFromProfile: 'highest_education', defaultAnswer: "Bachelor's Degree" },
  'bachelor.*degree|undergraduate.*degree|college.*degree|university.*degree': { answer: 'Yes', selectValue: 'yes' },
  'master.*degree|graduate.*degree|advanced.*degree|mba|ms degree|ma degree': { answer: 'No', selectValue: 'no' },
  'gpa|grade point|academic.*average': { answer: '3.5' },
  
  // CERTIFICATIONS
  'certification.*required|required.*certification|professional.*certification|industry.*certification': { answer: 'Yes', selectValue: 'yes' },
  'license.*required|professional.*license|state.*license': { answer: 'Yes', selectValue: 'yes' },
  
  // SKILLS
  'proficiency.*level|skill.*level|expertise.*level|experience.*level': { answer: 'Expert', selectValue: 'expert' },
  'years.*total.*experience|total.*years.*experience|overall.*experience': { answerFromProfile: 'total_experience', defaultAnswer: '8' },
  
  // SALARY
  'salary.*expectation|expected.*salary|desired.*salary|salary.*requirement|compensation.*expectation|pay.*expectation|desired.*pay|pay.*range|salary.*range': { answerFromProfile: 'expected_salary', defaultAnswer: '$75,000 - $95,000' },
  'current.*salary|present.*salary|current.*compensation|base.*salary': { answerFromProfile: 'current_salary', defaultAnswer: 'Prefer not to disclose' },
  'hourly.*rate|rate.*per hour|hourly.*expectation': { answer: 'Negotiable based on total compensation' },
  'bonus.*eligible|variable.*compensation|commission': { answer: 'Yes', selectValue: 'yes' },
  
  // LANGUAGE
  'english.*proficiency|speak.*english|english.*fluent|english.*language': { answer: 'Fluent/Native', selectValue: 'fluent' },
  'spanish.*proficiency|speak.*spanish|spanish.*language': { answer: 'Intermediate', selectValue: 'intermediate' },
  'language.*proficiency|fluent.*language|speak.*language': { answer: 'English (Fluent)' },
  
  // CONTACT PREFERENCES
  'contact.*method|preferred.*contact|best way.*reach|how.*contact': { answer: 'Email', selectValue: 'email' },
  'best.*time.*call|call.*time|when.*call': { answer: 'Anytime during business hours' },
  
  // ADDITIONAL
  'conflict.*interest|competing.*interest|outside.*employment': { answer: 'No', selectValue: 'no' },
  'relative.*employee|family.*works|related.*anyone': { answer: 'No', selectValue: 'no' },
  'government.*employee|public.*sector|federal.*employee': { answer: 'No', selectValue: 'no' },
  'union.*member|belong.*union|represented.*union': { answer: 'No', selectValue: 'no' },
  'equipment.*use|tools.*own|required.*equipment|personal.*tools': { answer: 'Yes', selectValue: 'yes' },
  'computer.*proficient|technology.*skills|software.*skills': { answer: 'Yes', selectValue: 'yes' },
  
  // OVERTIME & SHIFT AVAILABILITY
  'willing.*overtime|work.*overtime|overtime.*available|extra.*hours|additional.*hours|extended.*hours|long.*hours': { answer: 'Yes', selectValue: 'yes' },
  'shift.*availability|available.*shifts|work.*any.*shift|all.*shifts|shift.*preference': { answer: 'Flexible/Any Shift', selectValue: 'flexible' },
  'night.*shift.*available|evening.*shift|graveyard.*shift|swing.*shift': { answer: 'Yes', selectValue: 'yes' },
  'weekend.*availability|work.*saturdays|work.*sundays|available.*weekends|saturday.*sunday': { answer: 'Yes', selectValue: 'yes' },
  'holiday.*work|work.*holidays|available.*holidays': { answer: 'Yes', selectValue: 'yes' },
  'flexible.*hours|flexible.*schedule|varied.*schedule|irregular.*hours': { answer: 'Yes', selectValue: 'yes' },
  'rotating.*shift|rotating.*schedule': { answer: 'Yes', selectValue: 'yes' },
  'on-call.*availability|standby.*duty|emergency.*call|after.*hours.*availability': { answer: 'Yes', selectValue: 'yes' },
  
  // CERTIFICATIONS REQUIRED
  'certification.*required|required.*certification|hold.*certification|possess.*certification|valid.*certification': { answer: 'Yes', selectValue: 'yes' },
  'willing.*obtain.*certification|obtain.*required.*certification|get.*certified': { answer: 'Yes', selectValue: 'yes' },
  'professional.*license|state.*license|license.*required|licensed.*professional': { answer: 'Yes', selectValue: 'yes' },
  'aws.*certified|azure.*certified|google.*certified|cloud.*certified': { answer: 'Yes', selectValue: 'yes' },
  'pmp.*certified|scrum.*master|agile.*certified|itil.*certified': { answer: 'Yes', selectValue: 'yes' },
  'cpa.*certified|cfa.*chartered|series.*7|finra|licensed.*broker': { answer: 'Yes, if applicable', selectValue: 'yes' },
  'first.*aid|cpr.*certified|safety.*training|osha.*certified': { answer: 'Yes', selectValue: 'yes' },
  
  // PHYSICAL REQUIREMENTS
  'lift.*25.*pounds|lift.*50.*pounds|lift.*75.*pounds|heavy.*lifting|physically.*demanding': { answer: 'Yes', selectValue: 'yes' },
  'stand.*extended|stand.*long.*periods|standing.*hours|prolonged.*standing': { answer: 'Yes', selectValue: 'yes' },
  'sit.*extended|sit.*long.*periods|desk.*work|sedentary.*work': { answer: 'Yes', selectValue: 'yes' },
  'climb.*ladders|work.*heights|height.*comfortable|elevated.*platforms': { answer: 'Yes', selectValue: 'yes' },
  'outdoor.*weather|inclement.*weather|outdoor.*conditions|work.*outside': { answer: 'Yes', selectValue: 'yes' },
  'repetitive.*motion|repetitive.*tasks|manual.*dexterity': { answer: 'Yes', selectValue: 'yes' },
  
  // TEAM & ENVIRONMENT
  'team.*environment|work.*team|collaborative.*environment|teamwork': { answer: 'Yes', selectValue: 'yes' },
  'independent.*work|work.*independently|self-directed|autonomous.*work|minimal.*supervision': { answer: 'Yes', selectValue: 'yes' },
  'fast-paced.*environment|high.*pressure|deadline.*driven|time.*sensitive': { answer: 'Yes', selectValue: 'yes' },
  'customer.*facing|client.*interaction|public.*contact|customer.*service': { answer: 'Yes', selectValue: 'yes' },
  'remote.*work.*capable|work.*from.*home|virtual.*work|telecommute': { answer: 'Yes', selectValue: 'yes' },
  'hybrid.*work|in-office.*days|office.*attendance': { answer: 'Yes', selectValue: 'yes' },
  
  // ADDITIONAL COMMON QUESTIONS
  'emergency.*contact|emergency.*situation|available.*emergency': { answer: 'Yes', selectValue: 'yes' },
  'social.*media.*presence|professional.*social|online.*presence': { answer: 'Yes', selectValue: 'yes' },
  'public.*speaking|presentation.*skills|speak.*groups': { answer: 'Yes', selectValue: 'yes' },
  'training.*others|mentor.*others|coach.*team|train.*new.*employees': { answer: 'Yes', selectValue: 'yes' },
  'feedback.*receptive|accept.*feedback|constructive.*criticism': { answer: 'Yes', selectValue: 'yes' },
  'multi-task|multitask|multiple.*priorities|juggle.*tasks': { answer: 'Yes', selectValue: 'yes' },
  'attention.*detail|detail.*oriented|meticulous|accuracy': { answer: 'Yes', selectValue: 'yes' },
  'problem.*solving|analytical.*thinking|critical.*thinking': { answer: 'Yes', selectValue: 'yes' },
  'leadership.*experience|lead.*team|supervisory.*experience|management.*experience': { answer: 'Yes', selectValue: 'yes' }
};

// Match knockout question with profile-aware answers
function matchKnockoutQuestion(questionText, userProfile = null) {
  const lowerQuestion = questionText.toLowerCase().trim();
  
  for (const [pattern, response] of Object.entries(KNOCKOUT_ANSWER_BANK)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(lowerQuestion)) {
      // Custom handlers (derived from profile)
      if (response.customHandler) {
        const handler = response.customHandler;

        const gender = (userProfile?.gender || '').toString().toLowerCase();
        const country = (userProfile?.country || '').toString();
        const city = (userProfile?.city || '').toString();
        const languagesRaw = userProfile?.languages;
        const languages = Array.isArray(languagesRaw)
          ? languagesRaw.map((l) => (typeof l === 'string' ? l : l?.name || l?.language || '')).join(', ')
          : (languagesRaw ? String(languagesRaw) : '');
        const languagesLower = languages.toLowerCase();

        const workExpText = Array.isArray(userProfile?.work_experience)
          ? userProfile.work_experience
              .map((e) => `${e?.title || ''} ${e?.company || ''} ${e?.description || ''} ${(e?.bullets || []).join(' ')}`)
              .join(' ')
              .toLowerCase()
          : '';

        if (handler === 'pronouns') {
          if (gender.includes('male')) return { answer: 'He/Him', selectValue: 'he/him' };
          if (gender.includes('female')) return { answer: 'She/Her', selectValue: 'she/her' };
          return { answer: 'They/Them', selectValue: 'they/them' };
        }

        if (handler === 'basedInEurope') {
          const euCountries = [
            'ireland','united kingdom','uk','germany','france','spain','italy','netherlands','belgium','sweden','norway','denmark','finland','switzerland','austria','portugal','poland','czech','czech republic','romania','bulgaria','greece','hungary','slovakia','slovenia','croatia','serbia','bosnia','estonia','latvia','lithuania'
          ];
          const c = country.toLowerCase();
          const isEu = !!c && euCountries.some((x) => c.includes(x));
          return { answer: isEu ? 'Yes' : (response.defaultAnswer || 'No'), selectValue: isEu ? 'yes' : 'no' };
        }

        if (handler === 'speakGerman') {
          const speaks = languagesLower.includes('german') || languagesLower.includes('deutsch');
          return { answer: speaks ? 'Yes' : (response.defaultAnswer || 'No'), selectValue: speaks ? 'yes' : 'no' };
        }

        if (handler === 'b2bSaas') {
          const has = /saas|b2b|enterprise/.test(workExpText);
          return { answer: has ? 'Yes' : (response.defaultAnswer || 'Yes'), selectValue: 'yes' };
        }

        if (handler === 'solutionsConsulting') {
          const has = /solutions consult|solution consult|consultant|pre-sales|presales|sales engineer|sales engineering/.test(workExpText);
          return { answer: has ? 'Yes' : (response.defaultAnswer || 'Yes'), selectValue: 'yes' };
        }

        return { answer: response.defaultAnswer || 'Yes', selectValue: (response.defaultAnswer || 'yes').toLowerCase() };
      }

      if (response.answerFromProfile && userProfile) {
        const profileField = response.answerFromProfile;

        // Try multiple field name formats
        let profileValue = userProfile[profileField]
          || userProfile[profileField.replace(/_/g, '')]
          || userProfile[toCamelCase(profileField)]
          || userProfile[profileField.toLowerCase()];

        // Special handling for EEO fields with specific value mapping
        if (profileValue !== null && profileValue !== undefined && profileValue !== '') {
          // Handle boolean fields
          if (typeof profileValue === 'boolean') {
            // Special mapping for veteran status
            if (profileField === 'veteran_status') {
              return {
                answer: profileValue ? 'I identify as one or more of the classifications of protected veteran' : 'I am not a protected veteran',
                selectValue: profileValue ? 'protected veteran' : 'i am not a protected veteran'
              };
            }
            // Special mapping for disability
            if (profileField === 'disability') {
              return {
                answer: profileValue ? 'Yes, I have a disability' : 'No, I do not have a disability',
                selectValue: profileValue ? 'yes' : 'no'
              };
            }
            // Special mapping for hispanic/latino
            if (profileField === 'hispanic_latino') {
              return {
                answer: profileValue ? 'Yes' : 'No',
                selectValue: profileValue ? 'yes' : 'no'
              };
            }
            // Generic boolean
            return { answer: profileValue ? 'Yes' : 'No', selectValue: profileValue ? 'yes' : 'no' };
          }

          // Handle string values with smart matching for dropdown values
          const stringValue = String(profileValue);
          const lowerValue = stringValue.toLowerCase();

          // Special handling for race/ethnicity to match common dropdown options
          if (profileField === 'race_ethnicity') {
            const raceMapping = {
              'black or african american': { answer: 'Black or African American', selectValue: 'black' },
              'black': { answer: 'Black or African American', selectValue: 'black' },
              'african american': { answer: 'Black or African American', selectValue: 'black' },
              'white': { answer: 'White', selectValue: 'white' },
              'caucasian': { answer: 'White', selectValue: 'white' },
              'asian': { answer: 'Asian', selectValue: 'asian' },
              'hispanic': { answer: 'Hispanic or Latino', selectValue: 'hispanic' },
              'latino': { answer: 'Hispanic or Latino', selectValue: 'hispanic' },
              'two or more races': { answer: 'Two or More Races', selectValue: 'two or more' },
              'native american': { answer: 'American Indian or Alaska Native', selectValue: 'native american' },
              'pacific islander': { answer: 'Native Hawaiian or Other Pacific Islander', selectValue: 'pacific islander' },
              'decline': { answer: 'Decline to self-identify', selectValue: 'decline' }
            };
            const mapped = Object.entries(raceMapping).find(([key]) => lowerValue.includes(key));
            if (mapped) return mapped[1];
          }

          // Special handling for gender
          if (profileField === 'gender') {
            const genderMapping = {
              'male': { answer: 'Male', selectValue: 'male' },
              'm': { answer: 'Male', selectValue: 'male' },
              'female': { answer: 'Female', selectValue: 'female' },
              'f': { answer: 'Female', selectValue: 'female' },
              'non-binary': { answer: 'Non-binary', selectValue: 'non-binary' },
              'other': { answer: 'Other', selectValue: 'other' },
              'prefer not': { answer: 'Prefer not to answer', selectValue: 'prefer not to answer' },
              'decline': { answer: 'Decline to self-identify', selectValue: 'decline' }
            };
            const mapped = Object.entries(genderMapping).find(([key]) => lowerValue.includes(key));
            if (mapped) return mapped[1];
          }

          return { answer: stringValue, selectValue: lowerValue };
        }

        // Use default answer if no profile value
        return { answer: response.defaultAnswer || 'Yes', selectValue: (response.defaultAnswer || 'yes').toLowerCase() };
      }
      return { answer: response.answer, selectValue: response.selectValue || (response.answer ? response.answer.toLowerCase() : 'yes') };
    }
  }
  return null;
}

function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

function getExperienceYears(skillName, userProfile) {
  if (!userProfile?.skills) return 8;
  const skills = Array.isArray(userProfile.skills) ? userProfile.skills : [];
  const skillLower = skillName.toLowerCase();
  const matchedSkill = skills.find(s => {
    const name = (s.name || s.skill || '').toLowerCase();
    return name.includes(skillLower) || skillLower.includes(name);
  });
  if (matchedSkill) {
    if (matchedSkill.years) return matchedSkill.years;
    const proficiencyMap = { 'expert': 10, 'advanced': 7, 'intermediate': 4, 'beginner': 2 };
    if (matchedSkill.proficiency && proficiencyMap[matchedSkill.proficiency]) return proficiencyMap[matchedSkill.proficiency];
  }
  return Math.min(parseInt(userProfile.total_experience) || 8, 8);
}

function getSalaryAnswer(questionText, jobData, userProfile) {
  const jdSalaryMatch = jobData?.description?.match(/\$[\d,]+\s*[-–]\s*\$[\d,]+/);
  if (jdSalaryMatch) return jdSalaryMatch[0];
  if (userProfile?.expected_salary) return userProfile.expected_salary;
  return '60,000 - 80,000';
}

// ============= STATE MANAGEMENT =============

let applicationState = {
  platform: null,
  status: 'idle',
  filledFields: [],
  startTime: null,
  jobData: null,
  tailoredData: null,
  sessionId: null
};

// ============= UTILITY FUNCTIONS =============

function detectPlatform() {
  for (const [name, config] of Object.entries(PLATFORM_CONFIG)) {
    if (config.detect()) return { name, config };
  }
  return { name: 'generic', config: null };
}

function detectLoginPage() {
  const hasPasswordField = document.querySelector('input[type="password"]');
  const hasEmailField = document.querySelector('input[type="email"], input[name*="email"], input[id*="email"], input[name*="username"]');
  const hasResumeField = document.querySelector('input[type="file"]');
  const loginKeywords = ['sign in', 'log in', 'login', 'sign-in'].some(kw => document.body.innerText.toLowerCase().includes(kw));
  return (hasPasswordField && hasEmailField && !hasResumeField) || (hasPasswordField && loginKeywords);
}

function extractText(selector) {
  const element = document.querySelector(selector);
  if (!element) return '';
  if (element.tagName === 'IMG') return element.alt || '';
  return element.innerText?.trim() || element.textContent?.trim() || '';
}

function capitalizeWords(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

// ============= JOB EXTRACTION =============

const JOB_EXTRACTION_SELECTORS = {
  workday: { title: '[data-automation-id="jobPostingHeader"] h1, .job-title, h1', company: '[data-automation-id="companyName"], .company-name', description: '[data-automation-id="jobPostingDescription"], .job-description, main', location: '[data-automation-id="locations"], .location' },
  greenhouse: { title: '.app-title, h1.heading', company: '.company-name, .logo-container img[alt]', description: '#content, .job-description', location: '.location, .job-location' },
  lever: { title: '.posting-headline h2, h1.posting-title', company: '.main-header-logo img[alt]', description: '.posting-description', location: '.location' },
  workable: { 
    title: 'h1[data-ui="job-title"], h1.job-title, h1, [data-ui="job-title"]', 
    company: '[data-ui="company-name"], header a[href="/"], .company-logo img[alt], a[data-ui="company-link"]', 
    description: '[data-ui="job-description"], .job-description, section[data-ui="description"], [data-ui="description"], main article', 
    location: '[data-ui="job-location"], [data-ui="job-info"] span, .job-location, [data-testid="job-location"]' 
  },
  generic: { title: 'h1, [class*="job-title"]', company: '[class*="company"], [class*="employer"]', description: '[class*="job-description"], [class*="description"], article, main', location: '[class*="location"]' }
};

function extractJobDetails() {
  const platform = detectPlatform();
  const selectors = JOB_EXTRACTION_SELECTORS[platform.name] || JOB_EXTRACTION_SELECTORS.generic;
  
  let title = '', company = '', description = '', location = '';
  
  for (const sel of (selectors.title || '').split(', ')) { title = extractText(sel); if (title) break; }
  for (const sel of (selectors.company || '').split(', ')) { company = extractText(sel); if (company) break; }
  for (const sel of (selectors.description || '').split(', ')) { description = extractText(sel); if (description && description.length > 100) break; }
  for (const sel of (selectors.location || '').split(', ')) { location = extractText(sel); if (location) break; }
  
  if (!title) { const match = document.title.match(/^(.+?)(?:\s*[-|–]\s*|\s+at\s+)/); if (match) title = match[1].trim(); }
  if (!company) { const match = window.location.hostname.match(/^([^.]+)\.(workday|greenhouse|lever)/); if (match) company = capitalizeWords(match[1].replace(/-/g, ' ')); }
  
  return { title: title || 'Unknown Position', company: company || 'Unknown Company', description: description.substring(0, 5000), location, url: window.location.href, platform: platform.name };
}

// ============= JOB DETECTION & VALIDATION =============

function isValidJobPage() {
  const jobData = extractJobDetails();
  const url = window.location.href.toLowerCase();
  const bodyText = document.body?.innerText?.toLowerCase() || '';
  const pageTitle = document.title?.toLowerCase() || '';
  
  // FIRST: Check for obvious error/404 pages (very strict - only flag as invalid if truly an error page)
  const errorPagePatterns = [
    // Very explicit error indicators
    /^404\s*$/,
    /page\s*not\s*found/,
    /this\s*page\s*(doesn't|does not)\s*exist/,
    /job\s*(has been|was)\s*removed/,
    /job\s*no\s*longer\s*available/,
    /position\s*has\s*been\s*filled/,
    /job\s*listing\s*expired/,
    /posting\s*is\s*no\s*longer\s*active/,
    /this\s*position\s*is\s*no\s*longer\s*available/,
    /sorry.*we\s*couldn't\s*find/
  ];
  
  // Only consider it an error if the page is very short (likely just an error message)
  // AND matches an error pattern
  const isShortPage = bodyText.length < 500;
  if (isShortPage) {
    for (const pattern of errorPagePatterns) {
      if (pattern.test(bodyText) || pattern.test(pageTitle)) {
        console.log('QuantumHire AI: Detected error page pattern:', pattern);
        return { valid: false, reason: 'broken_link', message: 'Job posting not found or expired' };
      }
    }
  }
  
  // SECOND: Check for POSITIVE indicators - if ANY exist, the page is valid
  
  // Check for Apply button (strongest indicator)
  const hasApplyButton = !!(
    document.querySelector('button[class*="apply" i], a[class*="apply" i]') ||
    document.querySelector('button:not([disabled])') && Array.from(document.querySelectorAll('button, a')).some(el => 
      /^apply(\s+now)?$/i.test(el.innerText?.trim() || '')
    ) ||
    document.querySelector('[data-automation-id*="apply" i]') ||
    document.querySelector('a[href*="apply"]')
  );
  
  if (hasApplyButton) {
    console.log('QuantumHire AI: Valid job page - Apply button detected');
    return { valid: true, hasJobData: true, indicator: 'apply_button' };
  }
  
  // Check for job-specific keywords in page content (common job posting elements)
  const jobKeywords = [
    'responsibilities', 'requirements', 'qualifications', 'experience required',
    'job description', 'about the role', 'what you\'ll do', 'what we offer',
    'benefits', 'salary', 'compensation', 'remote', 'hybrid', 'full-time', 
    'part-time', 'contract', 'years of experience', 'degree required',
    'skills required', 'about the team', 'who you are', 'your role'
  ];
  
  const matchedKeywords = jobKeywords.filter(kw => bodyText.includes(kw));
  if (matchedKeywords.length >= 2) {
    console.log('QuantumHire AI: Valid job page - Job keywords detected:', matchedKeywords.slice(0, 3));
    return { valid: true, hasJobData: true, indicator: 'job_keywords' };
  }
  
  // Check for application form elements
  const hasApplicationElements = !!(
    document.querySelector('input[type="file"]') ||
    document.querySelector('input[type="text"][name*="name" i]') ||
    document.querySelector('input[type="email"]') ||
    document.querySelector('[data-automation-id="applicationForm"]') ||
    document.querySelector('form[action*="apply" i]') ||
    document.querySelector('form input[type="text"]')
  );
  
  if (hasApplicationElements) {
    console.log('QuantumHire AI: Valid job page - Application form detected');
    return { valid: true, hasJobData: true, indicator: 'application_form' };
  }
  
  // Check if we have meaningful job data from extraction
  const hasTitle = jobData.title && jobData.title !== 'Unknown Position';
  const hasDescription = jobData.description && jobData.description.length > 100;
  const hasCompany = jobData.company && jobData.company !== 'Unknown Company';
  
  // If we extracted any job data, it's valid
  if (hasTitle || hasDescription || hasCompany) {
    console.log('QuantumHire AI: Valid job page - Job data extracted:', { hasTitle, hasDescription, hasCompany });
    return { valid: true, hasJobData: true, indicator: 'extracted_data' };
  }
  
  // Check URL patterns that suggest job posting
  const jobUrlPatterns = [
    /\/jobs?\//i, /\/careers?\//i, /\/positions?\//i, /\/openings?\//i,
    /\/apply/i, /\/job-/i, /\/vacancy/i, /\/opportunity/i,
    /greenhouse\.io/i, /lever\.co/i, /workday/i, /smartrecruiters/i,
    /ashbyhq/i, /icims/i, /taleo/i, /jobvite/i
  ];
  
  if (jobUrlPatterns.some(pattern => pattern.test(url))) {
    console.log('QuantumHire AI: Valid job page - URL pattern matched');
    return { valid: true, hasJobData: false, indicator: 'url_pattern', warning: 'Limited job data detected' };
  }
  
  // If page has substantial content, assume it's valid (don't be overly aggressive about skipping)
  if (bodyText.length > 1500) {
    console.log('QuantumHire AI: Valid job page - Substantial content detected');
    return { valid: true, hasJobData: false, indicator: 'content_length', warning: 'Could not extract job details, but page has content' };
  }
  
  // Only flag as invalid if we really can't find anything
  console.log('QuantumHire AI: No job indicators found, flagging as potentially invalid');
  return { valid: false, reason: 'no_job_data', message: 'No job detected on this page' };
}

// Send skip signal to web app
function notifyWebAppToSkip(reason) {
  window.postMessage({
    type: 'QUANTUMHIRE_EXTENSION',
    action: 'SKIP_JOB',
    reason: reason,
    url: window.location.href
  }, '*');
}

// ============= ENHANCED FIELD FILLING =============

const FIELD_MAPPINGS = {
  firstName: ['first_name', 'firstname', 'first-name', 'fname', 'given_name'],
  lastName: ['last_name', 'lastname', 'last-name', 'lname', 'surname', 'family_name'],
  fullName: ['full_name', 'fullname', 'name', 'your_name', 'applicant_name'],
  email: ['email', 'e-mail', 'email_address', 'emailaddress', 'work_email'],
  phone: ['phone', 'telephone', 'tel', 'mobile', 'cell', 'phone_number'],
  address: ['address', 'street', 'street_address', 'address_line_1'],
  city: ['city', 'town', 'locality'],
  state: ['state', 'province', 'region'],
  zipCode: ['zip', 'zipcode', 'zip_code', 'postal', 'postal_code'],
  country: ['country', 'nation'],
  linkedin: ['linkedin', 'linkedin_url', 'linkedin_profile'],
  github: ['github', 'github_url', 'github_profile'],
  portfolio: ['portfolio', 'website', 'personal_website'],
  currentCompany: ['current_company', 'company', 'employer'],
  currentTitle: ['current_title', 'job_title', 'title', 'position'],
  yearsExperience: ['years_experience', 'experience', 'total_experience'],
  salary: ['salary', 'salary_expectation', 'expected_salary', 'compensation'],
  coverLetter: ['cover_letter', 'coverletter', 'cover', 'letter', 'message']
};

function findField(fieldType, platformConfig = null) {
  if (platformConfig?.selectors?.[fieldType]) {
    const element = document.querySelector(platformConfig.selectors[fieldType]);
    if (element && element.offsetParent !== null) return element;
  }
  
  const mappings = FIELD_MAPPINGS[fieldType] || [fieldType];
  
  for (const mapping of mappings) {
    let element = document.getElementById(mapping);
    if (element && element.offsetParent !== null) return element;
    
    element = document.querySelector(`input[name="${mapping}"], textarea[name="${mapping}"], select[name="${mapping}"]`);
    if (element && element.offsetParent !== null) return element;
    
    element = document.querySelector(`input[name*="${mapping}"], textarea[name*="${mapping}"]`);
    if (element && element.offsetParent !== null) return element;
    
    element = document.querySelector(`input[id*="${mapping}"], textarea[id*="${mapping}"]`);
    if (element && element.offsetParent !== null) return element;
    
    element = document.querySelector(`input[placeholder*="${mapping}" i], textarea[placeholder*="${mapping}" i]`);
    if (element && element.offsetParent !== null) return element;
    
    element = document.querySelector(`input[aria-label*="${mapping}" i], textarea[aria-label*="${mapping}" i]`);
    if (element && element.offsetParent !== null) return element;
    
    element = document.querySelector(`input[data-automation-id*="${mapping}"], textarea[data-automation-id*="${mapping}"]`);
    if (element && element.offsetParent !== null) return element;
    
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      if (label.innerText?.toLowerCase().includes(mapping.toLowerCase())) {
        const forId = label.getAttribute('for');
        if (forId) { element = document.getElementById(forId); if (element && element.offsetParent !== null) return element; }
        element = label.querySelector('input, textarea, select');
        if (element && element.offsetParent !== null) return element;
        element = label.parentElement?.querySelector('input, textarea, select');
        if (element && element.offsetParent !== null) return element;
      }
    }
  }
  return null;
}

// ============= ENHANCED INPUT FILLING WITH REACT SUPPORT =============

function fillField(element, value) {
  if (!element || !value) return false;
  
  try {
    if (element.value && element.value.trim() !== '') return false;
    
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    
    element.focus();
    element.click();
    
    if (element.tagName === 'INPUT' && nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
    } else if (element.tagName === 'TEXTAREA' && nativeTextareaValueSetter) {
      nativeTextareaValueSetter.call(element, value);
    } else {
      element.value = value;
    }
    
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    
    return true;
  } catch (error) {
    console.error('QuantumHire AI: Fill error', error);
    return false;
  }
}

// ============= ENHANCED DROPDOWN / CHECKBOX / RADIO FILLING =============

function fillDropdown(selectElement, answerValue) {
  if (!selectElement || selectElement.tagName !== 'SELECT') return false;

  const options = Array.from(selectElement.options);
  const answerLower = String(answerValue).toLowerCase().trim();

  // Strategy 1: Exact match
  let match = options.find((o) => {
    const optText = o.text.toLowerCase().trim();
    const optVal = String(o.value || '').toLowerCase().trim();
    return optText === answerLower || optVal === answerLower;
  });

  // Strategy 2: Partial match
  if (!match) {
    match = options.find((o) => {
      const optText = o.text.toLowerCase().trim();
      const optVal = String(o.value || '').toLowerCase().trim();
      return optText.includes(answerLower) || answerLower.includes(optText) || optVal.includes(answerLower);
    });
  }

  // Strategy 3: Yes/No variations
  if (!match && (answerLower === 'yes' || answerLower === 'no')) {
    match = options.find((o) => {
      const optText = o.text.toLowerCase().trim();
      const optVal = String(o.value || '').toLowerCase().trim();
      if (answerLower === 'yes') {
        return optText === 'yes' || optVal === 'yes' || optVal === '1' || optVal === 'true' || optText === 'true' || optText.includes('i agree') || optText.includes('i confirm');
      }
      return optText === 'no' || optVal === 'no' || optVal === '0' || optVal === 'false' || optText === 'false';
    });
  }

  // Strategy 4: Single-option default
  if (!match && options.length > 1) {
    const validOptions = options.filter((o) => o.value && o.value !== '' && !o.text.toLowerCase().includes('select'));
    if (validOptions.length === 1) match = validOptions[0];
  }

  if (match && match.value !== '' && !String(match.value).toLowerCase().includes('select')) {
    selectElement.focus();
    selectElement.click();

    // Set value using native setter for React compatibility
    const nativeSelectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
    if (nativeSelectSetter) nativeSelectSetter.call(selectElement, match.value);
    else selectElement.value = match.value;

    // Fire all events for framework compatibility
    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
    selectElement.dispatchEvent(new Event('input', { bubbles: true }));
    selectElement.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    selectElement.dispatchEvent(new Event('focusout', { bubbles: true }));

    console.log(`QuantumHire AI: Dropdown filled: "${match.text}" for value "${answerValue}"`);
    selectElement.classList.add('quantumhire-filled');
    return true;
  }

  console.log(`QuantumHire AI: No dropdown match for "${answerValue}". Options:`, options.map((o) => o.text));
  return false;
}

function getComboboxLabel(el) {
  const byLabelledby = el.getAttribute('aria-labelledby');
  if (byLabelledby) {
    const labelEl = document.getElementById(byLabelledby);
    if (labelEl?.innerText) return labelEl.innerText.trim();
  }

  const labelled = el.closest('label') || document.querySelector(`label[for="${el.id}"]`);
  if (labelled?.innerText) return labelled.innerText.trim();

  return (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || '').trim();
}

async function fillComboBox(comboboxEl, answerValue) {
  if (!comboboxEl) return false;
  const answerLower = String(answerValue).toLowerCase().trim();

  try {
    // Open list
    comboboxEl.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    comboboxEl.focus?.();
    comboboxEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    comboboxEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

    await new Promise((r) => setTimeout(r, 200));

    // Find listbox (prefer aria-controls)
    const controls = comboboxEl.getAttribute('aria-controls');
    let listRoot = controls ? document.getElementById(controls) : null;

    if (!listRoot) {
      const expanded = comboboxEl.getAttribute('aria-expanded') === 'true';
      const nearby = comboboxEl.closest('div, section, fieldset, form') || document.body;
      listRoot = expanded
        ? document.querySelector('[role="listbox"], [role="tree"], [id*="listbox"], [class*="menu"], [class*="dropdown"]')
        : nearby.querySelector('[role="listbox"], [role="tree"], [id*="listbox"], [class*="menu"], [class*="dropdown"]');
    }

    const optionEls = Array.from((listRoot || document).querySelectorAll('[role="option"], [role="menuitem"], li, div'))
      .filter((o) => (o.offsetParent !== null) && (o.innerText || '').trim().length > 0);

    // Try exact then partial
    let option = optionEls.find((o) => o.innerText.toLowerCase().trim() === answerLower);
    if (!option) option = optionEls.find((o) => o.innerText.toLowerCase().includes(answerLower) || answerLower.includes(o.innerText.toLowerCase().trim()));

    // Yes/No normalization
    if (!option && (answerLower === 'yes' || answerLower === 'no')) {
      option = optionEls.find((o) => {
        const t = o.innerText.toLowerCase();
        if (answerLower === 'yes') return t === 'yes' || t.includes('i agree') || t.includes('agree') || t.includes('true');
        return t === 'no' || t.includes('false');
      });
    }

    if (!option) return false;

    option.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

    comboboxEl.classList.add('quantumhire-filled');
    console.log(`QuantumHire AI: Combobox selected: "${option.innerText}"`);
    return true;
  } catch (e) {
    console.error('QuantumHire AI: Combobox fill error', e);
    return false;
  }
}

function fillCheckbox(checkbox, shouldCheck = true) {
  if (!checkbox || checkbox.type !== 'checkbox') return false;

  try {
    if (checkbox.checked === shouldCheck) return true;

    checkbox.focus();

    // Prefer clicking the label or wrapper (many ATS ignore programmatic checked=)
    const label = checkbox.closest('label') || document.querySelector(`label[for="${checkbox.id}"]`);
    if (label) {
      label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } else {
      checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }

    // Also set checked as a fallback
    checkbox.checked = shouldCheck;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    checkbox.dispatchEvent(new Event('input', { bubbles: true }));

    console.log(`QuantumHire AI: Checkbox ${shouldCheck ? 'checked' : 'unchecked'}: ${checkbox.name || checkbox.id}`);
    checkbox.classList.add('quantumhire-filled');
    return true;
  } catch (error) {
    console.error('QuantumHire AI: Checkbox error', error);
    return false;
  }
}

function fillAriaCheckbox(ariaCheckboxEl, shouldCheck = true) {
  if (!ariaCheckboxEl) return false;

  try {
    const ariaChecked = ariaCheckboxEl.getAttribute('aria-checked');
    const isChecked = ariaChecked === 'true' || ariaCheckboxEl.classList.contains('is-checked') || ariaCheckboxEl.classList.contains('checked');
    if (isChecked === shouldCheck) return true;

    ariaCheckboxEl.focus?.();
    ariaCheckboxEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    ariaCheckboxEl.classList.add('quantumhire-filled');
    return true;
  } catch (e) {
    console.error('QuantumHire AI: aria-checkbox error', e);
    return false;
  }
}

function fillRadioButton(radioGroup, answerValue) {
  if (!radioGroup || radioGroup.length === 0) return false;

  const answerLower = String(answerValue).toLowerCase().trim();

  for (const radio of radioGroup) {
    const label = document.querySelector(`label[for="${radio.id}"]`);
    const radioText = (label?.innerText?.trim() || radio.value).toLowerCase();

    if (
      radioText.includes(answerLower) ||
      answerLower.includes(radioText) ||
      (answerLower === 'yes' && (radioText === 'yes' || radioText.includes('i agree'))) ||
      (answerLower === 'no' && radioText === 'no')
    ) {
      radio.focus();
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      radio.dispatchEvent(new Event('input', { bubbles: true }));
      radio.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      console.log(`QuantumHire AI: Radio selected: "${radioText}"`);
      radio.classList.add('quantumhire-filled');
      return true;
    }
  }
  return false;
}

// ============= DETECT ALL FORM QUESTIONS =============

function detectAllQuestions() {
  const questions = [];
  const platform = detectPlatform();
  const isWorkday = platform.name === 'workday';

  // Detect SELECT dropdowns
  document.querySelectorAll('select').forEach((select) => {
    if (select.offsetParent === null) return;

    let label = '';
    const labelEl = document.querySelector(`label[for="${select.id}"]`) || select.closest('label');
    if (labelEl) label = labelEl.innerText.replace(/\*$/, '').trim();
    if (!label) label = select.getAttribute('aria-label') || select.name || select.id || '';

    if (label) questions.push({ type: 'select', element: select, label, id: select.id || select.name });
  });

  // Detect ARIA combobox dropdowns (Workday and many ATS)
  document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"], [data-automation-id*="dropdown"], [data-automation-id*="select"]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.offsetParent === null) return;

    // Avoid duplicates: skip native selects already captured
    if (el.tagName === 'SELECT') return;

    const label = getComboboxLabel(el);
    if (label) questions.push({ type: isWorkday ? 'workday-dropdown' : 'combobox', element: el, label: label.replace(/\*$/, '').trim(), id: el.id || el.getAttribute('name') || label });
  });

  // Workday-specific: detect button dropdowns with data-automation-id
  if (isWorkday) {
    document.querySelectorAll('button[aria-haspopup="listbox"], button[data-automation-id*="selectWidget"], [data-automation-id*="multiselectInputContainer"] button').forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      if (btn.offsetParent === null) return;
      
      // Get label from parent container
      let label = '';
      const container = btn.closest('[data-automation-id*="formField"], [data-automation-id*="FormField"], .css-*');
      if (container) {
        const labelEl = container.querySelector('label, [data-automation-id*="formLabel"], [data-automation-id="formLabel"]');
        if (labelEl) label = labelEl.innerText.replace(/\*$/, '').trim();
      }
      if (!label) label = btn.getAttribute('aria-label') || btn.innerText?.split('\n')[0]?.trim() || '';
      
      if (label && !questions.find(q => q.element === btn)) {
        questions.push({ type: 'workday-dropdown', element: btn, label, id: btn.getAttribute('data-automation-id') || label });
      }
    });
  }

  // Detect CHECKBOX inputs
  document.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    if (checkbox.offsetParent === null) return;

    let label = '';
    const labelEl = document.querySelector(`label[for="${checkbox.id}"]`) || checkbox.closest('label');
    if (labelEl) label = labelEl.innerText.trim();
    if (!label) label = checkbox.getAttribute('aria-label') || checkbox.name || '';

    if (label) questions.push({ type: 'checkbox', element: checkbox, label, id: checkbox.id || checkbox.name });
  });

  // Detect custom/ARIA checkboxes
  document.querySelectorAll('[role="checkbox"][aria-checked]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.offsetParent === null) return;

    const label = (el.getAttribute('aria-label') || el.innerText || '').trim();
    if (label) questions.push({ type: 'aria-checkbox', element: el, label: label.replace(/\*$/, '').trim(), id: el.id || label });
  });

  // Detect RADIO buttons (group by name)
  const radioGroups = {};
  document.querySelectorAll('input[type="radio"]').forEach((radio) => {
    if (radio.offsetParent === null) return;
    const name = radio.name;
    if (!radioGroups[name]) radioGroups[name] = [];
    radioGroups[name].push(radio);
  });

  Object.entries(radioGroups).forEach(([name, radios]) => {
    let label = '';
    const container = radios[0].closest('fieldset, [role="radiogroup"], .form-group, .question, [class*="question"]');
    if (container) {
      const legend = container.querySelector('legend, label, [class*="label"], [class*="question"]');
      if (legend) label = legend.innerText.replace(/\*$/, '').trim();
    }
    if (!label) label = name;

    questions.push({ type: 'radio', elements: radios, label, id: name });
  });

  // Detect TEXT inputs and TEXTAREAS that look like questions
  // Expanded detection to catch more application questions for AI answering
  document.querySelectorAll('input[type="text"], input[type="number"], input[type="tel"], input[type="url"], textarea').forEach((input) => {
    if (input.offsetParent === null) return;
    // Skip already-filled fields
    if (input.value && input.value.trim() !== '') return;
    // Skip basic form fields that are handled separately
    if (input.type === 'email' || input.type === 'password') return;

    let label = '';
    const labelEl = document.querySelector(`label[for="${input.id}"]`) || input.closest('label');
    if (labelEl) label = labelEl.innerText.replace(/\*$/, '').trim();
    if (!label) label = input.getAttribute('aria-label') || input.placeholder || input.name || '';
    
    // Get container text for more context
    const container = input.closest('.form-field, .question, [class*="question"], [class*="field"], fieldset, div');
    const containerText = container?.innerText?.substring(0, 200) || '';

    // Expanded pattern matching for application questions
    const isQuestion =
      label.includes('?') ||
      // Experience questions
      /years.*experience|how many|experience.*years|total.*experience/i.test(label) ||
      // Compensation
      /salary|expectation|compensation|pay|hourly.*rate/i.test(label) ||
      // URLs
      /linkedin|github|portfolio|website|personal.*site|url/i.test(label) ||
      // Optional fields
      /optional|if applicable|not applicable|n\/a/i.test(label) ||
      // Behavioral/essay questions (key for AI)
      /why.*want|why.*interested|tell.*about|describe|explain|what.*makes|motivat|strength|weakness|challenge|accomplishment|achievement/i.test(label) ||
      /cover letter|additional.*info|anything.*else|message|comments/i.test(label) ||
      // Skills and qualifications
      /proficiency|skill|certif|language|tool|software|technology/i.test(label) ||
      // Availability and logistics
      /start.*date|available|notice|relocat|travel|commute/i.test(label) ||
      // Education
      /degree|major|school|gpa|graduat/i.test(label) ||
      // References
      /reference|referral|hear.*about|source|how.*find/i.test(label) ||
      // Textarea elements are usually essay questions
      (input.tagName === 'TEXTAREA' && label.length > 5);

    if (label && isQuestion) {
      questions.push({ type: 'text', element: input, label, id: input.id || input.name || label });
    }
  });

  return questions;
}

// ============= FILL ALL DETECTED QUESTIONS =============

async function fillAllQuestions(userProfile, jobData, aiAnswers = null) {
  const questions = detectAllQuestions();
  let filledCount = 0;
  const errors = [];

  const isRequiredEl = (el) => {
    if (!el) return false;
    if (el.hasAttribute?.('required')) return true;
    if (el.getAttribute?.('aria-required') === 'true') return true;
    return false;
  };

  const shouldAutoNA = (q) => {
    const labelLower = (q.label || '').toLowerCase();
    if (!/optional|if applicable|not applicable|n\/a|na\b/.test(labelLower)) return false;
    if (q.type !== 'text') return false;
    return !isRequiredEl(q.element);
  };

  for (const q of questions) {
    try {
      const labelLower = (q.label || '').toLowerCase();
      const qId = q.id || q.label;

      // First try knockout answer bank
      const knockoutMatch = matchKnockoutQuestion(q.label, userProfile);
      let answer = knockoutMatch?.answer;
      let selectValue = knockoutMatch?.selectValue;

      // Check AI answers - handle both object and string formats
      if (!answer && aiAnswers) {
        const aiAnswer = aiAnswers[qId];
        if (aiAnswer) {
          // AI answer can be string or object with { answer, selectValue }
          if (typeof aiAnswer === 'string') {
            answer = aiAnswer;
            selectValue = aiAnswer.toLowerCase();
          } else if (aiAnswer.answer) {
            answer = aiAnswer.answer;
            selectValue = aiAnswer.selectValue || aiAnswer.answer.toLowerCase();
          }
        }
      }

      // Special handling for specific question types
      if (!answer) {
        // Salary questions
        if (labelLower.match(/salary|pay range|compensation|expected.*pay|desired pay/)) {
          answer = getSalaryAnswer(q.label, jobData, userProfile);
        }
        // Years of experience
        else if (labelLower.match(/years.*experience|how many years|experience.*years/i)) {
          const skillMatch = q.label.match(/experience\s+(?:in|with|using)?\s*([a-zA-Z+#.\s]+)/i);
          answer = skillMatch ? String(getExperienceYears(skillMatch[1].trim(), userProfile)) : (userProfile?.total_experience || '8');
        }
        // Profile-based answers
        else if (labelLower.match(/linkedin/)) answer = userProfile?.linkedin || '';
        else if (labelLower.match(/github/)) answer = userProfile?.github || '';
        else if (labelLower.match(/portfolio|website/)) answer = userProfile?.portfolio || '';
        else if (labelLower.match(/highest.*education|education.*level/)) answer = userProfile?.highest_education || "Bachelor's Degree";
        // Non-essential questions: auto N/A
        else if (shouldAutoNA(q)) answer = 'N/A';
      }

      if (!answer) continue;

      // Fill based on question type
      if (q.type === 'select') {
        const ok = fillDropdown(q.element, selectValue || answer);
        if (ok) filledCount++;
        else errors.push({ question: q.label, error: 'No matching dropdown option' });
      } else if (q.type === 'workday-dropdown') {
        // Use Workday-specific dropdown filler
        const ok = await fillWorkdayDropdown(q.element, selectValue || answer);
        if (ok) filledCount++;
        else errors.push({ question: q.label, error: 'No matching Workday dropdown option' });
      } else if (q.type === 'combobox') {
        const ok = await fillComboBox(q.element, selectValue || answer);
        if (ok) filledCount++;
        else errors.push({ question: q.label, error: 'No matching combobox option' });
      } else if (q.type === 'checkbox') {
        const shouldCheck = ['yes', 'true', 'agree', 'i agree', 'accept', 'confirm'].some((v) => String(answer).toLowerCase().includes(v));
        if (fillCheckbox(q.element, shouldCheck)) filledCount++;
      } else if (q.type === 'aria-checkbox') {
        const shouldCheck = ['yes', 'true', 'agree', 'i agree', 'accept', 'confirm'].some((v) => String(answer).toLowerCase().includes(v));
        if (fillAriaCheckbox(q.element, shouldCheck)) filledCount++;
      } else if (q.type === 'radio') {
        if (fillRadioButton(q.elements, answer)) filledCount++;
        else errors.push({ question: q.label, error: 'No matching radio option' });
      } else if (q.type === 'text') {
        if (fillField(q.element, answer)) filledCount++;
      }
    } catch (error) {
      console.error(`QuantumHire AI: Error filling "${q.label}"`, error);
      errors.push({ question: q.label, error: error?.message || 'Unknown error' });
    }
  }

  console.log(`QuantumHire AI: Filled ${filledCount}/${questions.length} questions. Errors:`, errors);
  return { filledCount, totalQuestions: questions.length, errors };
}

// ============= PDF GENERATION =============

const SUPABASE_URL = 'https://wntpldomgjutwufphnpg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudHBsZG9tZ2p1dHd1ZnBobnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDY0NDAsImV4cCI6MjA4MjE4MjQ0MH0.vOXBQIg6jghsAby2MA1GfE-MNTRZ9Ny1W2kfUHGUzNM';

async function generatePDF(type, profileData, jobData, tailoredData) {
  console.log(`QuantumHire AI: Generating ${type} PDF...`);
  
  const firstName = (profileData.first_name || profileData.firstName || 'User').replace(/\s+/g, '');
  const lastName = (profileData.last_name || profileData.lastName || '').replace(/\s+/g, '');
  const companyName = (jobData?.company || 'Company').replace(/[^a-zA-Z0-9]/g, '');
  const fileType = type === 'resume' ? 'CV' : 'CoverLetter';
  const fileName = `${firstName}${lastName}_${companyName}_${fileType}.pdf`;
  
  try {
    // Build personal info from profile
    const name = `${profileData.first_name || profileData.firstName || ''} ${profileData.last_name || profileData.lastName || ''}`.trim() || 'Applicant';
    
    const requestBody = {
      type: type,
      personalInfo: {
        name: name,
        email: profileData.email || '',
        phone: profileData.phone || '',
        location: jobData?.location || profileData.city || profileData.location || '',
        linkedin: profileData.linkedin || '',
        github: profileData.github || '',
        portfolio: profileData.portfolio || ''
      },
      fileName: fileName
    };
    
    if (type === 'resume') {
      const resumeText = tailoredData?.tailoredResume || '';
      requestBody.summary = extractSection(resumeText, 'summary', 'professional summary') || 
        'Experienced professional seeking to leverage skills and expertise.';
      requestBody.experience = parseExperience(resumeText, profileData.work_experience || profileData.workExperience);
      requestBody.education = parseEducation(profileData.education);
      requestBody.skills = parseSkills(resumeText, profileData.skills);
      requestBody.certifications = profileData.certifications || [];
      requestBody.achievements = parseAchievements(profileData.achievements);
    } else {
      const coverText = tailoredData?.tailoredCoverLetter || '';
      // Parse cover letter into paragraphs
      let paragraphs = coverText.split(/\n\n+/).filter(p => p.trim().length > 20);
      if (paragraphs.length === 0 && coverText.trim()) {
        paragraphs = [coverText.trim()];
      }
      if (paragraphs.length === 0) {
        paragraphs = [
          `I am writing to express my strong interest in the ${jobData?.title || 'position'} role at ${jobData?.company || 'your company'}.`,
          `With my background and skills, I am confident I would be a valuable addition to your team. I look forward to the opportunity to discuss how my experience aligns with your needs.`
        ];
      }
      requestBody.coverLetter = {
        recipientCompany: jobData?.company || 'Company',
        jobTitle: jobData?.title || 'Position',
        jobId: jobData?.jobId || '',
        paragraphs: paragraphs
      };
    }
    
    console.log('QuantumHire AI: Sending PDF request for:', type, requestBody.personalInfo.name);
    
    // Get access token for authenticated request
    const authData = await chrome.storage.local.get(['accessToken']);
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY
    };
    if (authData.accessToken) {
      headers['Authorization'] = `Bearer ${authData.accessToken}`;
    }
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-pdf`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(errorData.error || `PDF generation failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success || !result.pdf) {
      throw new Error(result.error || 'PDF generation returned empty result');
    }
    
    console.log(`QuantumHire AI: ✅ PDF generated: ${result.fileName} (${formatBytes(result.size)})`);
    showToast(`📄 Generated: ${result.fileName}`, 'success');
    
    return { success: true, pdf: result.pdf, fileName: result.fileName, size: result.size };
  } catch (error) {
    console.error('QuantumHire AI: PDF generation error:', error);
    showToast(`❌ PDF Error: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractSection(text, ...keywords) {
  const lines = text.split('\n');
  let capture = false;
  let section = [];
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (keywords.some(kw => lower.includes(kw))) { capture = true; continue; }
    if (capture) {
      if (line.match(/^[A-Z][A-Z\s]+$/) || line.match(/^#{1,3}\s/)) break;
      section.push(line.trim());
    }
  }
  return section.filter(l => l).join(' ').substring(0, 500);
}

function parseExperience(resumeText, fallbackExperience) {
  if (fallbackExperience && Array.isArray(fallbackExperience)) {
    return fallbackExperience.map(exp => ({
      company: exp.company || '',
      title: exp.title || '',
      dates: exp.dates || `${exp.start_date || ''} – ${exp.end_date || 'Present'}`,
      bullets: Array.isArray(exp.description) ? exp.description : (exp.description || '').split('\n').filter(b => b.trim())
    }));
  }
  return [];
}

function parseEducation(education) {
  if (!education || !Array.isArray(education)) return [];
  return education.map(edu => ({ degree: edu.degree || '', school: edu.school || edu.institution || '', dates: edu.dates || '', gpa: edu.gpa || '' }));
}

function parseSkills(resumeText, fallbackSkills) {
  if (fallbackSkills && Array.isArray(fallbackSkills)) {
    return {
      primary: fallbackSkills.filter(s => s.proficiency === 'expert' || s.proficiency === 'advanced').map(s => s.name),
      secondary: fallbackSkills.filter(s => s.proficiency !== 'expert' && s.proficiency !== 'advanced').map(s => s.name)
    };
  }
  return { primary: [], secondary: [] };
}

function parseAchievements(achievements) {
  if (!achievements || !Array.isArray(achievements)) return [];
  return achievements.map(a => ({ title: a.title || '', date: a.date || '', description: a.description || '' }));
}

// ============= PDF UPLOAD (ENHANCED FOR ALL ATS PLATFORMS) =============

// Find file upload sections (like Greenhouse "Attach" button sections, Workday dropzones, etc.)
function findFileUploadSections() {
  const sections = [];
  const foundElements = new Set();
  
  // Label patterns to detect resume vs cover letter sections
  const labelPatterns = [
    { type: 'resume', patterns: ['resume', 'cv', 'résumé', 'curriculum vitae', 'upload your resume', 'attach resume', 'upload cv', 'lebenslauf', 'curriculum', 'your resume'] },
    { type: 'cover', patterns: ['cover letter', 'cover-letter', 'coverletter', 'letter of interest', 'cover_letter', 'motivation letter', 'anschreiben', 'lettre de motivation'] }
  ];
  
  // Strategy 1: Find file inputs directly and classify by context
  document.querySelectorAll('input[type="file"]').forEach(input => {
    if (input.offsetParent === null && !input.closest('[aria-hidden="false"]') && !input.closest('.sr-only')) return;
    if (foundElements.has(input)) return;
    
    const container = input.closest('div, section, fieldset, form, [class*="upload"], [class*="file"], [class*="attachment"]');
    const contextText = (
      findLabelForInput(input) + ' ' + 
      (container?.innerText?.substring(0, 300) || '') + ' ' +
      (input.getAttribute('name') || '') + ' ' +
      (input.getAttribute('id') || '') + ' ' +
      (input.getAttribute('data-automation-id') || '') + ' ' +
      (input.getAttribute('aria-label') || '') + ' ' +
      (input.getAttribute('accept') || '')
    ).toLowerCase();
    
    let type = 'resume'; // Default to resume
    if (labelPatterns[1].patterns.some(p => contextText.includes(p))) type = 'cover';
    
    sections.push({ type, input, container, label: contextText.substring(0, 80) });
    foundElements.add(input);
  });
  
  // Strategy 2: Find labeled sections with attach/upload buttons
  const labelSelectors = 'label, h2, h3, h4, h5, p, span, div, legend, ' +
    '[class*="label"], [data-automation-id*="label"], [class*="title"], [class*="header"]';
  
  document.querySelectorAll(labelSelectors).forEach(el => {
    const text = (el.innerText || el.textContent || '').toLowerCase();
    if (text.length > 400 || text.length < 3) return; // Skip if too much or too little text
    
    for (const labelType of labelPatterns) {
      if (labelType.patterns.some(p => text.includes(p))) {
        // Search in parent containers for buttons or file inputs
        const containers = [
          el.closest('div'),
          el.closest('section'),
          el.closest('fieldset'),
          el.closest('[class*="upload"]'),
          el.closest('[class*="file"]'),
          el.parentElement,
          el.parentElement?.parentElement,
          el.parentElement?.parentElement?.parentElement,
          el.parentElement?.parentElement?.parentElement?.parentElement
        ].filter(Boolean);
        
        for (const container of containers) {
          // Find "Attach" / "Upload" / "Browse" buttons
          const buttons = container.querySelectorAll('button, a[role="button"], [role="button"], [class*="button"], [class*="btn"]');
          for (const btn of buttons) {
            if (foundElements.has(btn)) continue;
            const btnText = ((btn.innerText || '') + (btn.getAttribute('aria-label') || '')).toLowerCase();
            if (btnText.match(/attach|upload|browse|select file|add file|choose|datei|archivo|fichier/i)) {
              sections.push({ type: labelType.type, button: btn, container, label: text.substring(0, 80) });
              foundElements.add(btn);
            }
          }
          
          // Also check for file input we might have missed
          const fileInputs = container.querySelectorAll('input[type="file"]');
          for (const input of fileInputs) {
            if (!foundElements.has(input)) {
              sections.push({ type: labelType.type, input, container, label: text.substring(0, 80) });
              foundElements.add(input);
            }
          }
        }
        break; // Found a match for this element, no need to check other patterns
      }
    }
  });
  
  // Strategy 3: Workday-specific dropzone detection
  const workdaySelectors = [
    '[data-automation-id*="file"]', '[data-automation-id*="upload"]', 
    '[data-automation-id*="resume"]', '[data-automation-id*="attachment"]',
    '[data-automation-id*="Resume"]', '[data-automation-id*="CoverLetter"]',
    '[data-automation-id="fileUpload"]', '[data-automation-id="attachmentBlock"]'
  ];
  
  document.querySelectorAll(workdaySelectors.join(',')).forEach(el => {
    if (foundElements.has(el)) return;
    
    const container = el.closest('[data-automation-id*="formField"]') || 
                      el.closest('[data-automation-id*="FormField"]') || 
                      el.closest('div[class*="WGDC"]') ||
                      el.closest('div');
    const contextText = (container?.innerText?.substring(0, 300) || '').toLowerCase();
    
    let type = 'resume';
    if (labelPatterns[1].patterns.some(p => contextText.includes(p))) type = 'cover';
    
    // Check if it's a button or contains a file input
    const fileInput = el.querySelector('input[type="file"]') || (el.tagName === 'INPUT' && el.type === 'file' ? el : null);
    const isButton = el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.classList.contains('css-1dbjc4n');
    
    if (fileInput && !foundElements.has(fileInput)) {
      sections.push({ type, input: fileInput, container, label: contextText.substring(0, 80) });
      foundElements.add(fileInput);
    } else if (isButton) {
      sections.push({ type, button: el, container, label: contextText.substring(0, 80) });
      foundElements.add(el);
    }
  });
  
  // Strategy 4: Greenhouse-specific patterns
  document.querySelectorAll('[id*="resume"], [id*="cover"], [name*="resume"], [name*="cover"], #resume_text, #cover_letter_text').forEach(el => {
    if (foundElements.has(el)) return;
    
    const container = el.closest('.field, .form-field, [class*="field"]') || el.closest('div');
    const contextText = (container?.innerText?.substring(0, 200) || '').toLowerCase();
    
    let type = 'resume';
    if (el.id?.includes('cover') || el.name?.includes('cover') || contextText.includes('cover')) {
      type = 'cover';
    }
    
    const fileInput = container?.querySelector('input[type="file"]');
    const attachBtn = container?.querySelector('button, [role="button"]');
    
    if (fileInput && !foundElements.has(fileInput)) {
      sections.push({ type, input: fileInput, container, label: contextText.substring(0, 80) });
      foundElements.add(fileInput);
    } else if (attachBtn && !foundElements.has(attachBtn)) {
      const btnText = (attachBtn.innerText || '').toLowerCase();
      if (btnText.match(/attach|upload|browse|select|choose/)) {
        sections.push({ type, button: attachBtn, container, label: contextText.substring(0, 80) });
        foundElements.add(attachBtn);
      }
    }
  });
  
  // Strategy 5: Generic dropzone / drag-drop areas
  document.querySelectorAll('[class*="dropzone"], [class*="drop-zone"], [class*="upload-area"], [class*="file-upload"], [class*="drag-drop"]').forEach(zone => {
    const fileInput = zone.querySelector('input[type="file"]');
    if (fileInput && !foundElements.has(fileInput)) {
      const contextText = (zone.innerText?.substring(0, 200) || '').toLowerCase();
      let type = 'resume';
      if (labelPatterns[1].patterns.some(p => contextText.includes(p))) type = 'cover';
      sections.push({ type, input: fileInput, container: zone, label: contextText.substring(0, 80) });
      foundElements.add(fileInput);
    }
  });
  
  // Strategy 6: Lever-specific patterns
  document.querySelectorAll('.application-field, .file-input-wrapper, [class*="resume-upload"], [class*="file-field"]').forEach(container => {
    const fileInput = container.querySelector('input[type="file"]');
    if (fileInput && !foundElements.has(fileInput)) {
      const contextText = (container.innerText?.substring(0, 200) || '').toLowerCase();
      let type = 'resume';
      if (labelPatterns[1].patterns.some(p => contextText.includes(p))) type = 'cover';
      sections.push({ type, input: fileInput, container, label: contextText.substring(0, 80) });
      foundElements.add(fileInput);
    }
  });
  
  // Strategy 7: SmartRecruiters and iCIMS patterns
  document.querySelectorAll('[class*="upload-resume"], [class*="resume-attachment"], [data-test*="resume"], [data-test*="upload"]').forEach(el => {
    if (foundElements.has(el)) return;
    
    const container = el.closest('div, section');
    const fileInput = container?.querySelector('input[type="file"]') || (el.tagName === 'INPUT' && el.type === 'file' ? el : null);
    const contextText = (container?.innerText?.substring(0, 200) || '').toLowerCase();
    
    if (fileInput && !foundElements.has(fileInput)) {
      let type = 'resume';
      if (labelPatterns[1].patterns.some(p => contextText.includes(p))) type = 'cover';
      sections.push({ type, input: fileInput, container, label: contextText.substring(0, 80) });
      foundElements.add(fileInput);
    }
  });
  
  console.log(`QuantumHire AI: Found ${sections.length} file upload sections:`, sections.map(s => ({ type: s.type, hasInput: !!s.input, hasButton: !!s.button, label: s.label?.substring(0, 40) })));
  
  return sections;
}

// Click "Attach" button and wait for the *relevant* file input to appear
// Many ATS UIs render a modal/dialog with a hidden <input type="file"> and an extra "Upload/Attach" confirmation.
async function clickAttachAndGetFileInput(attachButton, maxWait = 6000) {
  const startedAt = Date.now();

  const getLikelyUploadRoot = () => {
    // Prefer active dialog/modal if present
    const dialogs = Array.from(document.querySelectorAll(
      '[role="dialog"], dialog, [aria-modal="true"], .modal, .Modal, .ReactModal__Content'
    )).filter((d) => (d.offsetParent !== null) && d.querySelector('input[type="file"]'));
    if (dialogs.length) return dialogs[dialogs.length - 1];

    // Otherwise, prefer the nearest container
    return attachButton.closest('section, fieldset, form, div') || document.body;
  };

  const findFileInputInRoot = (root) => {
    const inputs = Array.from(root.querySelectorAll('input[type="file"]')).filter((i) => !i.dataset.qhUsed);
    if (!inputs.length) return null;

    // Prefer visible (some ATS keep it offscreen but still works)
    const visible = inputs.find((i) => i.offsetParent !== null) || inputs[0];
    return visible;
  };

  // Click using real mouse event to satisfy some frameworks' gesture checks
  try {
    attachButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  } catch {
    attachButton.click();
  }
  console.log('QuantumHire AI: Clicked attach button');

  const initialRoot = getLikelyUploadRoot();
  let existing = findFileInputInRoot(initialRoot);
  if (existing) return { fileInput: existing, uploadRoot: initialRoot };

  return await new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const root = getLikelyUploadRoot();
      const input = findFileInputInRoot(root);
      if (input) {
        observer.disconnect();
        resolve({ fileInput: input, uploadRoot: root });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const t = setInterval(() => {
      if (Date.now() - startedAt > maxWait) {
        clearInterval(t);
        observer.disconnect();
        // Fallback: last resort, any file input
        const any = Array.from(document.querySelectorAll('input[type="file"]')).find((i) => !i.dataset.qhUsed) || null;
        resolve({ fileInput: any, uploadRoot: any ? (any.closest('[role="dialog"], dialog, [aria-modal="true"], .modal, .Modal') || any.closest('section, fieldset, form, div') || document.body) : null });
      }
    }, 150);
  });
}

function clickPossibleConfirmButton(uploadRoot) {
  if (!uploadRoot) return false;

  const candidates = Array.from(uploadRoot.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]'))
    .filter((b) => (b.offsetParent !== null));

  const scoreText = (t) => {
    const s = (t || '').toLowerCase().trim();
    if (!s) return 0;
    // Prefer explicit confirmation verbs
    if (/(upload|attach|save|done|add|confirm)/.test(s)) return 3;
    if (/(next|continue)/.test(s)) return 2;
    if (/(cancel|close|back)/.test(s)) return -10;
    return 0;
  };

  let best = null;
  let bestScore = 0;
  for (const el of candidates) {
    const label = (el.tagName === 'INPUT' ? el.value : el.innerText) || el.getAttribute('aria-label') || '';
    const sc = scoreText(label);
    if (sc > bestScore) {
      bestScore = sc;
      best = el;
    }
  }

  if (best && bestScore > 0) {
    try {
      best.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch {
      best.click();
    }
    return true;
  }

  return false;
}

// Upload PDF to standard file input (and confirm if the ATS requires an extra step)
async function uploadPDFToInput(fileInput, pdfBase64, fileName, uploadRoot = null) {
  if (!fileInput || !pdfBase64) return { success: false, error: 'Missing input or PDF data' };

  try {
    console.log(`QuantumHire AI: Uploading ${fileName} to file input...`, { inputId: fileInput.id, inputName: fileInput.name });

    // Normalize base64 (some responses may include data: prefix)
    let base64 = String(pdfBase64);
    if (base64.includes('base64,')) {
      base64 = base64.split('base64,')[1];
    }
    // Remove any whitespace including newlines
    base64 = base64.replace(/[\s\r\n]/g, '');
    
    // Validate base64
    if (!base64 || base64.length < 100) {
      throw new Error('Invalid PDF data (too short)');
    }
    
    // Validate base64 characters
    if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
      throw new Error('Invalid base64 characters in PDF data');
    }

    // Decode base64 to binary
    let binaryString;
    try {
      binaryString = atob(base64);
    } catch (decodeError) {
      console.error('QuantumHire AI: Base64 decode error:', decodeError);
      throw new Error('Failed to decode PDF data');
    }
    
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Verify PDF header
    const pdfHeader = String.fromCharCode(...bytes.slice(0, 5));
    if (!pdfHeader.startsWith('%PDF')) {
      console.warn('QuantumHire AI: PDF header check failed, but proceeding...');
    }

    const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf', lastModified: Date.now() });

    console.log(`QuantumHire AI: Created file object: ${pdfFile.name}, size: ${pdfFile.size} bytes`);

    // Remove any accept restrictions temporarily
    const originalAccept = fileInput.accept;
    if (fileInput.accept && !fileInput.accept.includes('pdf') && !fileInput.accept.includes('*')) {
      fileInput.accept = '.pdf,application/pdf,' + fileInput.accept;
    }

    // Method 1: DataTransfer API (modern browsers - most reliable)
    let fileSet = false;
    try {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(pdfFile);
      fileInput.files = dataTransfer.files;
      fileSet = fileInput.files && fileInput.files.length > 0;
      console.log('QuantumHire AI: DataTransfer method result:', fileSet);
    } catch (dtError) {
      console.log('QuantumHire AI: DataTransfer failed:', dtError.message);
    }
    
    // Method 2: ClipboardEvent fallback
    if (!fileSet) {
      try {
        const clipboardData = new ClipboardEvent('paste').clipboardData || new DataTransfer();
        clipboardData.items.add(pdfFile);
        fileInput.files = clipboardData.files;
        fileSet = fileInput.files && fileInput.files.length > 0;
        console.log('QuantumHire AI: ClipboardEvent method result:', fileSet);
      } catch (cbError) {
        console.log('QuantumHire AI: ClipboardEvent fallback failed:', cbError.message);
      }
    }
    
    // Restore original accept
    if (originalAccept !== undefined) {
      fileInput.accept = originalAccept;
    }

    // Fire comprehensive events for React/Angular/Vue/Svelte compatibility
    const events = ['input', 'change'];
    for (const eventName of events) {
      const event = new Event(eventName, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'target', { writable: false, value: fileInput });
      fileInput.dispatchEvent(event);
    }
    
    // React-specific: trigger native setter to bypass React's controlled input
    try {
      const nativeFilesSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
      if (nativeFilesSetter && fileSet) {
        const dt = new DataTransfer();
        dt.items.add(pdfFile);
        nativeFilesSetter.call(fileInput, dt.files);
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        fileInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch (reactError) {
      console.log('QuantumHire AI: React setter approach failed:', reactError.message);
    }
    
    // Angular-specific: NgZone detection
    try {
      if (window.ng && window.ng.probe) {
        const ngComponent = window.ng.probe(fileInput);
        if (ngComponent) {
          console.log('QuantumHire AI: Angular component detected, triggering zone update');
        }
      }
    } catch (angularError) {}

    // Wait for framework state updates
    await new Promise((r) => setTimeout(r, 500));

    // If there is an explicit confirm/upload step inside a modal, click it
    const confirmRoot = uploadRoot || 
      fileInput.closest('[role="dialog"], dialog, [aria-modal="true"], .modal, .Modal, [class*="modal"], [class*="popup"]') || 
      null;
    
    const confirmed = clickPossibleConfirmButton(confirmRoot);
    if (confirmed) {
      console.log('QuantumHire AI: Clicked confirm/upload button');
      await new Promise((r) => setTimeout(r, 800));
    }

    // Verification - check multiple indicators of success
    const hasFileOnInput = fileInput.files && fileInput.files.length > 0 && fileInput.files[0]?.size > 0;
    const parentContainer = confirmRoot || fileInput.closest('section, fieldset, form, div, [class*="upload"]') || document.body;
    const uiText = (parentContainer.innerText || '').toLowerCase();
    const fileNameLower = fileName.toLowerCase().replace('.pdf', '');
    const uiShowsName = uiText.includes(fileNameLower) || uiText.includes('.pdf') || uiText.includes('pdf');
    const uiShowsSuccess = uiText.includes('uploaded') || uiText.includes('attached') || uiText.includes('selected') || uiText.includes('added');
    
    // Check for visual indicators (green checkmark, success class, etc.)
    const hasSuccessIndicator = parentContainer.querySelector(
      '[class*="success"], [class*="check"], [class*="complete"], ' +
      '.is-uploaded, .uploaded, .file-added, [class*="file-name"], ' +
      '[data-automation-id*="uploaded"], [data-automation-id*="fileName"]'
    ) !== null;
    
    // Additional check: did the file input's visual state change?
    const inputWrapper = fileInput.closest('[class*="upload"], [class*="file"], [class*="input"]');
    const wrapperChanged = inputWrapper && (
      inputWrapper.classList.contains('has-file') || 
      inputWrapper.classList.contains('filled') ||
      inputWrapper.getAttribute('data-has-file') === 'true'
    );

    if (hasFileOnInput || uiShowsName || uiShowsSuccess || hasSuccessIndicator || wrapperChanged) {
      console.log(`QuantumHire AI: ✅ PDF uploaded successfully: ${fileName}`);
      fileInput.dataset.qhUsed = 'true';
      return { success: true, fileName, size: pdfFile.size };
    }

    // Even if we can't verify, if we set the files property, consider it a success
    if (fileInput.files && fileInput.files.length > 0) {
      console.log(`QuantumHire AI: ⚠️ PDF attached (unverified UI): ${fileName}`);
      fileInput.dataset.qhUsed = 'true';
      return { success: true, fileName, size: pdfFile.size, unverified: true };
    }

    throw new Error('Upload did not reflect in UI or file input');
  } catch (error) {
    console.error('QuantumHire AI: Upload error:', error);
    return { success: false, error: error?.message || 'Upload error' };
  }
}

// Main PDF upload function with button-based interface support
async function uploadPDFFile(target, pdfBase64, fileName, maxRetries = 3) {
  if (!pdfBase64) return { success: false, error: 'Missing PDF data' };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`QuantumHire AI: PDF upload attempt ${attempt}/${maxRetries} for ${fileName}`);

      let fileInput = null;
      let uploadRoot = null;

      // Check if target is a file input or a button
      if (target?.tagName === 'INPUT' && target.type === 'file') {
        fileInput = target;
        uploadRoot = target.closest('[role="dialog"], dialog, [aria-modal="true"], .modal, .Modal') || target.closest('section, fieldset, form, div') || null;
      } else if (target?.tagName === 'BUTTON' || target?.role === 'button' || target?.tagName === 'A') {
        // It's a button - click it and wait for the relevant file input
        const res = await clickAttachAndGetFileInput(target);
        fileInput = res.fileInput;
        uploadRoot = res.uploadRoot;
      } else {
        // Try to find a file input in the container
        const container = target?.closest('div, section, fieldset, form');
        fileInput = container?.querySelector('input[type="file"]') || null;
        uploadRoot = container || null;
      }

      if (!fileInput) throw new Error('Could not find file input');

      const result = await uploadPDFToInput(fileInput, pdfBase64, fileName, uploadRoot);

      if (result.success) {
        fileInput.dataset.qhUsed = 'true';
        showToast(`✅ Attached: ${fileName}`, 'success');
        return result;
      }

      throw new Error(result.error || 'Upload failed');
    } catch (error) {
      console.error(`QuantumHire AI: Upload attempt ${attempt} failed:`, error);
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }

  showToast(`❌ Upload failed: ${fileName}`, 'error');
  return { success: false, error: 'Upload failed after retries' };
}

// Find and upload PDFs to all available file upload sections
async function uploadPDFsToAllSections(resumePdfResult, coverPdfResult) {
  const sections = findFileUploadSections();
  const results = { resumeUploaded: false, coverUploaded: false, filesUploaded: 0 };
  
  console.log(`QuantumHire AI: Found ${sections.length} file upload sections:`, sections.map(s => s.type));
  
  for (const section of sections) {
    const target = section.input || section.button;
    if (!target) continue;
    
    if (section.type === 'resume' && resumePdfResult?.success && !results.resumeUploaded) {
      const uploadResult = await uploadPDFFile(target, resumePdfResult.pdf, resumePdfResult.fileName);
      if (uploadResult.success) {
        results.resumeUploaded = true;
        results.filesUploaded++;
        console.log(`QuantumHire AI: ✅ Resume uploaded to section: ${section.label}`);
      }
    } else if (section.type === 'cover' && coverPdfResult?.success && !results.coverUploaded) {
      const uploadResult = await uploadPDFFile(target, coverPdfResult.pdf, coverPdfResult.fileName);
      if (uploadResult.success) {
        results.coverUploaded = true;
        results.filesUploaded++;
        console.log(`QuantumHire AI: ✅ Cover letter uploaded to section: ${section.label}`);
      }
    }
  }
  
  // Fallback: look for any visible file inputs not yet used
  if (!results.resumeUploaded && resumePdfResult?.success) {
    const unusedInputs = Array.from(document.querySelectorAll('input[type="file"]:not([data-qh-used])'))
      .filter(i => i.offsetParent !== null);
    
    for (const input of unusedInputs) {
      const labelText = findLabelForInput(input).toLowerCase();
      const parentText = (input.closest('div, section')?.innerText || '').toLowerCase().substring(0, 100);
      
      // Skip if this looks like a cover letter field
      if (labelText.includes('cover') || parentText.includes('cover letter')) continue;
      
      const uploadResult = await uploadPDFFile(input, resumePdfResult.pdf, resumePdfResult.fileName);
      if (uploadResult.success) {
        results.resumeUploaded = true;
        results.filesUploaded++;
        input.dataset.qhUsed = 'true';
        break;
      }
    }
  }
  
  if (!results.coverUploaded && coverPdfResult?.success) {
    const unusedInputs = Array.from(document.querySelectorAll('input[type="file"]:not([data-qh-used])'))
      .filter(i => i.offsetParent !== null);
    
    for (const input of unusedInputs) {
      const labelText = findLabelForInput(input).toLowerCase();
      const parentText = (input.closest('div, section')?.innerText || '').toLowerCase().substring(0, 100);
      
      // Prefer cover letter fields
      if (labelText.includes('cover') || parentText.includes('cover letter')) {
        const uploadResult = await uploadPDFFile(input, coverPdfResult.pdf, coverPdfResult.fileName);
        if (uploadResult.success) {
          results.coverUploaded = true;
          results.filesUploaded++;
          input.dataset.qhUsed = 'true';
          break;
        }
      }
    }
  }
  
  return results;
}

// ============= CHECK IF PAGE IS COMPLETE =============

function isPageComplete() {
  const requiredFields = document.querySelectorAll('[required], [aria-required="true"]');
  const emptyDropdowns = [];
  const emptyInputs = [];
  const uncheckedRequired = [];
  
  for (const field of requiredFields) {
    if (field.offsetParent === null) continue; // Skip hidden
    
    if (field.tagName === 'SELECT') {
      if (!field.value || field.value === '' || field.selectedIndex === 0) {
        emptyDropdowns.push(field);
      }
    } else if (field.type === 'checkbox') {
      if (!field.checked) uncheckedRequired.push(field);
    } else if (field.type === 'radio') {
      const name = field.name;
      const group = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
      const anyChecked = Array.from(group).some(r => r.checked);
      if (!anyChecked) uncheckedRequired.push(field);
    } else if (!field.value || field.value.trim() === '') {
      emptyInputs.push(field);
    }
  }
  
  const allComplete = emptyDropdowns.length === 0 && emptyInputs.length === 0 && uncheckedRequired.length === 0;
  
  return {
    complete: allComplete,
    emptyDropdowns,
    emptyInputs,
    uncheckedRequired,
    totalIssues: emptyDropdowns.length + emptyInputs.length + uncheckedRequired.length
  };
}

// ============= AUTO NAVIGATE TO NEXT PAGE =============

async function navigateToNextPage() {
  const platform = detectPlatform();
  
  // Try platform-specific next button
  const nextSelectors = [
    platform.config?.nextButton,
    'button[type="submit"]:not([disabled])',
    'input[type="submit"]:not([disabled])',
    'button:contains("Next")',
    'button:contains("Continue")',
    'a:contains("Next")',
    '[data-automation-id="bottom-navigation-next-button"]',
    '.btn-next',
    '.next-button',
    '[class*="next"]'
  ].filter(Boolean);
  
  for (const selector of nextSelectors) {
    try {
      const nextBtn = document.querySelector(selector);
      if (nextBtn && nextBtn.offsetParent !== null && !nextBtn.disabled) {
        console.log('QuantumHire AI: Clicking next button:', selector);
        nextBtn.click();
        showToast('➡️ Moving to next page...', 'info');
        return true;
      }
    } catch (e) {}
  }
  
  // Try by button text
  const buttons = document.querySelectorAll('button, input[type="submit"], a.btn');
  for (const btn of buttons) {
    const text = btn.innerText?.toLowerCase() || btn.value?.toLowerCase() || '';
    if ((text.includes('next') || text.includes('continue') || text.includes('proceed')) && !btn.disabled && btn.offsetParent !== null) {
      console.log('QuantumHire AI: Clicking button by text:', text);
      btn.click();
      showToast('➡️ Moving to next page...', 'info');
      return true;
    }
  }
  
  return false;
}

// ============= CHECK IF THIS IS FINAL PAGE =============

function isFinalPage() {
  const buttons = document.querySelectorAll('button, input[type="submit"]');
  for (const btn of buttons) {
    const text = (btn.innerText?.toLowerCase() || btn.value?.toLowerCase() || '').trim();
    // Look for submit-related text
    if ((text.includes('submit') || text === 'apply' || text === 'apply now' || 
         text.includes('submit application') || text.includes('complete application')) && 
        !text.includes('next') && btn.offsetParent !== null && !btn.disabled) {
      return true;
    }
  }
  
  // Check for Workday-specific submit button
  const workdaySubmit = document.querySelector('[data-automation-id="bottom-navigation-submit-button"]');
  if (workdaySubmit && workdaySubmit.offsetParent !== null) return true;
  
  return false;
}

// ============= AUTO-SUBMIT APPLICATION =============

async function autoSubmitApplication() {
  console.log('QuantumHire AI: Attempting auto-submit...');
  
  // Find submit button
  const submitSelectors = [
    '[data-automation-id="bottom-navigation-submit-button"]',
    'button[type="submit"]:not([disabled])',
    'input[type="submit"]:not([disabled])',
  ];
  
  // First try by selector
  for (const selector of submitSelectors) {
    try {
      const submitBtn = document.querySelector(selector);
      if (submitBtn && submitBtn.offsetParent !== null && !submitBtn.disabled) {
        const btnText = (submitBtn.innerText?.toLowerCase() || submitBtn.value?.toLowerCase() || '').trim();
        // Make sure it's actually a submit button, not next
        if (btnText.includes('submit') || btnText === 'apply' || btnText === 'apply now' ||
            submitBtn.getAttribute('data-automation-id')?.includes('submit')) {
          console.log('QuantumHire AI: Clicking submit button:', selector);
          submitBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
          await new Promise(r => setTimeout(r, 300));
          submitBtn.click();
          showToast('🎉 Application submitted!', 'success');
          return { success: true, message: 'Application submitted' };
        }
      }
    } catch (e) {}
  }
  
  // Try by button text
  const buttons = document.querySelectorAll('button, input[type="submit"], a.btn');
  for (const btn of buttons) {
    const text = (btn.innerText?.toLowerCase() || btn.value?.toLowerCase() || '').trim();
    if ((text.includes('submit') || text === 'apply' || text === 'apply now' || 
         text.includes('submit application')) && 
        !btn.disabled && btn.offsetParent !== null) {
      console.log('QuantumHire AI: Clicking button by text:', text);
      btn.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await new Promise(r => setTimeout(r, 300));
      btn.click();
      showToast('🎉 Application submitted!', 'success');
      return { success: true, message: 'Application submitted' };
    }
  }
  
  return { success: false, message: 'Submit button not found' };
}

// ============= FULL SMART APPLY WORKFLOW =============

async function runSmartApplyWorkflow(options = {}) {
  const { 
    autoNavigate = true, 
    autoSubmit = false, 
    maxPages = 10 
  } = options;
  
  console.log('QuantumHire AI: Starting Smart Apply workflow...', options);
  
  let currentPage = 0;
  let completed = false;
  
  while (!completed && currentPage < maxPages && !automationState.shouldQuit) {
    currentPage++;
    console.log(`QuantumHire AI: Processing page ${currentPage}...`);
    
    // Wait for page to stabilize
    await new Promise(r => setTimeout(r, 1500));
    
    // Check if this is the final page
    const isFinal = isFinalPage();
    
    if (isFinal) {
      console.log('QuantumHire AI: Final page detected');
      
      if (autoSubmit) {
        // Auto-submit the application
        const submitResult = await autoSubmitApplication();
        completed = submitResult.success;
        
        if (completed) {
          return { success: true, message: 'Application submitted successfully!', pagesProcessed: currentPage };
        }
      } else {
        // Just notify user
        showToast('🎉 Application ready! Click Submit when ready.', 'success');
        return { success: true, message: 'Application ready to submit', pagesProcessed: currentPage, needsManualSubmit: true };
      }
    }
    
    // If not final and autoNavigate is enabled, go to next page
    if (!isFinal && autoNavigate) {
      const pageComplete = isPageComplete();
      
      if (pageComplete.complete) {
        const navigated = await navigateToNextPage();
        
        if (navigated) {
          showToast(`✅ Page ${currentPage} complete - moving to next`, 'success');
          // Wait for next page to load
          await new Promise(r => setTimeout(r, 2000));
        } else {
          // Can't find next button, might be final page
          console.log('QuantumHire AI: No next button found, checking if final...');
          
          if (isFinalPage()) {
            if (autoSubmit) {
              const submitResult = await autoSubmitApplication();
              completed = submitResult.success;
            }
          }
          
          return { success: true, message: 'Completed available pages', pagesProcessed: currentPage };
        }
      } else {
        // Page not complete, return for user review
        showToast(`⚠️ Page ${currentPage} needs attention - ${pageComplete.totalIssues} fields need input`, 'warning');
        return { success: false, message: 'Some fields need manual input', pagesProcessed: currentPage, incomplete: pageComplete };
      }
    } else if (!autoNavigate) {
      // Not auto-navigating, just complete this page
      return { success: true, message: 'Page processed', pagesProcessed: currentPage };
    }
  }
  
  return { success: completed, message: completed ? 'Workflow complete' : 'Max pages reached', pagesProcessed: currentPage };
}

// ============= MAIN AUTOFILL FUNCTION =============

async function autofillForm(tailoredData = null, atsCredentials = null, options = {}) {
  console.log('QuantumHire AI: Starting autofill...', options);
  
  const platform = detectPlatform();
  applicationState.platform = platform.name;
  applicationState.status = 'in_progress';
  applicationState.startTime = applicationState.startTime || Date.now();
  
  if (tailoredData) applicationState.tailoredData = tailoredData;
  
  // Handle login page
  if (detectLoginPage() && atsCredentials) {
    const loginFilled = await fillLoginFields(atsCredentials);
    if (loginFilled > 0) {
      const signInBtn = document.querySelector('button[type="submit"], input[type="submit"]');
      if (signInBtn) setTimeout(() => signInBtn.click(), 500);
      return { success: true, status: 'login_filled', fields: loginFilled, message: `Filled ${loginFilled} login fields` };
    }
  }
  
  // Get user profile + access token
  const data = await chrome.storage.local.get(['userProfile', 'accessToken']);
  const profile = data.userProfile;
  if (!profile) return { success: false, message: 'No profile found. Please connect your account.' };
  
  const results = { fields: 0, questions: 0, files: 0, resumeUploaded: false, coverUploaded: false };
  const jobData = extractJobDetails();
  
  // Step 1: Fill basic fields
  const fieldValues = {
    firstName: profile.first_name,
    lastName: profile.last_name,
    fullName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
    email: profile.email,
    phone: profile.phone,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    zipCode: profile.zip_code,
    country: profile.country,
    linkedin: profile.linkedin,
    github: profile.github,
    portfolio: profile.portfolio
  };
  
  for (const [fieldType, value] of Object.entries(fieldValues)) {
    if (!value) continue;
    const field = findField(fieldType, platform.config);
    if (field && fillField(field, value)) {
      field.classList.add('quantumhire-filled');
      results.fields++;
    }
  }
  
  // Step 2: Detect questions and get AI answers for unfilled ones
  const questions = detectAllQuestions();
  let aiAnswers = {};
  
  // First pass: identify questions that need AI answers (not matched by knockout patterns)
  const questionsNeedingAI = [];
  for (const q of questions) {
    const knockoutMatch = matchKnockoutQuestion(q.label, profile);
    if (!knockoutMatch) {
      questionsNeedingAI.push(q);
    }
  }
  
  // If we have questions that need AI and have access token, call the backend
  if (questionsNeedingAI.length > 0 && data.accessToken) {
    console.log(`QuantumHire AI: ${questionsNeedingAI.length} questions need AI answers`);
    showToast(`🤖 Generating AI answers for ${questionsNeedingAI.length} questions...`, 'info');
    
    try {
      const questionsForAI = questionsNeedingAI.map((q, i) => ({
        id: q.id || `q_${i}`,
        label: q.label,
        type: q.type,
        options: q.type === 'select' ? Array.from(q.element?.options || []).map(o => o.text).filter(t => t) : undefined,
        required: q.element?.required || q.element?.getAttribute('aria-required') === 'true' || false
      }));
      
      const aiResponse = await fetch(`${SUPABASE_URL}/functions/v1/answer-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${data.accessToken}`
        },
        body: JSON.stringify({
          questions: questionsForAI,
          jobTitle: jobData.title || 'Position',
          company: jobData.company || 'Company',
          jobDescription: jobData.description || '',
          userProfile: {
            firstName: profile.first_name,
            lastName: profile.last_name,
            email: profile.email,
            phone: profile.phone,
            skills: profile.skills || [],
            workExperience: profile.work_experience || [],
            education: profile.education || [],
            certifications: profile.certifications || [],
            city: profile.city,
            state: profile.state,
            country: profile.country,
            citizenship: profile.citizenship,
            willingToRelocate: profile.willing_to_relocate,
            visaRequired: profile.visa_required,
            veteranStatus: profile.veteran_status,
            disability: profile.disability,
            raceEthnicity: profile.race_ethnicity,
            gender: profile.gender,
            hispanicLatino: profile.hispanic_latino,
            drivingLicense: profile.driving_license,
            securityClearance: profile.security_clearance,
            expectedSalary: profile.expected_salary,
            currentSalary: profile.current_salary,
            noticePeriod: profile.notice_period,
            totalExperience: profile.total_experience,
            linkedin: profile.linkedin,
            github: profile.github,
            portfolio: profile.portfolio,
            highestEducation: profile.highest_education,
            languages: profile.languages || [],
            achievements: profile.achievements || []
          }
        })
      });
      
      if (aiResponse.ok) {
        const aiResult = await aiResponse.json();
        if (aiResult.answers) {
          aiResult.answers.forEach(a => {
            aiAnswers[a.id] = {
              answer: a.answer,
              selectValue: a.selectValue,
              confidence: a.confidence,
              atsScore: a.atsScore,
              needsReview: a.needsReview,
              reasoning: a.reasoning
            };
          });
          console.log(`QuantumHire AI: Received ${Object.keys(aiAnswers).length} AI answers`);
          showToast(`✅ AI generated ${Object.keys(aiAnswers).length} answers`, 'success');
        }
      } else {
        const errorText = await aiResponse.text();
        console.error('QuantumHire AI: AI answer error:', aiResponse.status, errorText);
        if (aiResponse.status === 400 && errorText.includes('API key')) {
          showToast('⚠️ OpenAI API key required - add in Profile settings', 'warning');
        }
      }
    } catch (aiError) {
      console.error('QuantumHire AI: AI request error:', aiError);
    }
  }
  
  // Step 2b: Fill all questions with AI answers included
  const questionResults = await fillAllQuestions(profile, jobData, aiAnswers);
  results.questions = questionResults.filledCount;
  
  // Step 3: Handle file uploads - detect button-based AND input-based upload sections
  // Generate PDFs if we have tailored data
  let resumePdfResult = null;
  let coverPdfResult = null;
  
  if (tailoredData?.tailoredResume || tailoredData?.resumePdf) {
    if (tailoredData.resumePdf?.success) {
      resumePdfResult = tailoredData.resumePdf;
    } else {
      resumePdfResult = await generatePDF('resume', profile, jobData, tailoredData);
    }
  }
  
  if (tailoredData?.tailoredCoverLetter || tailoredData?.coverPdf) {
    if (tailoredData.coverPdf?.success) {
      coverPdfResult = tailoredData.coverPdf;
    } else {
      coverPdfResult = await generatePDF('cover_letter', profile, jobData, tailoredData);
    }
  }
  
  // Use the new comprehensive upload function that handles:
  // 1. Button-based uploads ("Attach" buttons like Greenhouse)
  // 2. Standard file input uploads
  // 3. Automatic detection of resume vs cover letter sections
  if (resumePdfResult?.success || coverPdfResult?.success) {
    console.log('QuantumHire AI: Uploading generated PDFs...');
    const uploadResults = await uploadPDFsToAllSections(resumePdfResult, coverPdfResult);
    results.files = uploadResults.filesUploaded;
    results.resumeUploaded = uploadResults.resumeUploaded;
    results.coverUploaded = uploadResults.coverUploaded;
    
    if (uploadResults.filesUploaded > 0) {
      showToast(`📄 ${uploadResults.filesUploaded} PDF(s) attached`, 'success');
    }
  }
  
  results.resumePdf = resumePdfResult;
  results.coverPdf = coverPdfResult;
  
  // Step 4: Check page completion
  const pageStatus = isPageComplete();
  
  const totalFilled = results.fields + results.questions + results.files;
  let message = `Filled: ${results.fields} fields, ${results.questions} questions`;
  if (results.files > 0) message += `, ${results.files} files uploaded`;
  
  if (pageStatus.complete) {
    message += ' ✅ Page complete!';
  } else {
    message += ` | ${pageStatus.totalIssues} items need attention`;
  }
  
  return {
    success: totalFilled > 0,
    status: pageStatus.complete ? 'page_complete' : 'in_progress',
    ...results,
    pageComplete: pageStatus.complete,
    platform: platform.name,
    message
  };
}

async function fillLoginFields(credentials) {
  let filled = 0;
  
  const emailSelectors = ['input[type="email"]', 'input[name*="email"]', 'input[id*="email"]', 'input[name*="username"]', 'input[id*="username"]'];
  const passwordSelectors = ['input[type="password"]'];
  
  for (const sel of emailSelectors) {
    const field = document.querySelector(sel);
    if (field && !field.value && credentials.email) {
      if (fillField(field, credentials.email)) filled++;
      break;
    }
  }
  
  for (const sel of passwordSelectors) {
    const field = document.querySelector(sel);
    if (field && !field.value && credentials.password) {
      if (fillField(field, credentials.password)) filled++;
      break;
    }
  }
  
  return filled;
}

function findLabelForInput(input) {
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.innerText;
  }
  let parent = input.parentElement;
  for (let i = 0; i < 5 && parent; i++) {
    const label = parent.querySelector('label');
    if (label) return label.innerText;
    parent = parent.parentElement;
  }
  return '';
}

// ============= HELPER FUNCTIONS =============

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============= TOAST NOTIFICATIONS =============

function showToast(message, type = 'success') {
  const existing = document.querySelector('.quantumhire-toast');
  if (existing) existing.remove();
  
  const iconMap = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  
  const toast = document.createElement('div');
  toast.className = `quantumhire-toast ${type}`;
  toast.innerHTML = `
    <span class="quantumhire-toast-icon">${iconMap[type] || 'ℹ️'}</span>
    <span class="quantumhire-toast-message">${message}</span>
    <button class="quantumhire-toast-close">×</button>
  `;
  
  toast.querySelector('.quantumhire-toast-close').addEventListener('click', () => toast.remove());
  document.body.appendChild(toast);
  
  if (type !== 'warning') setTimeout(() => toast.remove(), 5000);
}

// ============= FLOATING PANEL (Streamlined UI) =============

function createFloatingPanel() {
  if (document.getElementById('quantumhire-panel')) return;
  
  const platform = detectPlatform();
  const jobData = extractJobDetails();
  
  const panel = document.createElement('div');
  panel.id = 'quantumhire-panel';
  panel.innerHTML = `
    <div class="qh-header">
      <div class="qh-brand">
        <span class="qh-logo">⚡</span>
        <span class="qh-title">QuantumHire AI</span>
      </div>
      <div class="qh-controls">
        <span class="qh-platform-badge">${platform.name.toUpperCase()}</span>
        <button class="qh-minimize">−</button>
      </div>
    </div>
    <div class="qh-body">
      <div class="qh-job-info">
        <div class="qh-job-title">${jobData.title}</div>
        <div class="qh-job-company">${jobData.company}</div>
        ${jobData.location ? `<div class="qh-job-location">📍 ${jobData.location}</div>` : ''}
      </div>
      
      <!-- Speed & Control Row -->
      <div class="qh-automation-controls">
        <div class="qh-speed-row">
          <span class="qh-speed-label">Speed:</span>
          <div class="qh-speed-buttons">
            <button class="qh-speed-btn active" data-speed="1">1x</button>
            <button class="qh-speed-btn" data-speed="1.5">1.5x</button>
            <button class="qh-speed-btn" data-speed="2">2x</button>
            <button class="qh-speed-btn" data-speed="3">3x</button>
          </div>
        </div>
        <div class="qh-control-row">
          <button class="qh-control-btn pause" id="qh-pause-btn">
            <span>⏸️</span> Pause
          </button>
          <button class="qh-control-btn skip" id="qh-skip-btn">
            <span>⏭️</span> Skip
          </button>
          <button class="qh-control-btn quit" id="qh-quit-btn">
            <span>⏹️</span> Quit
          </button>
        </div>
      </div>
      
<div class="qh-status" id="qh-status">
        <span class="qh-status-icon">🟢</span>
        <span class="qh-status-text">Ready to apply</span>
      </div>
      
      <!-- Question Review Panel (auto-applies, no manual approval needed) -->
      <div class="qh-review-panel hidden" id="qh-review-panel">
        <div class="qh-review-header">
          <span class="qh-review-title">📋 Questions Filled</span>
          <div class="qh-ats-score-badge" id="qh-ats-score-badge">ATS: --</div>
        </div>
        <div class="qh-review-summary" id="qh-review-summary">
          <span class="qh-review-stat">✅ <span id="qh-auto-filled">0</span> Auto-filled</span>
          <span class="qh-review-stat">⚠️ <span id="qh-needs-review">0</span> Review</span>
          <span class="qh-review-stat">❓ <span id="qh-unfamiliar">0</span> Manual</span>
        </div>
        <div class="qh-review-list" id="qh-review-list" style="max-height: 150px;"></div>
      </div>
      
      <div class="qh-actions">
        <button id="qh-smart-apply" class="qh-btn primary">
          <span class="qh-btn-icon">⚡</span>
          <div class="qh-btn-content">
            <span class="qh-btn-title">Smart Apply</span>
            <span class="qh-btn-subtitle">📄 Tailor CV → 📎 Attach PDFs → 📝 Fill → ➡️ Next</span>
          </div>
        </button>
        
        <div class="qh-smart-apply-steps hidden" id="qh-smart-apply-steps">
          <div class="qh-step-indicator">
            <div class="qh-step" data-step="1"><span class="qh-step-num">1</span><span class="qh-step-label">📄 Tailor</span></div>
            <div class="qh-step" data-step="2"><span class="qh-step-num">2</span><span class="qh-step-label">📎 Attach</span></div>
            <div class="qh-step" data-step="3"><span class="qh-step-num">3</span><span class="qh-step-label">📝 Fill</span></div>
            <div class="qh-step" data-step="4"><span class="qh-step-num">4</span><span class="qh-step-label">➡️ Next</span></div>
          </div>
        </div>
        
        <div class="qh-btn-row">
          <button id="qh-review-questions" class="qh-btn secondary">🔍 Review Questions</button>
          <button id="qh-quick-fill" class="qh-btn secondary">📝 Quick Fill</button>
        </div>
        <div class="qh-btn-row">
          <button id="qh-next-page" class="qh-btn secondary">➡️ Next Page</button>
        </div>
      </div>
      
      <div class="qh-results hidden" id="qh-results">
        <div class="qh-match-score">
          <span class="qh-score-label">ATS Match</span>
          <span class="qh-score-value" id="qh-score">0%</span>
        </div>
        
        <div class="qh-pdf-preview" id="qh-pdf-preview">
          <div class="qh-pdf-header">
            <span>📄 Generated Documents</span>
          </div>
          <div class="qh-pdf-cards">
            <div class="qh-pdf-card" id="qh-resume-pdf-card">
              <div class="qh-pdf-icon">📄</div>
              <div class="qh-pdf-info">
                <div class="qh-pdf-name" id="qh-resume-pdf-name">Resume.pdf</div>
                <div class="qh-pdf-size" id="qh-resume-pdf-size">-</div>
              </div>
              <button class="qh-pdf-download-btn" data-type="resume" title="Download">⬇️</button>
            </div>
            <div class="qh-pdf-card" id="qh-cover-pdf-card">
              <div class="qh-pdf-icon">📝</div>
              <div class="qh-pdf-info">
                <div class="qh-pdf-name" id="qh-cover-pdf-name">CoverLetter.pdf</div>
                <div class="qh-pdf-size" id="qh-cover-pdf-size">-</div>
              </div>
              <button class="qh-pdf-download-btn" data-type="cover" title="Download">⬇️</button>
            </div>
          </div>
        </div>
        
        <div class="qh-tabs">
          <button class="qh-tab active" data-tab="resume">Resume</button>
          <button class="qh-tab" data-tab="cover">Cover Letter</button>
        </div>
        <div class="qh-tab-content" id="qh-resume-tab">
          <textarea id="qh-resume" readonly placeholder="Tailored resume text will appear here..."></textarea>
          <button class="qh-copy-btn" data-target="qh-resume">📋 Copy</button>
        </div>
        <div class="qh-tab-content hidden" id="qh-cover-tab">
          <textarea id="qh-cover" readonly placeholder="Tailored cover letter will appear here..."></textarea>
          <button class="qh-copy-btn" data-target="qh-cover">📋 Copy</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(panel);
  addPanelStyles();
  setupPanelEvents(panel);
  
  panel.dataset.job = JSON.stringify(jobData);
  panel.dataset.resumePdf = '';
  panel.dataset.coverPdf = '';
}

function addPanelStyles() {
  if (document.getElementById('quantumhire-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'quantumhire-styles';
  style.textContent = `
    /* Theme tokens (HSL so it adapts cleanly in dark/light) */
    #quantumhire-panel {
      --qh-bg-0: 222 47% 11%;
      --qh-bg-1: 222 47% 16%;
      --qh-card: 222 47% 18%;
      --qh-card-2: 222 47% 14%;
      --qh-border: 215 28% 17%;
      --qh-text: 213 31% 91%;
      --qh-muted: 215 20% 65%;
      --qh-muted-2: 215 25% 45%;
      --qh-brand: 158 64% 42%;
      --qh-brand-2: 160 84% 63%;
      --qh-info: 217 91% 60%;
      --qh-warn: 45 93% 58%;
      --qh-danger: 0 84% 60%;
      --qh-violet: 239 84% 67%;
      --qh-shadow: 0 0% 0%;
    }

    @media (prefers-color-scheme: light) {
      #quantumhire-panel {
        --qh-bg-0: 210 40% 98%;
        --qh-bg-1: 210 35% 96%;
        --qh-card: 0 0% 100%;
        --qh-card-2: 210 40% 98%;
        --qh-border: 214 32% 91%;
        --qh-text: 222 47% 11%;
        --qh-muted: 215 16% 40%;
        --qh-muted-2: 215 16% 55%;
        --qh-shadow: 222 47% 11%;
      }
    }

    #quantumhire-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 380px;
      max-height: 85vh;
      background: linear-gradient(145deg, hsl(var(--qh-bg-0)) 0%, hsl(var(--qh-bg-1)) 100%);
      border-radius: 18px;
      box-shadow: 0 25px 80px hsl(var(--qh-shadow) / 0.35), 0 0 0 1px hsl(var(--qh-border) / 0.9);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: hsl(var(--qh-text));
      overflow: hidden;
      backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
    }
    
    #quantumhire-panel.minimized {
      max-height: 52px;
    }
    
    #quantumhire-panel.minimized .qh-body {
      display: none;
    }

    .qh-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: hsl(var(--qh-card-2) / 0.7); border-bottom: 1px solid hsl(var(--qh-border) / 0.8); }
    .qh-brand { display: flex; align-items: center; gap: 10px; }
    .qh-logo { font-size: 20px; }
    .qh-title { font-weight: 800; font-size: 15px; background: linear-gradient(135deg, hsl(var(--qh-brand)) 0%, hsl(var(--qh-brand-2)) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .qh-controls { display: flex; align-items: center; gap: 10px; }
    .qh-platform-badge { font-size: 10px; font-weight: 800; padding: 4px 10px; background: hsl(var(--qh-violet) / 0.12); border: 1px solid hsl(var(--qh-violet) / 0.22); border-radius: 999px; color: hsl(var(--qh-violet)); }
    .qh-minimize { background: transparent; border: none; color: hsl(var(--qh-muted)); font-size: 22px; cursor: pointer; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .qh-minimize:hover { background: hsl(var(--qh-border) / 0.5); color: hsl(var(--qh-text)); }

    .qh-body { padding: 16px; overflow-y: auto; flex: 1; }

    .qh-job-info { background: linear-gradient(135deg, hsl(var(--qh-violet) / 0.10) 0%, hsl(var(--qh-violet) / 0.06) 100%); border: 1px solid hsl(var(--qh-violet) / 0.18); border-radius: 14px; padding: 14px; margin-bottom: 14px; }
    .qh-job-title { font-weight: 700; font-size: 15px; color: hsl(var(--qh-text)); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .qh-job-company { font-size: 13px; color: hsl(var(--qh-muted)); font-weight: 500; }
    .qh-job-location { font-size: 11px; color: hsl(var(--qh-muted-2)); margin-top: 6px; }

    .qh-automation-controls { background: hsl(var(--qh-card-2) / 0.55); border: 1px solid hsl(var(--qh-border) / 0.8); border-radius: 12px; padding: 12px; margin-bottom: 12px; }
    .qh-speed-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .qh-speed-label { font-size: 12px; color: hsl(var(--qh-muted-2)); font-weight: 600; }
    .qh-speed-buttons { display: flex; gap: 5px; }
    .qh-speed-btn { padding: 5px 12px; background: hsl(var(--qh-border) / 0.35); border: 1px solid hsl(var(--qh-border) / 0.9); border-radius: 999px; color: hsl(var(--qh-muted)); font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.15s ease; }
    .qh-speed-btn:hover { background: hsl(var(--qh-border) / 0.55); color: hsl(var(--qh-text)); }
    .qh-speed-btn.active { background: hsl(var(--qh-violet) / 0.14); border-color: hsl(var(--qh-violet) / 0.28); color: hsl(var(--qh-violet)); }

    .qh-control-row { display: flex; gap: 6px; }
    .qh-control-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 10px 12px; border: 1px solid hsl(var(--qh-border) / 0.8); border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer; background: hsl(var(--qh-card) / 0.35); color: hsl(var(--qh-text)); transition: all 0.15s ease; }
    .qh-control-btn:hover { transform: translateY(-2px); background: hsl(var(--qh-card) / 0.55); box-shadow: 0 4px 12px hsl(var(--qh-shadow) / 0.2); }
    .qh-control-btn:active { transform: translateY(0); }
    .qh-control-btn.pause { border-color: hsl(var(--qh-warn) / 0.45); color: hsl(var(--qh-warn)); background: hsl(var(--qh-warn) / 0.08); }
    .qh-control-btn.pause:hover { background: hsl(var(--qh-warn) / 0.15); border-color: hsl(var(--qh-warn) / 0.55); }
    .qh-control-btn.pause.paused { border-color: hsl(var(--qh-brand) / 0.45); color: hsl(var(--qh-brand)); background: hsl(var(--qh-brand) / 0.12); }
    .qh-control-btn.pause.paused:hover { background: hsl(var(--qh-brand) / 0.20); }
    .qh-control-btn.skip { border-color: hsl(var(--qh-info) / 0.35); color: hsl(var(--qh-info)); background: hsl(var(--qh-info) / 0.06); }
    .qh-control-btn.skip:hover { background: hsl(var(--qh-info) / 0.12); border-color: hsl(var(--qh-info) / 0.45); }
    .qh-control-btn.quit { border-color: hsl(var(--qh-danger) / 0.40); color: hsl(var(--qh-danger)); background: hsl(var(--qh-danger) / 0.08); }
    .qh-control-btn.quit:hover { background: hsl(var(--qh-danger) / 0.15); border-color: hsl(var(--qh-danger) / 0.55); }

    .qh-status { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: hsl(var(--qh-brand) / 0.10); border: 1px solid hsl(var(--qh-brand) / 0.18); border-radius: 12px; margin-bottom: 14px; font-size: 12px; font-weight: 500; }
    .qh-status-icon { font-size: 12px; }

    .qh-actions { display: flex; flex-direction: column; gap: 10px; }
    .qh-btn { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid hsl(var(--qh-border) / 0.75); border-radius: 14px; font-size: 13px; font-weight: 600; cursor: pointer; transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease; background: hsl(var(--qh-card) / 0.25); color: hsl(var(--qh-text)); }
    .qh-btn.primary { background: linear-gradient(135deg, hsl(var(--qh-brand)) 0%, hsl(var(--qh-brand-2)) 100%); color: hsl(var(--qh-bg-0)); border-color: transparent; box-shadow: 0 10px 30px hsl(var(--qh-brand) / 0.22); }
    .qh-btn.primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 40px hsl(var(--qh-brand) / 0.30); }
    .qh-btn.secondary { justify-content: center; font-size: 12px; color: hsl(var(--qh-muted)); padding: 10px 14px; }
    .qh-btn.secondary:hover { background: hsl(var(--qh-card) / 0.40); color: hsl(var(--qh-text)); transform: translateY(-1px); }
    .qh-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; }
    .qh-btn-row { display: flex; gap: 8px; }
    .qh-btn-content { display: flex; flex-direction: column; align-items: flex-start; }
    .qh-btn-title { font-weight: 800; font-size: 14px; }
    .qh-btn-subtitle { font-size: 10px; opacity: 0.85; }

    .qh-results { margin-top: 12px; padding-top: 12px; border-top: 1px solid hsl(var(--qh-border) / 0.8); }
    .qh-results.hidden { display: none; }

    .qh-match-score { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: linear-gradient(135deg, hsl(var(--qh-brand) / 0.16) 0%, hsl(var(--qh-brand) / 0.06) 100%); border: 1px solid hsl(var(--qh-brand) / 0.18); border-radius: 12px; margin-bottom: 10px; }
    .qh-score-label { font-size: 11px; color: hsl(var(--qh-muted-2)); }
    .qh-score-value { font-size: 20px; font-weight: 900; color: hsl(var(--qh-brand)); }

    .qh-pdf-preview { background: hsl(var(--qh-card-2) / 0.55); border: 1px solid hsl(var(--qh-border) / 0.8); border-radius: 14px; padding: 12px; margin-bottom: 12px; }
    .qh-pdf-header { font-size: 12px; font-weight: 800; color: hsl(var(--qh-violet)); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
    .qh-pdf-preview-btn { padding: 4px 8px; background: hsl(var(--qh-violet) / 0.12); border: 1px solid hsl(var(--qh-violet) / 0.22); border-radius: 6px; cursor: pointer; font-size: 10px; font-weight: 600; color: hsl(var(--qh-violet)); }
    .qh-pdf-preview-btn:hover { background: hsl(var(--qh-violet) / 0.22); }
    .qh-pdf-cards { display: flex; flex-direction: column; gap: 8px; }
    .qh-pdf-card { display: flex; align-items: center; gap: 10px; padding: 10px; background: hsl(var(--qh-card) / 0.25); border: 1px solid hsl(var(--qh-border) / 0.8); border-radius: 12px; transition: all 0.15s ease; }
    .qh-pdf-card:hover { background: hsl(var(--qh-card) / 0.4); }
    .qh-pdf-card.uploaded { border-color: hsl(var(--qh-brand) / 0.35); background: hsl(var(--qh-brand) / 0.10); }
    .qh-pdf-icon { font-size: 18px; }
    .qh-pdf-info { flex: 1; }
    .qh-pdf-name { font-size: 11px; font-weight: 700; color: hsl(var(--qh-text)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
    .qh-pdf-size { font-size: 10px; color: hsl(var(--qh-muted-2)); margin-top: 2px; }
    .qh-pdf-actions { display: flex; gap: 4px; }
    .qh-pdf-action-btn { padding: 6px 8px; background: hsl(var(--qh-card) / 0.35); border: 1px solid hsl(var(--qh-border) / 0.8); border-radius: 8px; cursor: pointer; font-size: 12px; color: hsl(var(--qh-text)); transition: all 0.12s ease; }
    .qh-pdf-action-btn:hover { background: hsl(var(--qh-violet) / 0.12); border-color: hsl(var(--qh-violet) / 0.22); }
    .qh-pdf-download-btn { padding: 6px 8px; background: hsl(var(--qh-card) / 0.35); border: 1px solid hsl(var(--qh-border) / 0.8); border-radius: 8px; cursor: pointer; font-size: 12px; color: hsl(var(--qh-text)); }
    .qh-pdf-download-btn:hover { background: hsl(var(--qh-violet) / 0.12); border-color: hsl(var(--qh-violet) / 0.22); }

    /* PDF Preview Modal */
    .qh-pdf-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90vw; max-width: 900px; height: 80vh; background: hsl(var(--qh-bg-0)); border: 1px solid hsl(var(--qh-border)); border-radius: 16px; z-index: 2147483648; display: flex; flex-direction: column; box-shadow: 0 30px 100px hsl(var(--qh-shadow) / 0.5); }
    .qh-pdf-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid hsl(var(--qh-border)); }
    .qh-pdf-modal-title { font-size: 16px; font-weight: 800; color: hsl(var(--qh-text)); }
    .qh-pdf-modal-tabs { display: flex; gap: 8px; }
    .qh-pdf-modal-tab { padding: 8px 16px; background: hsl(var(--qh-card) / 0.25); border: 1px solid hsl(var(--qh-border)); border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; color: hsl(var(--qh-muted)); }
    .qh-pdf-modal-tab.active { background: hsl(var(--qh-violet) / 0.12); border-color: hsl(var(--qh-violet) / 0.25); color: hsl(var(--qh-violet)); }
    .qh-pdf-modal-close { padding: 8px; background: transparent; border: none; cursor: pointer; font-size: 20px; color: hsl(var(--qh-muted)); border-radius: 8px; }
    .qh-pdf-modal-close:hover { background: hsl(var(--qh-border) / 0.5); color: hsl(var(--qh-text)); }
    .qh-pdf-modal-body { flex: 1; display: flex; overflow: hidden; }
    .qh-pdf-modal-content { flex: 1; padding: 20px; overflow: auto; }
    .qh-pdf-modal-content.hidden { display: none; }
    .qh-pdf-modal-iframe { width: 100%; height: 100%; border: none; border-radius: 8px; background: white; }
    .qh-pdf-modal-text { width: 100%; height: 100%; background: hsl(var(--qh-card-2)); border: 1px solid hsl(var(--qh-border)); border-radius: 12px; padding: 16px; color: hsl(var(--qh-text)); font-size: 12px; font-family: inherit; resize: none; line-height: 1.6; }
    .qh-pdf-modal-footer { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-top: 1px solid hsl(var(--qh-border)); }
    .qh-pdf-modal-footer-left { display: flex; gap: 8px; }
    .qh-pdf-modal-footer-right { display: flex; gap: 8px; }

    .qh-tabs { display: flex; gap: 4px; margin-bottom: 8px; }
    .qh-tab { flex: 1; padding: 6px 10px; background: hsl(var(--qh-card) / 0.20); border: 1px solid hsl(var(--qh-border) / 0.75); color: hsl(var(--qh-muted)); border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer; }
    .qh-tab:hover { background: hsl(var(--qh-card) / 0.35); color: hsl(var(--qh-text)); }
    .qh-tab.active { background: hsl(var(--qh-brand) / 0.12); border-color: hsl(var(--qh-brand) / 0.22); color: hsl(var(--qh-brand)); }
    .qh-tab-content { position: relative; }
    .qh-tab-content.hidden { display: none; }
    .qh-tab-content textarea { width: 100%; height: 100px; background: hsl(var(--qh-card-2) / 0.55); border: 1px solid hsl(var(--qh-border) / 0.85); border-radius: 12px; padding: 8px; color: hsl(var(--qh-text)); font-size: 10px; font-family: inherit; resize: none; }
.qh-copy-btn { width: 100%; margin-top: 6px; padding: 8px; background: hsl(var(--qh-card) / 0.25); border: 1px solid hsl(var(--qh-border) / 0.75); border-radius: 10px; color: hsl(var(--qh-text)); font-size: 10px; cursor: pointer; }
    .qh-copy-btn:hover { background: hsl(var(--qh-card) / 0.40); }

    /* Smart Apply Step Indicator */
    .qh-smart-apply-steps { margin: 10px 0; padding: 8px 12px; background: hsl(var(--qh-card-2) / 0.55); border: 1px solid hsl(var(--qh-border) / 0.8); border-radius: 10px; }
    .qh-smart-apply-steps.hidden { display: none; }
    .qh-step-indicator { display: flex; justify-content: space-between; align-items: center; }
    .qh-step { display: flex; align-items: center; gap: 6px; opacity: 0.5; transition: opacity 0.2s, transform 0.2s; }
    .qh-step.active { opacity: 1; transform: scale(1.05); }
    .qh-step.completed { opacity: 0.8; }
    .qh-step.completed .qh-step-num { background: hsl(var(--qh-brand)); color: hsl(var(--qh-bg-0)); }
    .qh-step-num { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; background: hsl(var(--qh-border) / 0.5); border-radius: 50%; font-size: 10px; font-weight: 800; color: hsl(var(--qh-muted)); }
    .qh-step.active .qh-step-num { background: hsl(var(--qh-violet)); color: white; animation: pulse 1.5s infinite; }
    .qh-step-label { font-size: 10px; font-weight: 600; color: hsl(var(--qh-muted)); }
    .qh-step.active .qh-step-label { color: hsl(var(--qh-text)); }
    @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 hsl(var(--qh-violet) / 0.4); } 50% { box-shadow: 0 0 0 6px hsl(var(--qh-violet) / 0); } }

    /* Question Review Panel Styles */
    .qh-review-panel { background: hsl(var(--qh-card-2) / 0.65); border: 1px solid hsl(var(--qh-border) / 0.85); border-radius: 12px; padding: 12px; margin-bottom: 12px; }
    .qh-review-panel.hidden { display: none; }
    .qh-review-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .qh-review-title { font-size: 12px; font-weight: 800; color: hsl(var(--qh-violet)); }
    .qh-ats-score-badge { font-size: 10px; font-weight: 800; padding: 4px 10px; background: hsl(var(--qh-brand) / 0.15); border: 1px solid hsl(var(--qh-brand) / 0.25); border-radius: 999px; color: hsl(var(--qh-brand)); }
    .qh-review-summary { display: flex; gap: 10px; margin-bottom: 10px; padding: 8px; background: hsl(var(--qh-card) / 0.25); border-radius: 8px; }
    .qh-review-stat { font-size: 10px; color: hsl(var(--qh-muted)); }
    .qh-review-list { max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    .qh-review-item { display: flex; flex-direction: column; gap: 4px; padding: 8px; background: hsl(var(--qh-card) / 0.25); border: 1px solid hsl(var(--qh-border) / 0.8); border-radius: 8px; cursor: pointer; transition: background 0.15s; }
    .qh-review-item:hover { background: hsl(var(--qh-card) / 0.4); }
    .qh-review-item.needs-review { border-left: 3px solid hsl(var(--qh-warn)); }
    .qh-review-item.unfamiliar { border-left: 3px solid hsl(var(--qh-danger)); }
    .qh-review-item.approved { border-left: 3px solid hsl(var(--qh-brand)); }
    .qh-review-item.na-response { border-left: 3px solid hsl(var(--qh-muted)); background: hsl(var(--qh-card) / 0.15); }
    .qh-review-question { font-size: 10px; font-weight: 600; color: hsl(var(--qh-text)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .qh-review-answer { display: flex; align-items: center; gap: 6px; }
    .qh-review-answer-text { font-size: 9px; color: hsl(var(--qh-muted)); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .qh-review-answer-edit { font-size: 8px; padding: 3px 6px; background: hsl(var(--qh-violet) / 0.12); border: 1px solid hsl(var(--qh-violet) / 0.22); border-radius: 6px; color: hsl(var(--qh-violet)); cursor: pointer; }
    .qh-review-answer-edit:hover { background: hsl(var(--qh-violet) / 0.20); }
    .qh-review-reasoning { font-size: 8px; color: hsl(var(--qh-muted-2)); font-style: italic; }
    .qh-review-score { font-size: 8px; font-weight: 700; padding: 2px 6px; background: hsl(var(--qh-brand) / 0.12); border-radius: 4px; color: hsl(var(--qh-brand)); }
    .qh-review-actions { display: flex; gap: 6px; }
    .qh-review-actions .qh-btn { flex: 1; justify-content: center; padding: 8px 12px; font-size: 10px; }
    .qh-review-edit-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 320px; background: hsl(var(--qh-bg-0)); border: 1px solid hsl(var(--qh-border)); border-radius: 12px; padding: 16px; z-index: 2147483649; box-shadow: 0 25px 80px hsl(var(--qh-shadow) / 0.35); }
    .qh-review-edit-modal.hidden { display: none; }
    .qh-review-edit-question { font-size: 12px; font-weight: 600; color: hsl(var(--qh-text)); margin-bottom: 12px; }
    .qh-review-edit-input { width: 100%; padding: 10px; background: hsl(var(--qh-card-2) / 0.55); border: 1px solid hsl(var(--qh-border) / 0.85); border-radius: 8px; color: hsl(var(--qh-text)); font-size: 11px; margin-bottom: 12px; min-height: 80px; resize: vertical; }
    .qh-review-edit-input:focus { outline: none; border-color: hsl(var(--qh-brand) / 0.5); }
    .qh-review-edit-hint { font-size: 9px; color: hsl(var(--qh-muted-2)); margin-bottom: 12px; padding: 8px; background: hsl(var(--qh-info) / 0.1); border-radius: 6px; }
    .qh-review-edit-actions { display: flex; gap: 8px; }
    .qh-review-edit-actions .qh-btn { flex: 1; }
    .qh-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: hsl(0 0% 0% / 0.5); z-index: 2147483648; }
    .qh-overlay.hidden { display: none; }

    /* PDF Preview Modal */
    .qh-pdf-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90vw; max-width: 700px; max-height: 85vh; background: hsl(var(--qh-bg-0)); border: 1px solid hsl(var(--qh-border)); border-radius: 16px; z-index: 2147483649; box-shadow: 0 25px 80px hsl(var(--qh-shadow) / 0.35); display: flex; flex-direction: column; overflow: hidden; }
    .qh-pdf-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid hsl(var(--qh-border) / 0.8); background: hsl(var(--qh-card-2) / 0.55); }
    .qh-pdf-modal-title { font-size: 14px; font-weight: 700; color: hsl(var(--qh-text)); }
    .qh-pdf-modal-tabs { display: flex; gap: 8px; }
    .qh-pdf-modal-tab { padding: 6px 12px; font-size: 11px; font-weight: 600; background: hsl(var(--qh-card) / 0.25); border: 1px solid hsl(var(--qh-border) / 0.6); border-radius: 8px; color: hsl(var(--qh-muted)); cursor: pointer; transition: all 0.15s; }
    .qh-pdf-modal-tab:hover { background: hsl(var(--qh-card) / 0.4); }
    .qh-pdf-modal-tab.active { background: hsl(var(--qh-brand) / 0.15); border-color: hsl(var(--qh-brand) / 0.3); color: hsl(var(--qh-brand)); }
    .qh-pdf-modal-close { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: hsl(var(--qh-card) / 0.25); border: 1px solid hsl(var(--qh-border) / 0.6); border-radius: 8px; color: hsl(var(--qh-muted)); cursor: pointer; font-size: 16px; }
    .qh-pdf-modal-close:hover { background: hsl(var(--qh-danger) / 0.15); color: hsl(var(--qh-danger)); }
    .qh-pdf-modal-body { flex: 1; overflow: hidden; padding: 16px 20px; }
    .qh-pdf-modal-content { height: 100%; }
    .qh-pdf-modal-content.hidden { display: none; }
    .qh-pdf-text-preview { height: 100%; max-height: 50vh; overflow-y: auto; background: hsl(var(--qh-card-2) / 0.55); border: 1px solid hsl(var(--qh-border) / 0.8); border-radius: 10px; padding: 16px; }
    .qh-pdf-text-preview pre { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; line-height: 1.6; color: hsl(var(--qh-text)); white-space: pre-wrap; word-wrap: break-word; margin: 0; }
    .qh-pdf-modal-footer { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-top: 1px solid hsl(var(--qh-border) / 0.8); background: hsl(var(--qh-card-2) / 0.55); }
    .qh-pdf-modal-footer-left { flex: 1; }
    .qh-pdf-modal-footer-right { display: flex; gap: 10px; }


    .quantumhire-toast { position: fixed; bottom: 100px; right: 400px; padding: 12px 16px; background: linear-gradient(145deg, hsl(var(--qh-card)) 0%, hsl(var(--qh-card-2)) 100%); border-radius: 12px; display: flex; align-items: center; gap: 10px; z-index: 2147483646; box-shadow: 0 16px 44px hsl(var(--qh-shadow) / 0.20); animation: slideInUp 0.3s ease; max-width: 300px; border: 1px solid hsl(var(--qh-border) / 0.8); color: hsl(var(--qh-text)); pointer-events: auto; }
    .quantumhire-toast.success { border-left: 3px solid hsl(var(--qh-brand)); }
    .quantumhire-toast.error { border-left: 3px solid hsl(var(--qh-danger)); }
    .quantumhire-toast.warning { border-left: 3px solid hsl(var(--qh-warn)); }
    .quantumhire-toast.info { border-left: 3px solid hsl(var(--qh-info)); }
    .quantumhire-toast-message { color: hsl(var(--qh-text)); font-size: 12px; line-height: 1.4; }
    .quantumhire-toast-close { background: none; border: none; color: hsl(var(--qh-muted-2)); cursor: pointer; font-size: 16px; padding: 0 4px; margin-left: 8px; }
    .quantumhire-toast-close:hover { color: hsl(var(--qh-text)); }
    @keyframes slideInUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    .quantumhire-filled { box-shadow: 0 0 0 2px hsl(var(--qh-brand) / 0.55) !important; }
    #quantumhire-panel.minimized .qh-body { display: none; }
    
    /* Invalid job page styles */
    .qh-invalid-message { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px 16px; gap: 12px; }
    .qh-invalid-icon { font-size: 40px; opacity: 0.8; }
    .qh-invalid-text { font-size: 14px; font-weight: 600; color: hsl(var(--qh-warn)); line-height: 1.4; }
    .qh-invalid-action { display: flex; justify-content: center; padding: 12px; background: hsl(var(--qh-warn) / 0.1); border-top: 1px solid hsl(var(--qh-warn) / 0.2); }
    .qh-skip-indicator { font-size: 12px; color: hsl(var(--qh-muted)); animation: qh-pulse-text 1.5s ease-in-out infinite; }
    @keyframes qh-pulse-text { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
    
    /* Status variants */
    .qh-status.qh-status-error { background: hsl(var(--qh-danger) / 0.15) !important; border-color: hsl(var(--qh-danger) / 0.3) !important; }
    .qh-status.qh-status-warning { background: hsl(var(--qh-warn) / 0.15) !important; border-color: hsl(var(--qh-warn) / 0.3) !important; }
    .qh-status.qh-status-success { background: hsl(var(--qh-brand) / 0.15) !important; border-color: hsl(var(--qh-brand) / 0.3) !important; }
  `;
  document.head.appendChild(style);
}

function setupPanelEvents(panel) {
  // Minimize
  panel.querySelector('.qh-minimize').addEventListener('click', () => {
    panel.classList.toggle('minimized');
    panel.querySelector('.qh-minimize').textContent = panel.classList.contains('minimized') ? '+' : '−';
  });
  
  // Speed controls
  panel.querySelectorAll('.qh-speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.qh-speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      automationState.speed = parseFloat(btn.dataset.speed);
      showToast(`Speed: ${btn.dataset.speed}x`, 'info');
    });
  });
  
  // Pause/Resume button - using direct state manipulation for reliability
  const pauseBtn = panel.querySelector('#qh-pause-btn');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const isPaused = togglePause();
      this.innerHTML = isPaused ? '<span>▶️</span> Resume' : '<span>⏸️</span> Pause';
      this.classList.toggle('paused', isPaused);
      
      const statusEl = panel.querySelector('#qh-status');
      if (statusEl) {
        updateStatus(statusEl, isPaused ? '⏸️' : '🟢', isPaused ? 'Paused - click Resume to continue' : 'Running...');
      }
      
      showToast(isPaused ? '⏸️ Paused' : '▶️ Resumed', 'info');
    });
  }
  
  // Skip button
  const skipBtn = panel.querySelector('#qh-skip-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      skipCurrentStep();
      showToast('⏭️ Skipping current step...', 'info');
    });
  }
  
  // Quit/Stop button
  const quitBtn = panel.querySelector('#qh-quit-btn');
  if (quitBtn) {
    quitBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      stopAutomation();
      
      const statusEl = panel.querySelector('#qh-status');
      if (statusEl) {
        updateStatus(statusEl, '⏹️', 'Stopped');
      }
      
      // Reset button states
      const smartApplyBtn = panel.querySelector('#qh-smart-apply');
      if (smartApplyBtn) smartApplyBtn.disabled = false;
      
      const stepsContainer = panel.querySelector('#qh-smart-apply-steps');
      if (stepsContainer) stepsContainer.classList.add('hidden');
      
      // Reset pause button
      if (pauseBtn) {
        pauseBtn.innerHTML = '<span>⏸️</span> Pause';
        pauseBtn.classList.remove('paused');
      }
      
      showToast('⏹️ Automation stopped', 'error');
    });
  }
  
  // Smart Apply - Full 4-step workflow: Tailor CV → Attach PDFs → Fill → Next
  panel.querySelector('#qh-smart-apply').addEventListener('click', async () => {
    const btn = panel.querySelector('#qh-smart-apply');
    const statusEl = panel.querySelector('#qh-status');
    const stepsContainer = panel.querySelector('#qh-smart-apply-steps');
    const reviewPanel = panel.querySelector('#qh-review-panel');
    const resultsPanel = panel.querySelector('#qh-results');
    
    // Reset automation state before starting
    resetAutomationState();
    
    btn.disabled = true;
    stepsContainer.classList.remove('hidden');
    
    // Reset pause button to default state
    if (pauseBtn) {
      pauseBtn.innerHTML = '<span>⏸️</span> Pause';
      pauseBtn.classList.remove('paused');
    }
    
    const setStep = (stepNum) => {
      automationState.currentStep = stepNum;
      stepsContainer.querySelectorAll('.qh-step').forEach((step, i) => {
        step.classList.remove('active', 'completed');
        if (i + 1 < stepNum) step.classList.add('completed');
        if (i + 1 === stepNum) step.classList.add('active');
      });
    };
    
    try {
      const platform = detectPlatform();
      const jobData = extractJobDetails();
      
      // Get user profile and tokens
      const profileData = await chrome.storage.local.get(['userProfile', 'accessToken']);
      const profile = profileData.userProfile || {};
      
      if (!profile.first_name) {
        throw new Error('No profile found. Please set up your profile first.');
      }
      
      // Check controls before each major step
      await checkControls();
      
      // Handle Workday pre-apply flow if needed
      if (platform.name === 'workday' && platform.config?.preApplyFlow) {
        updateStatus(statusEl, '🚀', 'Starting Workday application...');
        const preApplyResult = await handleWorkdayPreApplyFlow();
        
        if (!preApplyResult.success && !preApplyResult.skipped) {
          throw new Error(preApplyResult.error || 'Failed to start Workday application');
        }
        
        if (!preApplyResult.skipped) {
          await waitWithControls(2500);
        }
      }
      
      // ===== STEP 1: TAILOR CV & COVER LETTER =====
      setStep(1);
      updateStatus(statusEl, '📄', 'Step 1: Tailoring CV & Cover Letter...');
      
      await checkControls(); // Check before long operation
      
      let tailoredData = null;
      let matchScore = 85;
      let smartLocation = '';
      let keywordsMatched = [];
      let keywordsMissing = [];
      
      
      if (profileData.accessToken) {
        try {
          showToast('🤖 AI tailoring your CV for this role...', 'info');
          
           const tailorResponse = await fetch(`${SUPABASE_URL}/functions/v1/tailor-application`, {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'apikey': SUPABASE_KEY,
               'Authorization': `Bearer ${profileData.accessToken}`
             },
             body: JSON.stringify({
               jobTitle: jobData.title,
               company: jobData.company,
               description: jobData.description || '',
               requirements: [],
               location: jobData.location || '',
               jobId: null,
               userProfile: {
                 firstName: String(profile.first_name || ''),
                 lastName: String(profile.last_name || ''),
                 email: String(profile.email || ''),
                 phone: String(profile.phone || ''),
                 linkedin: String(profile.linkedin || ''),
                 github: String(profile.github || ''),
                 portfolio: String(profile.portfolio || ''),
                 coverLetter: String(profile.cover_letter || ''),
                 workExperience: Array.isArray(profile.work_experience) ? profile.work_experience : [],
                 education: Array.isArray(profile.education) ? profile.education : [],
                 skills: Array.isArray(profile.skills) ? profile.skills : [],
                 certifications: Array.isArray(profile.certifications) ? profile.certifications : [],
                 achievements: Array.isArray(profile.achievements) ? profile.achievements : [],
                 atsStrategy: String(profile.ats_strategy || 'Match keywords from job description'),
                 city: profile.city ? String(profile.city) : undefined,
                 country: profile.country ? String(profile.country) : undefined,
                 address: profile.address ? String(profile.address) : undefined,
                 state: profile.state ? String(profile.state) : undefined,
                 zipCode: profile.zip_code ? String(profile.zip_code) : undefined,
               },
               includeReferral: false,
             })
           });
          
          if (tailorResponse.ok) {
            tailoredData = await tailorResponse.json();
            matchScore = tailoredData.matchScore || 85;
            smartLocation = tailoredData.smartLocation || '';
            keywordsMatched = tailoredData.keywordsMatched || [];
            keywordsMissing = tailoredData.keywordsMissing || [];
            
            console.log('QuantumHire AI: Tailoring complete', {
              matchScore,
              smartLocation,
              keywordsMatched: keywordsMatched.length,
              keywordsMissing: keywordsMissing.length
            });
            
            // Update ATS score badge
            panel.querySelector('#qh-ats-score-badge').textContent = `ATS: ${matchScore}%`;
            
            // Show match score in results
            if (resultsPanel) {
              panel.querySelector('#qh-score').textContent = `${matchScore}%`;
            }
            
            showToast(`✅ CV tailored! ATS Match: ${matchScore}%`, 'success');
            
            if (keywordsMissing.length > 0) {
              console.log('QuantumHire AI: Missing keywords:', keywordsMissing.slice(0, 5));
            }
          } else {
            const errorText = await tailorResponse.text();
            console.error('Tailor error:', errorText);
            showToast('⚠️ Tailoring partial - using profile data', 'warning');
          }
        } catch (tailorError) {
          console.error('Tailor error:', tailorError);
          showToast('⚠️ Tailoring failed - using profile data', 'warning');
        }
      } else {
        showToast('⚠️ Not authenticated - using basic profile', 'warning');
      }
      
      await waitWithControls(await getDelayForSpeed());
      
      // ===== STEP 2: GENERATE & ATTACH PDFs =====
      setStep(2);
      updateStatus(statusEl, '📎', 'Step 2: Generating & Attaching PDFs...');
      
      let resumePdfResult = null;
      let coverPdfResult = null;
      
      try {
        showToast('📄 Generating ATS-optimized PDFs...', 'info');
        
        // Generate Resume PDF
        resumePdfResult = await generatePDF('resume', profile, jobData, tailoredData);
        
        // Generate Cover Letter PDF
        coverPdfResult = await generatePDF('cover_letter', profile, jobData, tailoredData);
        
        console.log('QuantumHire AI: PDF generation results:', {
          resume: resumePdfResult?.success,
          resumeFileName: resumePdfResult?.fileName,
          cover: coverPdfResult?.success,
          coverFileName: coverPdfResult?.fileName
        });
        
        // Update PDF preview in panel
        if (resumePdfResult?.success) {
          panel.dataset.resumePdf = resumePdfResult.pdf;
          const resumeNameEl = panel.querySelector('#qh-resume-pdf-name');
          const resumeSizeEl = panel.querySelector('#qh-resume-pdf-size');
          const resumeCardEl = panel.querySelector('#qh-resume-pdf-card');
          if (resumeNameEl) resumeNameEl.textContent = resumePdfResult.fileName;
          if (resumeSizeEl) resumeSizeEl.textContent = formatFileSize(resumePdfResult.pdf?.length * 0.75);
          if (resumeCardEl) resumeCardEl.classList.add('uploaded');
        }
        
        if (coverPdfResult?.success) {
          panel.dataset.coverPdf = coverPdfResult.pdf;
          const coverNameEl = panel.querySelector('#qh-cover-pdf-name');
          const coverSizeEl = panel.querySelector('#qh-cover-pdf-size');
          const coverCardEl = panel.querySelector('#qh-cover-pdf-card');
          if (coverNameEl) coverNameEl.textContent = coverPdfResult.fileName;
          if (coverSizeEl) coverSizeEl.textContent = formatFileSize(coverPdfResult.pdf?.length * 0.75);
          if (coverCardEl) coverCardEl.classList.add('uploaded');
        }
        
        // Upload PDFs to form
        const uploadResults = await uploadPDFsToAllSections(resumePdfResult, coverPdfResult);
        
        if (uploadResults.filesUploaded > 0) {
          showToast(`✅ ${uploadResults.filesUploaded} PDF(s) attached to form`, 'success');
        } else if (resumePdfResult?.success || coverPdfResult?.success) {
          showToast('⚠️ PDFs generated but no upload fields found', 'warning');
        }
        
        // Store for results display
        if (tailoredData) {
          tailoredData.resumePdf = resumePdfResult;
          tailoredData.coverPdf = coverPdfResult;
        }
        
        // Update tailored content preview (use correct textarea IDs)
        if (tailoredData?.tailoredResume) {
          const resumeTextarea = panel.querySelector('#qh-resume');
          if (resumeTextarea) resumeTextarea.value = tailoredData.tailoredResume;
        }
        
        if (tailoredData?.tailoredCoverLetter) {
          const coverTextarea = panel.querySelector('#qh-cover');
          if (coverTextarea) coverTextarea.value = tailoredData.tailoredCoverLetter;
        }
        
        // Show results panel with PDFs
        if (resultsPanel && (resumePdfResult?.success || coverPdfResult?.success)) {
          resultsPanel.classList.remove('hidden');
        }
        
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        showToast('⚠️ PDF generation failed - continuing with form fill', 'warning');
      }
      
      // Check controls before next step
      await checkControls();
      await waitWithControls(await getDelayForSpeed());
      
      // ===== STEP 3: FILL FORM FIELDS & QUESTIONS =====
      setStep(3);
      updateStatus(statusEl, '📝', 'Step 3: Filling form fields...');
      
      // Check controls
      await checkControls();
      
      // Prevent concurrent execution
      if (automationState.stepLock) {
        console.log('QuantumHire AI: Step 3 already running, skipping...');
        return;
      }
      automationState.stepLock = true;
      
      // Fill basic profile fields DIRECTLY (don't call autofillForm to avoid recursion)
      let basicFieldsCount = 0;
      const fieldValues = {
        firstName: profile.first_name,
        lastName: profile.last_name,
        fullName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        zipCode: profile.zip_code,
        country: profile.country,
        linkedin: profile.linkedin,
        github: profile.github,
        portfolio: profile.portfolio
      };
      
      for (const [fieldType, value] of Object.entries(fieldValues)) {
        if (!value) continue;
        const field = findField(fieldType, platform.config);
        if (field && !field.classList.contains('quantumhire-filled') && fillField(field, value)) {
          field.classList.add('quantumhire-filled');
          basicFieldsCount++;
        }
      }
      
      console.log(`QuantumHire AI: Filled ${basicFieldsCount} basic fields`);
      
      // Detect all questions on the page
      const questions = detectAllQuestions();
      console.log(`QuantumHire AI: Found ${questions.length} questions to answer`);
      
      let aiAnswers = {};
      let overallAtsScore = matchScore;
      let knockoutRisks = [];
      
      if (questions.length > 0 && profileData.accessToken) {
        try {
          updateStatus(statusEl, '🤖', `Analyzing ${questions.length} questions with AI...`);
          
          const questionsForAI = questions.map((q, i) => ({
            id: q.id || `q_${i}`,
            label: q.label,
            type: q.type,
            options: q.type === 'select' ? Array.from(q.element?.options || []).map(o => o.text).filter(t => t) : undefined,
            required: q.element?.required || q.element?.getAttribute('aria-required') === 'true' || false
          }));
          
          const aiResponse = await fetch(`${SUPABASE_URL}/functions/v1/answer-questions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${profileData.accessToken}`
            },
            body: JSON.stringify({
              questions: questionsForAI,
              jobTitle: jobData.title,
              company: jobData.company,
              jobDescription: jobData.description,
              userProfile: {
                firstName: profile.first_name,
                lastName: profile.last_name,
                email: profile.email,
                phone: profile.phone,
                skills: profile.skills || [],
                workExperience: profile.work_experience || [],
                education: profile.education || [],
                certifications: profile.certifications || [],
                city: profile.city,
                state: profile.state,
                country: profile.country,
                citizenship: profile.citizenship,
                willingToRelocate: profile.willing_to_relocate,
                visaRequired: profile.visa_required,
                veteranStatus: profile.veteran_status,
                disability: profile.disability,
                raceEthnicity: profile.race_ethnicity,
                gender: profile.gender,
                hispanicLatino: profile.hispanic_latino,
                drivingLicense: profile.driving_license,
                securityClearance: profile.security_clearance,
                expectedSalary: profile.expected_salary,
                currentSalary: profile.current_salary,
                noticePeriod: profile.notice_period,
                totalExperience: profile.total_experience,
                linkedin: profile.linkedin,
                github: profile.github,
                portfolio: profile.portfolio,
                highestEducation: profile.highest_education,
                languages: profile.languages || [],
                achievements: profile.achievements || []
              }
            })
          });
          
          if (aiResponse.ok) {
            const aiResult = await aiResponse.json();
            overallAtsScore = aiResult.overallAtsScore || matchScore;
            knockoutRisks = aiResult.knockoutRisks || [];
            
            if (aiResult.answers) {
              aiResult.answers.forEach(a => {
                aiAnswers[a.id] = {
                  answer: a.answer,
                  selectValue: a.selectValue,
                  confidence: a.confidence,
                  atsScore: a.atsScore,
                  needsReview: a.needsReview,
                  reasoning: a.reasoning
                };
              });
            }
            console.log('QuantumHire AI: AI answered', Object.keys(aiAnswers).length, 'questions');
          }
        } catch (aiError) {
          console.error('AI question analysis error:', aiError);
        }
      }
      
      // Build reviewed answers combining knockout bank + AI answers
      const reviewedAnswers = {};
      let autoFilledCount = 0;
      let needsReviewCount = 0;
      let unfamiliarCount = 0;
      
      questions.forEach((q, i) => {
        const qId = q.id || `q_${i}`;
        const aiAnswer = aiAnswers[qId];
        const isOptional = /optional|if applicable|not applicable|n\/a|prefer not/i.test(q.label);
        const isRequired = q.element?.required || q.element?.getAttribute('aria-required') === 'true';
        
        // Check knockout bank first (highest priority)
        const knockoutMatch = matchKnockoutQuestion(q.label, profile);
        
        if (knockoutMatch) {
          autoFilledCount++;
          reviewedAnswers[qId] = {
            answer: knockoutMatch.answer,
            selectValue: knockoutMatch.selectValue || knockoutMatch.answer.toLowerCase(),
            atsScore: 95,
            needsReview: false
          };
        } else if (aiAnswer && aiAnswer.answer) {
          if (aiAnswer.needsReview || aiAnswer.confidence === 'low') {
            needsReviewCount++;
          } else {
            autoFilledCount++;
          }
          
          reviewedAnswers[qId] = {
            answer: aiAnswer.answer,
            selectValue: aiAnswer.selectValue || aiAnswer.answer.toLowerCase(),
            atsScore: aiAnswer.atsScore || 75,
            needsReview: aiAnswer.needsReview || false
          };
        } else if (isOptional && !isRequired) {
          // Optional questions without answers get N/A
          reviewedAnswers[qId] = {
            answer: 'N/A',
            selectValue: 'n/a',
            atsScore: 100,
            needsReview: false
          };
        } else {
          unfamiliarCount++;
        }
      });
      
      // Store answers for later use
      panel.dataset.reviewedAnswers = JSON.stringify(reviewedAnswers);
      
      // Fill questions ONCE with the reviewed answers (this is the ONLY call to fillAllQuestions)
      const questionFillResult = await fillAllQuestions(profile, jobData, reviewedAnswers);
      
      // Release the lock
      automationState.stepLock = false;
      
      updateStatus(statusEl, '✅', `Filled ${basicFieldsCount} fields + ${questionFillResult.filledCount} questions`);
      
      // Show knockout risks warning
      if (knockoutRisks.length > 0) {
        showToast(`⚠️ Knockout risks: ${knockoutRisks.join(', ')}`, 'warning');
      }
      
      // If there are unfamiliar questions, show review panel
      if (unfamiliarCount > 0) {
        // Build review list for unfamiliar questions
        const reviewList = panel.querySelector('#qh-review-list');
        if (reviewList) {
          reviewList.innerHTML = '';
          
          questions.forEach((q, i) => {
            const qId = q.id || `q_${i}`;
            const reviewedAnswer = reviewedAnswers[qId];
            
            if (!reviewedAnswer) {
              const itemHtml = `
                <div class="qh-review-item unfamiliar" data-question-id="${qId}" title="Click to edit">
                  <div class="qh-review-question">${q.label.substring(0, 50)}${q.label.length > 50 ? '...' : ''}</div>
                  <div class="qh-review-answer">
                    <span class="qh-review-answer-text">(needs your input)</span>
                    <span class="qh-review-score">ATS: 0%</span>
                    <button class="qh-review-answer-edit" data-question-id="${qId}">✏️</button>
                  </div>
                  <div class="qh-review-reasoning">This question requires manual input</div>
                </div>
              `;
              reviewList.insertAdjacentHTML('beforeend', itemHtml);
            }
          });
          
          // Update summary stats
          panel.querySelector('#qh-auto-filled').textContent = autoFilledCount;
          panel.querySelector('#qh-needs-review').textContent = needsReviewCount;
          panel.querySelector('#qh-unfamiliar').textContent = unfamiliarCount;
          panel.querySelector('#qh-ats-score-badge').textContent = `ATS: ${overallAtsScore}%`;
          
          // Add edit handlers
          reviewList.querySelectorAll('.qh-review-item').forEach(item => {
            item.addEventListener('click', (e) => {
              if (e.target.classList.contains('qh-review-answer-edit')) return;
              const qId = item.dataset.questionId;
              const question = questions.find((q, i) => (q.id || `q_${i}`) === qId);
              showEditModal(panel, qId, question?.label || 'Edit Answer', '', question);
            });
          });
          
          reviewList.querySelectorAll('.qh-review-answer-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const qId = btn.dataset.questionId;
              const question = questions.find((q, i) => (q.id || `q_${i}`) === qId);
              showEditModal(panel, qId, question?.label || 'Edit Answer', '', question);
            });
          });
          
          // Show review panel
          reviewPanel.classList.remove('hidden');
          showToast(`⚠️ ${unfamiliarCount} questions need your input - please review`, 'warning');
          updateStatus(statusEl, '⚠️', `${unfamiliarCount} questions need your input`);
          
          // Don't auto-proceed, let user review unfamiliar questions
          btn.disabled = false;
          automationState.isRunning = false;
          return;
        }
      }
      
      // Check controls before Step 4
      await checkControls();
      await waitWithControls(await getDelayForSpeed());
      
      // ===== STEP 4: NAVIGATE TO NEXT PAGE =====
      setStep(4);
      
      await checkControls();
      
      if (isFinalPage()) {
        updateStatus(statusEl, '🎉', 'Application ready to submit!');
        showToast('🎉 Application complete! Review and click Submit.', 'success');
      } else {
        updateStatus(statusEl, '➡️', 'Step 4: Moving to next page...');
        await waitWithControls(await getDelayForSpeed());
        
        const navigated = await navigateToNextPage();
        if (navigated) {
          showToast('✅ Page complete - moved to next section', 'success');
          updateStatus(statusEl, '✅', 'Page complete - continue on next page');
        } else {
          updateStatus(statusEl, '⚠️', 'Could not find next button');
          showToast('Please click Next manually', 'warning');
        }
      }
      
      // Hide steps indicator
      stepsContainer.classList.add('hidden');
      
    } catch (error) {
      stepsContainer.classList.add('hidden');
      automationState.stepLock = false; // Release lock on error
      
      if (error.message === 'QUIT') {
        updateStatus(statusEl, '⏹️', 'Stopped');
        showToast('⏹️ Automation stopped', 'info');
      } else if (error.message === 'SKIP') {
        updateStatus(statusEl, '⏭️', 'Skipped current step');
        showToast('⏭️ Step skipped', 'info');
      } else {
        console.error('Smart apply error:', error);
        updateStatus(statusEl, '❌', error.message);
        showToast(error.message, 'error');
      }
    } finally {
      btn.disabled = false;
      automationState.isRunning = false;
      automationState.stepLock = false;
      
      // Reset pause button state
      const pauseBtn = panel.querySelector('#qh-pause-btn');
      if (pauseBtn) {
        pauseBtn.innerHTML = '<span>⏸️</span> Pause';
        pauseBtn.classList.remove('paused');
      }
    }
  });
  
  // Quick Fill
  panel.querySelector('#qh-quick-fill').addEventListener('click', async () => {
    const btn = panel.querySelector('#qh-quick-fill');
    const statusEl = panel.querySelector('#qh-status');
    btn.disabled = true;
    
    try {
      const platform = detectPlatform();
      
      // Handle Workday pre-apply flow if needed
      if (platform.name === 'workday' && platform.config?.preApplyFlow) {
        updateStatus(statusEl, '🚀', 'Starting application...');
        const preApplyResult = await handleWorkdayPreApplyFlow();
        
        if (!preApplyResult.success && !preApplyResult.skipped) {
          throw new Error(preApplyResult.error || 'Failed to start application');
        }
        
        if (!preApplyResult.skipped) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      updateStatus(statusEl, '📝', 'Quick filling...');
      const atsData = await chrome.storage.local.get(['atsCredentials']);
      const result = await autofillForm(null, atsData.atsCredentials);
      
      updateStatus(statusEl, result.success ? '✅' : '⚠️', result.message);
      showToast(result.message, result.success ? 'success' : 'warning');
    } catch (error) {
      console.error('Quick fill error:', error);
      updateStatus(statusEl, '❌', error.message);
      showToast(error.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
  
  // Review Questions - AI-powered question analysis with proofreading
  panel.querySelector('#qh-review-questions')?.addEventListener('click', async () => {
    const btn = panel.querySelector('#qh-review-questions');
    const statusEl = panel.querySelector('#qh-status');
    const reviewPanel = panel.querySelector('#qh-review-panel');
    btn.disabled = true;
    
    try {
      updateStatus(statusEl, '🔍', 'Analyzing form questions...');
      
      // Detect all questions on the page
      const questions = detectAllQuestions();
      
      if (questions.length === 0) {
        updateStatus(statusEl, '❌', 'No questions found on this page');
        showToast('No questions detected', 'warning');
        return;
      }
      
      updateStatus(statusEl, '🤖', `Found ${questions.length} questions, analyzing with AI...`);
      
      // Get user profile and job data
      const profileData = await chrome.storage.local.get(['userProfile', 'accessToken']);
      const profile = profileData.userProfile || {};
      const jobData = extractJobDetails();
      
      // Prepare questions for AI analysis
      const questionsForAI = questions.map((q, i) => ({
        id: q.id || `q_${i}`,
        label: q.label,
        type: q.type,
        options: q.type === 'select' ? Array.from(q.element?.options || []).map(o => o.text).filter(t => t) : undefined,
        required: q.element?.required || q.element?.getAttribute('aria-required') === 'true' || false
      }));
      
      // Call AI to analyze and answer questions
      let aiAnswers = {};
      let overallAtsScore = 0;
      let reviewRecommendations = [];
      let knockoutRisks = [];
      
      if (profileData.accessToken) {
        const maxRetries = 3;
        let retryCount = 0;
        let success = false;
        
        while (retryCount < maxRetries && !success) {
          try {
            updateStatus(statusEl, '🤖', `Analyzing with AI... ${retryCount > 0 ? `(retry ${retryCount})` : ''}`);
            
            const response = await fetch(`${SUPABASE_URL}/functions/v1/answer-questions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${profileData.accessToken}`
              },
              body: JSON.stringify({
                questions: questionsForAI,
                jobTitle: jobData.title,
                company: jobData.company,
                jobDescription: jobData.description,
                userProfile: {
                  firstName: profile.first_name,
                  lastName: profile.last_name,
                  email: profile.email,
                  phone: profile.phone,
                  skills: profile.skills || [],
                  workExperience: profile.work_experience || [],
                  education: profile.education || [],
                  certifications: profile.certifications || [],
                  city: profile.city,
                  state: profile.state,
                  country: profile.country,
                  citizenship: profile.citizenship,
                  willingToRelocate: profile.willing_to_relocate,
                  visaRequired: profile.visa_required,
                  veteranStatus: profile.veteran_status,
                  disability: profile.disability,
                  raceEthnicity: profile.race_ethnicity,
                  drivingLicense: profile.driving_license,
                  securityClearance: profile.security_clearance,
                  expectedSalary: profile.expected_salary,
                  currentSalary: profile.current_salary,
                  noticePeriod: profile.notice_period,
                  totalExperience: profile.total_experience,
                  linkedin: profile.linkedin,
                  github: profile.github,
                  portfolio: profile.portfolio,
                  highestEducation: profile.highest_education,
                  languages: profile.languages || [],
                  achievements: profile.achievements || []
                }
              })
            });
            
            if (response.ok) {
              const aiResult = await response.json();
              overallAtsScore = aiResult.overallAtsScore || 0;
              reviewRecommendations = aiResult.reviewRecommendations || [];
              knockoutRisks = aiResult.knockoutRisks || [];
              
              if (aiResult.answers) {
                aiResult.answers.forEach(a => {
                  aiAnswers[a.id] = {
                    answer: a.answer,
                    selectValue: a.selectValue,
                    confidence: a.confidence,
                    atsScore: a.atsScore,
                    needsReview: a.needsReview,
                    reasoning: a.reasoning
                  };
                });
              }
              console.log('QuantumHire AI: AI answered', Object.keys(aiAnswers).length, 'questions');
              success = true;
            } else if (response.status === 429) {
              // Rate limit - wait and retry
              retryCount++;
              const errorData = await response.json().catch(() => ({}));
              const waitTime = errorData.retryAfter || Math.pow(2, retryCount) * 5;
              
              if (retryCount < maxRetries) {
                updateStatus(statusEl, '⏳', `Rate limited. Waiting ${waitTime}s before retry...`);
                showToast(`Rate limited. Retrying in ${waitTime}s...`, 'warning');
                await new Promise(r => setTimeout(r, waitTime * 1000));
              } else {
                throw new Error(`Rate limit exceeded after ${maxRetries} retries. Please wait a moment and try again.`);
              }
            } else {
              const errorText = await response.text();
              console.error('AI response error:', errorText);
              throw new Error('AI analysis failed');
            }
          } catch (aiError) {
            if (retryCount >= maxRetries - 1) {
              console.error('AI analysis error:', aiError);
              showToast(`⚠️ ${aiError.message || 'AI analysis failed'}. Continuing with local answers.`, 'warning');
              success = true; // Continue with whatever answers we have
            } else {
              retryCount++;
            }
          }
        }
      }
      
      // Build review list
      const reviewList = panel.querySelector('#qh-review-list');
      reviewList.innerHTML = '';
      
      let autoFilledCount = 0;
      let needsReviewCount = 0;
      let unfamiliarCount = 0;
      
      // Store answers for later application
      panel.dataset.reviewedAnswers = JSON.stringify(aiAnswers);
      panel.dataset.questionIds = JSON.stringify(questions.map((q, i) => q.id || `q_${i}`));
      
      questions.forEach((q, i) => {
        const qId = q.id || `q_${i}`;
        const aiAnswer = aiAnswers[qId];
        
        // Determine answer source
        let answer = '';
        let confidence = 'low';
        let atsScore = 0;
        let needsReview = true;
        let reasoning = 'No AI answer available';
        let answerClass = 'unfamiliar';
        
        // Check knockout bank first
        const knockoutMatch = matchKnockoutQuestion(q.label, profile);
        if (knockoutMatch) {
          answer = knockoutMatch.answer;
          confidence = 'high';
          atsScore = 95;
          needsReview = false;
          reasoning = 'Standard ATS knockout question - auto-answered';
          answerClass = 'approved';
          autoFilledCount++;
        } else if (aiAnswer) {
          answer = aiAnswer.answer;
          confidence = aiAnswer.confidence || 'medium';
          atsScore = aiAnswer.atsScore || 75;
          needsReview = aiAnswer.needsReview || false;
          reasoning = aiAnswer.reasoning || 'AI-generated response';
          
          if (needsReview || confidence === 'low') {
            answerClass = 'needs-review';
            needsReviewCount++;
          } else {
            answerClass = 'approved';
            autoFilledCount++;
          }
        } else {
          unfamiliarCount++;
          answer = 'N/A (no answer available)';
          reasoning = 'This question requires manual review - AI could not determine an appropriate answer';
        }
        
        const itemHtml = `
          <div class="qh-review-item ${answerClass}" data-question-id="${qId}">
            <div class="qh-review-question" title="${q.label}">${q.label.substring(0, 60)}${q.label.length > 60 ? '...' : ''}</div>
            <div class="qh-review-answer">
              <span class="qh-review-answer-text" title="${answer}">${answer}</span>
              <span class="qh-review-score">ATS: ${atsScore}%</span>
              <button class="qh-review-answer-edit" data-question-id="${qId}">✏️ Edit</button>
            </div>
            <div class="qh-review-reasoning">${reasoning}</div>
          </div>
        `;
        reviewList.insertAdjacentHTML('beforeend', itemHtml);
      });
      
      // Update summary stats
      panel.querySelector('#qh-auto-filled').textContent = autoFilledCount;
      panel.querySelector('#qh-needs-review').textContent = needsReviewCount;
      panel.querySelector('#qh-unfamiliar').textContent = unfamiliarCount;
      panel.querySelector('#qh-ats-score-badge').textContent = `ATS: ${overallAtsScore}%`;
      
      // Show knockout risks if any
      if (knockoutRisks.length > 0) {
        showToast(`⚠️ Knockout risks detected: ${knockoutRisks.join(', ')}`, 'warning');
      }
      
      // Show review panel
      reviewPanel.classList.remove('hidden');
      updateStatus(statusEl, '✅', `${questions.length} questions analyzed - review before applying`);
      
      // Add edit button handlers
      reviewList.querySelectorAll('.qh-review-answer-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const qId = e.target.dataset.questionId;
          const question = questions.find((q, i) => (q.id || `q_${i}`) === qId);
          const currentAnswer = aiAnswers[qId]?.answer || '';
          showEditModal(panel, qId, question?.label || 'Edit Answer', currentAnswer);
        });
      });
      
    } catch (error) {
      console.error('Review questions error:', error);
      updateStatus(statusEl, '❌', error.message);
      showToast(error.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
  
  // Auto-approve is now default - removed manual approval buttons
  
  // Auto-apply reviewed answers is now default behavior in Smart Apply

  // Tabs / copy / PDF actions
  setupPanelEventsContinued(panel);
  
  // Next Page
  panel.querySelector('#qh-next-page').addEventListener('click', async () => {
    const navigated = await navigateToNextPage();
    if (!navigated) showToast('Next button not found', 'error');
  });
}

// Show edit modal for reviewing/editing AI answers with guidance for unfamiliar questions
function showEditModal(panel, questionId, questionLabel, currentAnswer, questionData = null) {
  // Remove existing modal
  document.querySelector('.qh-overlay')?.remove();
  document.querySelector('.qh-review-edit-modal')?.remove();
  
  const overlay = document.createElement('div');
  overlay.className = 'qh-overlay';
  
  // Determine if this is an unfamiliar question
  const isUnfamiliar = !currentAnswer || currentAnswer === 'N/A' || currentAnswer === '';
  const isOptional = /optional|if applicable|not applicable|prefer not/i.test(questionLabel);
  
  // Build hint based on question type
  let hint = '';
  if (isUnfamiliar) {
    hint = `
      <div class="qh-review-edit-hint">
        💡 <strong>Tips for unfamiliar questions:</strong><br/>
        • Provide a relevant response based on your experience<br/>
        • For questions that don't apply, enter "N/A"<br/>
        • Keep answers ATS-friendly and concise<br/>
        ${isOptional ? '• This appears to be optional - "N/A" is acceptable' : ''}
      </div>
    `;
  } else {
    hint = `
      <div class="qh-review-edit-hint">
        ✏️ Review and edit the AI-generated answer to add your personal touch.<br/>
        Ensure accuracy and alignment with your actual experience.
      </div>
    `;
  }
  
  const modal = document.createElement('div');
  modal.className = 'qh-review-edit-modal';
  modal.innerHTML = `
    <div class="qh-review-edit-question">${questionLabel}</div>
    ${hint}
    <textarea class="qh-review-edit-input" id="qh-edit-answer" placeholder="${isUnfamiliar ? 'Enter your response or type N/A if not applicable...' : 'Edit your answer...'}">${currentAnswer || ''}</textarea>
    <div class="qh-review-edit-actions">
      ${isOptional ? '<button class="qh-btn secondary" id="qh-edit-na">Mark N/A</button>' : ''}
      <button class="qh-btn secondary" id="qh-edit-cancel">Cancel</button>
      <button class="qh-btn primary" id="qh-edit-save">Save</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  
  // Focus on the textarea
  modal.querySelector('#qh-edit-answer').focus();
  
  modal.querySelector('#qh-edit-cancel').addEventListener('click', () => {
    overlay.remove();
    modal.remove();
  });
  
  overlay.addEventListener('click', () => {
    overlay.remove();
    modal.remove();
  });
  
  // Mark as N/A button
  modal.querySelector('#qh-edit-na')?.addEventListener('click', () => {
    modal.querySelector('#qh-edit-answer').value = 'N/A';
  });
  
  modal.querySelector('#qh-edit-save').addEventListener('click', () => {
    const newAnswer = modal.querySelector('#qh-edit-answer').value.trim();
    
    if (!newAnswer) {
      showToast('Please enter an answer or mark as N/A', 'warning');
      return;
    }
    
    const reviewedAnswers = JSON.parse(panel.dataset.reviewedAnswers || '{}');
    const isNA = newAnswer.toLowerCase() === 'n/a' || newAnswer.toLowerCase() === 'na';
    
    reviewedAnswers[questionId] = { 
      answer: newAnswer, 
      selectValue: newAnswer.toLowerCase(),
      confidence: 'high',
      atsScore: isNA ? 100 : 90,
      needsReview: false,
      reasoning: isNA ? 'User marked as not applicable' : 'User-edited response'
    };
    panel.dataset.reviewedAnswers = JSON.stringify(reviewedAnswers);
    
    // Update display
    const item = panel.querySelector(`[data-question-id="${questionId}"]`);
    if (item) {
      item.querySelector('.qh-review-answer-text').textContent = newAnswer;
      item.querySelector('.qh-review-score').textContent = `ATS: ${isNA ? 100 : 90}%`;
      item.classList.remove('needs-review', 'unfamiliar');
      item.classList.add(isNA ? 'na-response' : 'approved');
    }
    
    // Update unfamiliar count
    const unfamiliarEl = panel.querySelector('#qh-unfamiliar');
    const currentUnfamiliar = parseInt(unfamiliarEl?.textContent || '0');
    if (currentUnfamiliar > 0) {
      unfamiliarEl.textContent = currentUnfamiliar - 1;
    }
    
    overlay.remove();
    modal.remove();
    showToast('Answer saved', 'success');
  });
}

function setupPanelEventsContinued(panel) {
  // Tab switching
  panel.querySelectorAll('.qh-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      panel.querySelectorAll('.qh-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      panel.querySelector('#qh-resume-tab').classList.toggle('hidden', tabName !== 'resume');
      panel.querySelector('#qh-cover-tab').classList.toggle('hidden', tabName !== 'cover');
    });
  });
  
  // Copy buttons
  panel.querySelectorAll('.qh-copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const textarea = panel.querySelector(`#${btn.dataset.target}`);
      await navigator.clipboard.writeText(textarea.value);
      btn.textContent = '✅ Copied!';
      setTimeout(() => btn.textContent = '📋 Copy', 2000);
    });
  });
  
  // PDF Download
  panel.querySelectorAll('.qh-pdf-download-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const pdfBase64 = type === 'resume' ? panel.dataset.resumePdf : panel.dataset.coverPdf;
      const fileName = type === 'resume' ? panel.querySelector('#qh-resume-pdf-name').textContent : panel.querySelector('#qh-cover-pdf-name').textContent;
      
      if (!pdfBase64) { showToast('PDF not generated yet', 'error'); return; }
      
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${pdfBase64}`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Downloaded ${fileName}`, 'success');
    });
  });
  
  // PDF Preview buttons
  panel.querySelectorAll('.qh-pdf-action-btn[data-action="preview"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      showPdfPreviewModal(panel, type);
    });
  });
  
  // Main Preview PDFs button
  panel.querySelector('#qh-preview-pdfs-btn')?.addEventListener('click', () => {
    showPdfPreviewModal(panel, 'resume');
  });
}

// Show PDF Preview Modal
function showPdfPreviewModal(panel, initialTab = 'resume') {
  // Remove existing modal
  document.querySelector('.qh-overlay')?.remove();
  document.querySelector('.qh-pdf-modal')?.remove();
  
  const resumePdf = panel.dataset.resumePdf;
  const coverPdf = panel.dataset.coverPdf;
  const resumeName = panel.querySelector('#qh-resume-pdf-name')?.textContent || 'Resume.pdf';
  const coverName = panel.querySelector('#qh-cover-pdf-name')?.textContent || 'CoverLetter.pdf';
  
  // Get the text content from textareas for preview (more reliable than iframe)
  const resumeText = panel.querySelector('#qh-resume')?.value || '';
  const coverText = panel.querySelector('#qh-cover')?.value || '';
  
  if (!resumePdf && !coverPdf && !resumeText && !coverText) {
    showToast('No PDFs generated yet. Click Smart Apply first.', 'error');
    return;
  }
  
  const overlay = document.createElement('div');
  overlay.className = 'qh-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'qh-pdf-modal';
  modal.innerHTML = `
    <div class="qh-pdf-modal-header">
      <div class="qh-pdf-modal-title">📄 Document Preview</div>
      <div class="qh-pdf-modal-tabs">
        <button class="qh-pdf-modal-tab ${initialTab === 'resume' ? 'active' : ''}" data-tab="resume">📄 Resume</button>
        <button class="qh-pdf-modal-tab ${initialTab === 'cover' ? 'active' : ''}" data-tab="cover">📝 Cover Letter</button>
      </div>
      <button class="qh-pdf-modal-close">×</button>
    </div>
    <div class="qh-pdf-modal-body">
      <div class="qh-pdf-modal-content ${initialTab === 'resume' ? '' : 'hidden'}" id="qh-modal-resume">
        ${resumeText || resumePdf ? 
          `<div class="qh-pdf-text-preview"><pre>${escapeHtml(resumeText) || '(PDF generated - click Download to view)'}</pre></div>` : 
          '<div style="padding:40px;text-align:center;color:hsl(215 20% 65%);">Resume not generated yet</div>'
        }
      </div>
      <div class="qh-pdf-modal-content ${initialTab === 'cover' ? '' : 'hidden'}" id="qh-modal-cover">
        ${coverText || coverPdf ? 
          `<div class="qh-pdf-text-preview"><pre>${escapeHtml(coverText) || '(PDF generated - click Download to view)'}</pre></div>` : 
          '<div style="padding:40px;text-align:center;color:hsl(215 20% 65%);">Cover letter not generated yet</div>'
        }
      </div>
    </div>
    <div class="qh-pdf-modal-footer">
      <div class="qh-pdf-modal-footer-left">
        <span style="font-size:12px;color:hsl(215 20% 65%);">Review your documents before attaching</span>
      </div>
      <div class="qh-pdf-modal-footer-right">
        <button class="qh-btn secondary" id="qh-modal-download">⬇️ Download PDF</button>
        <button class="qh-btn primary" id="qh-modal-attach">📎 Attach to Form</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  
  // Track active tab
  let activeTab = initialTab;
  
  // Tab switching
  modal.querySelectorAll('.qh-pdf-modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      modal.querySelectorAll('.qh-pdf-modal-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      modal.querySelector('#qh-modal-resume').classList.toggle('hidden', activeTab !== 'resume');
      modal.querySelector('#qh-modal-cover').classList.toggle('hidden', activeTab !== 'cover');
    });
  });
  
  // Close handlers
  const closeModal = () => {
    overlay.remove();
    modal.remove();
  };
  
  modal.querySelector('.qh-pdf-modal-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);
  
  // Download button
  modal.querySelector('#qh-modal-download').addEventListener('click', () => {
    const pdfData = activeTab === 'resume' ? resumePdf : coverPdf;
    const fileName = activeTab === 'resume' ? resumeName : coverName;
    
    if (!pdfData) {
      showToast(`${activeTab === 'resume' ? 'Resume' : 'Cover letter'} not available`, 'error');
      return;
    }
    
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${pdfData}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloaded ${fileName}`, 'success');
  });
  
  // Attach to form button
  modal.querySelector('#qh-modal-attach').addEventListener('click', async () => {
    closeModal();
    showToast('Attaching PDFs to form...', 'info');
    
    const resumePdfResult = resumePdf ? { success: true, pdf: resumePdf, fileName: resumeName } : null;
    const coverPdfResult = coverPdf ? { success: true, pdf: coverPdf, fileName: coverName } : null;
    
    const uploadResults = await uploadPDFsToAllSections(resumePdfResult, coverPdfResult);
    
    if (uploadResults.filesUploaded > 0) {
      showToast(`✅ ${uploadResults.filesUploaded} PDF(s) attached to form`, 'success');
    } else {
      showToast('⚠️ No upload fields found on this page', 'warning');
    }
  });
}

function formatFileSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function updateStatus(statusEl, icon, text) {
  if (!statusEl) return;
  statusEl.innerHTML = `<span class="qh-status-icon">${icon}</span><span class="qh-status-text">${text}</span>`;
}

// ============= MESSAGE LISTENER =============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('QuantumHire AI: Message received', message.action);
  
  if (message.action === 'autofill') {
    (async () => {
      try {
        const options = message.options || {};
        const tailoredData = message.tailoredData || {};
        const atsCredentials = message.atsCredentials;
        
        // If generatePdfs is requested, generate PDFs first
        if (options.generatePdfs && tailoredData) {
          console.log('QuantumHire AI: Generating PDFs from autofill message...');
          const profileData = await chrome.storage.local.get(['userProfile']);
          const profile = profileData.userProfile || {};
          const jobData = extractJobDetails();
          
          // Generate both PDFs
          const resumePdfResult = await generatePDF('resume', profile, jobData, tailoredData);
          const coverPdfResult = await generatePDF('cover_letter', profile, jobData, tailoredData);
          
          // Attach to tailored data for upload
          tailoredData.resumePdf = resumePdfResult;
          tailoredData.coverPdf = coverPdfResult;
          
          console.log('QuantumHire AI: PDF generation results:', {
            resume: resumePdfResult?.success,
            cover: coverPdfResult?.success
          });
        }
        
        // Perform autofill
        const result = await autofillForm(tailoredData, atsCredentials, options);
        
        // Upload PDFs if available
        if (tailoredData?.resumePdf?.success || tailoredData?.coverPdf?.success) {
          console.log('QuantumHire AI: Uploading generated PDFs...');
          const uploadResults = await uploadPDFsToAllSections(tailoredData.resumePdf, tailoredData.coverPdf);
          result.pdfUploads = uploadResults;
        }
        
        sendResponse(result);
      } catch (error) {
        console.error('QuantumHire AI: Autofill error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (message.action === 'extractJob') {
    sendResponse(extractJobDetails());
    return true;
  }
  
  if (message.action === 'showPanel') {
    createFloatingPanel();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'getStatus') {
    sendResponse({ ...applicationState, platform: detectPlatform().name, automationState });
    return true;
  }
  
  if (message.action === 'generateAndUploadPdfs') {
    (async () => {
      try {
        const profileData = await chrome.storage.local.get(['userProfile']);
        const profile = profileData.userProfile || {};
        const jobData = extractJobDetails();
        const tailoredData = message.tailoredData || {};
        
        const resumePdfResult = await generatePDF('resume', profile, jobData, tailoredData);
        const coverPdfResult = await generatePDF('cover_letter', profile, jobData, tailoredData);
        
        const uploadResults = await uploadPDFsToAllSections(resumePdfResult, coverPdfResult);
        
        sendResponse({
          success: true,
          resume: resumePdfResult,
          cover: coverPdfResult,
          uploads: uploadResults
        });
      } catch (error) {
        console.error('QuantumHire AI: PDF generation/upload error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

// ============= INITIALIZATION =============

async function initialize() {
  const hostname = window.location.hostname;
  const url = window.location.href;
  
  console.log('QuantumHire AI: Initializing on', hostname);
  
  // Add extension marker for web app detection
  addExtensionMarkerToPage();
  
  // Check if this was opened from the web app (auto-apply mode)
  const isFromWebApp = document.referrer.includes('lovable.dev') || 
                       document.referrer.includes('localhost') ||
                       sessionStorage.getItem('quantumhire_auto_apply') === 'true';
  
  // Skip pure job board listing pages (not application pages)
  const isJobListingPage = (hostname.includes('linkedin.com') && !url.includes('/jobs/view/')) ||
                           (hostname.includes('indeed.com') && !url.includes('/viewjob'));
  
  if (isJobListingPage) {
    console.log('QuantumHire AI: Job listing page, waiting for job selection');
    return;
  }
  
  const platform = detectPlatform();
  console.log(`QuantumHire AI: Detected platform: ${platform.name}`);
  
  // IMMEDIATE panel creation for recognized ATS platforms - don't wait!
  const isRecognizedATS = platform.name !== 'generic';
  const isApplicationPage = url.includes('apply') || url.includes('application') || 
                            url.includes('careers') || url.includes('jobs');
  
  if (isRecognizedATS || isApplicationPage) {
    console.log('QuantumHire AI: Recognized ATS/application page - showing panel immediately');
    showToast('QuantumHire AI Ready', 'info', 2000);
    // Create panel immediately for recognized platforms
    createFloatingPanel();
  }
  
  // Wait a moment for page to render before checking validity
  await new Promise(r => setTimeout(r, 800));
  
  // Check if this is a valid job page
  const jobValidation = isValidJobPage();
  console.log('QuantumHire AI: Job validation result:', jobValidation);
  
  if (!jobValidation.valid) {
    console.log('QuantumHire AI: Invalid job page -', jobValidation.reason);
    
    // Show notification about the issue
    showToast(`⚠️ ${jobValidation.message}`, 'warning');
    
    // Create a minimal panel showing the error
    createInvalidJobPanel(jobValidation.message);
    
    // Notify web app to skip this job after 2 seconds
    setTimeout(() => {
      notifyWebAppToSkip(jobValidation.reason);
    }, 2000);
    
    return;
  }
  
  // Create floating panel if not already created
  if (!document.getElementById('quantumhire-panel')) {
    createFloatingPanel();
  }
  
  // Monitor for panel removal and re-create if needed (some sites remove injected elements)
  const panelObserver = new MutationObserver(() => {
    if (!document.getElementById('quantumhire-panel') && !document.querySelector('.qh-invalid-panel')) {
      console.log('QuantumHire AI: Panel was removed, re-creating...');
      createFloatingPanel();
    }
  });
  panelObserver.observe(document.body, { childList: true, subtree: false });
  
  // Auto-trigger autofill if we have stored profile and this looks like an application page
  const shouldAutoFill = platform.name !== 'generic' || 
                         url.includes('apply') || 
                         url.includes('application') ||
                         url.includes('careers') ||
                         document.querySelector('[data-automation-id="applicationForm"], #application_form, form[action*="apply"]');
  
  if (shouldAutoFill) {
    console.log('QuantumHire AI: Application page detected, checking for auto-fill...');
    
    // Wait for page to fully load
    await new Promise(r => setTimeout(r, 1500));
    
    // Get stored settings
    const data = await chrome.storage.local.get([
      'userProfile', 
      'autofillEnabled', 
      'smartApplyEnabled',
      'autoSubmitEnabled',
      'autoNavigateEnabled'
    ]);
    
    // Update automation state with user settings
    automationState.smartApplyEnabled = data.smartApplyEnabled !== false;
    automationState.autoSubmit = data.autoSubmitEnabled === true;
    automationState.autoNavigate = data.autoNavigateEnabled !== false;
    
    if (data.autofillEnabled !== false && data.userProfile) {
      console.log('QuantumHire AI: Auto-fill enabled, starting...', {
        smartApply: automationState.smartApplyEnabled,
        autoSubmit: automationState.autoSubmit,
        autoNavigate: automationState.autoNavigate
      });
      
      // Show toast that we're auto-filling
      const modeText = automationState.smartApplyEnabled ? 'Smart Apply' : 'Auto-fill';
      showToast(`QuantumHire AI - ${modeText} starting...`, 'info', 3000);
      
      // Trigger autofill
      setTimeout(async () => {
        try {
          await autofillForm({}, null, {
            autoMode: automationState.smartApplyEnabled,
            autoSubmit: automationState.autoSubmit,
            autoNavigate: automationState.autoNavigate,
            generatePdfs: true,
          });
          
          // If Smart Apply mode is on and auto-navigate is enabled, run the workflow
          if (automationState.smartApplyEnabled && automationState.autoNavigate) {
            await runSmartApplyWorkflow({
              autoNavigate: automationState.autoNavigate,
              autoSubmit: automationState.autoSubmit
            });
          } else {
            showToast('Form auto-filled! Review and submit.', 'success', 4000);
          }
        } catch (error) {
          console.error('QuantumHire AI: Auto-fill error:', error);
          updatePanelStatus('error', 'Auto-fill had issues. Check form.');
        }
      }, 1500);
    }
  }
}

// Create panel for invalid/broken job pages
function createInvalidJobPanel(message) {
  if (document.getElementById('quantumhire-panel')) return;
  
  const panel = document.createElement('div');
  panel.id = 'quantumhire-panel';
  panel.className = 'qh-invalid-panel';
  panel.innerHTML = `
    <div class="qh-header">
      <div class="qh-brand">
        <span class="qh-logo">⚡</span>
        <span class="qh-title">QuantumHire AI</span>
      </div>
      <div class="qh-controls">
        <button class="qh-minimize">×</button>
      </div>
    </div>
    <div class="qh-body">
      <div class="qh-invalid-message">
        <span class="qh-invalid-icon">🔍</span>
        <span class="qh-invalid-text">${message}</span>
      </div>
      <div class="qh-invalid-action">
        <span class="qh-skip-indicator">⏭️ Skipping to next job...</span>
      </div>
    </div>
  `;
  
  document.body.appendChild(panel);
  addPanelStyles();
  
  // Add close functionality
  panel.querySelector('.qh-minimize').addEventListener('click', () => {
    panel.remove();
  });
}

// Update panel status message (for error states)
function updatePanelStatus(type, message) {
  const panel = document.getElementById('quantumhire-panel');
  if (!panel) return;
  
  const statusEl = panel.querySelector('#qh-status');
  if (statusEl) {
    const iconMap = { success: '✅', error: '⚠️', warning: '⚠️', info: 'ℹ️' };
    statusEl.innerHTML = `<span class="qh-status-icon">${iconMap[type] || '🔔'}</span><span class="qh-status-text">${message}</span>`;
    statusEl.className = `qh-status qh-status-${type}`;
  }
}

// Add marker so web app can detect extension
function addExtensionMarkerToPage() {
  if (document.getElementById('quantumhire-extension-marker')) return;
  
  const marker = document.createElement('div');
  marker.id = 'quantumhire-extension-marker';
  marker.setAttribute('data-quantumhire-extension', 'true');
  marker.setAttribute('data-version', '2.0');
  marker.style.display = 'none';
  document.body.appendChild(marker);
  console.log('QuantumHire AI: Extension marker added');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
