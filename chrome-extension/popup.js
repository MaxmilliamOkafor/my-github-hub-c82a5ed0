// QuantumHire AI - Popup Script (Simplified & Reliable)

// Config
const SUPABASE_URL = 'https://wntpldomgjutwufphnpg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudHBsZG9tZ2p1dHd1ZnBobnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDY0NDAsImV4cCI6MjA4MjE4MjQ0MH0.vOXBQIg6jghsAby2MA1GfE-MNTRZ9Ny1W2kfUHGUzNM';
const DASHBOARD_URL = 'https://lovable.dev/projects/47ce3fc9-a939-41ad-bf41-c4c34dc10c2b';

// Default ATS credentials
const DEFAULT_ATS_EMAIL = 'Maxokafordev@gmail.com';
const DEFAULT_ATS_PASSWORD = 'May19315park@';

// State
let currentJob = null;
let userProfile = null;
let jobQueue = [];
let batchProcessing = false;
let batchCancelled = false;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

async function init() {
  console.log('QuantumHire: Initializing...');
  
  // Initialize defaults first
  await initializeDefaults();
  
  // Refresh token if needed before loading connection
  await refreshTokenIfNeeded();
  
  // Load data
  await loadConnection();
  await loadCredentials();
  await loadJobQueue();
  await loadAutomationSettings();
  await loadMemoryCount();
  
  // Setup all event listeners
  setupEventListeners();
  
  console.log('QuantumHire: Ready!');
}

// Check and refresh token if expired or about to expire
async function refreshTokenIfNeeded() {
  try {
    const data = await chrome.storage.local.get(['accessToken', 'refreshToken', 'tokenExpiry']);
    
    if (!data.refreshToken) {
      console.log('QuantumHire: No refresh token, skipping refresh');
      return;
    }
    
    // Check if token is expired or will expire in next 5 minutes
    const now = Date.now();
    const expiry = data.tokenExpiry || 0;
    const fiveMinutes = 5 * 60 * 1000;
    
    if (expiry > now + fiveMinutes) {
      console.log('QuantumHire: Token still valid');
      return;
    }
    
    console.log('QuantumHire: Token expired or expiring soon, refreshing...');
    
    // Refresh the token
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({ refresh_token: data.refreshToken }),
    });
    
    if (!response.ok) {
      console.log('QuantumHire: Token refresh failed, clearing session');
      await chrome.storage.local.remove(['accessToken', 'refreshToken', 'tokenExpiry', 'userProfile', 'userId']);
      return;
    }
    
    const authData = await response.json();
    
    // Calculate expiry (tokens typically last 1 hour)
    const newExpiry = Date.now() + (authData.expires_in || 3600) * 1000;
    
    await chrome.storage.local.set({
      accessToken: authData.access_token,
      refreshToken: authData.refresh_token,
      tokenExpiry: newExpiry,
    });
    
    console.log('QuantumHire: Token refreshed successfully');
  } catch (e) {
    console.error('QuantumHire: Token refresh error:', e);
  }
}

// Load memory count from database
async function loadMemoryCount() {
  try {
    const data = await chrome.storage.local.get(['accessToken', 'userId']);
    
    if (!data.accessToken || !data.userId) return;
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/user_memories?user_id=eq.${data.userId}&select=id`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${data.accessToken}`,
      },
    });
    
    if (response.ok) {
      const memories = await response.json();
      const savedAnswersCount = document.getElementById('saved-answers-count');
      if (savedAnswersCount) savedAnswersCount.textContent = memories.length || '0';
    }
  } catch (e) {
    console.log('Failed to load memory count:', e);
  }
}

// Initialize default values on first load
async function initializeDefaults() {
  try {
    const data = await chrome.storage.local.get(['credentialsInitialized']);
    
    if (!data.credentialsInitialized) {
      await chrome.storage.local.set({
        atsCredentials: {
          email: DEFAULT_ATS_EMAIL,
          password: DEFAULT_ATS_PASSWORD
        },
        credentialsInitialized: true,
        autofillEnabled: true,
        smartApplyEnabled: true,
        autoSubmitEnabled: false,
        autoNavigateEnabled: true
      });
      console.log('QuantumHire: Default settings initialized');
    }
  } catch (e) {
    console.error('Init defaults error:', e);
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleConnect);
  }

  // Login password toggle
  const loginTogglePassword = document.getElementById('login-toggle-password');
  const passwordInput = document.getElementById('password');
  if (loginTogglePassword && passwordInput) {
    loginTogglePassword.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      loginTogglePassword.querySelector('.eye-icon').textContent = type === 'password' ? '👁️' : '🙈';
      loginTogglePassword.title = type === 'password' ? 'Show password' : 'Hide password';
    });
  }

  // Settings panel toggle
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const closeSettingsBtn = document.getElementById('close-settings-btn');

  const openSettings = () => {
    if (!settingsPanel) return;
    settingsPanel.classList.remove('hidden');
  };

  const closeSettings = () => {
    if (!settingsPanel) return;
    settingsPanel.classList.add('hidden');
  };

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (!settingsPanel) return;
      const isHidden = settingsPanel.classList.contains('hidden');
      if (isHidden) openSettings();
      else closeSettings();
    });
  }

  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', closeSettings);
  }

  // Disconnect button
  const disconnectBtn = document.getElementById('disconnect-btn');
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', handleDisconnect);
  }

  // Refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshProfile);
  }

  // Apply now button
  const applyNowBtn = document.getElementById('apply-now-btn');
  if (applyNowBtn) {
    applyNowBtn.addEventListener('click', handleApplyWithAI);
  }

  // Add to queue button
  const addQueueBtn = document.getElementById('add-queue-btn');
  if (addQueueBtn) {
    addQueueBtn.addEventListener('click', handleAddToQueue);
  }

  // Batch apply button
  const batchApplyBtn = document.getElementById('batch-apply-btn');
  if (batchApplyBtn) {
    batchApplyBtn.addEventListener('click', handleBatchApply);
  }

  // Cancel batch button
  const cancelBatchBtn = document.getElementById('cancel-batch-btn');
  if (cancelBatchBtn) {
    cancelBatchBtn.addEventListener('click', cancelBatchApply);
  }

  // Automation toggles
  const autofillToggle = document.getElementById('autofill-toggle');
  if (autofillToggle) {
    autofillToggle.addEventListener('change', () => handleAutomationToggle('autofillEnabled', 'autofill-toggle'));
  }

  const smartApplyToggle = document.getElementById('smartapply-toggle');
  if (smartApplyToggle) {
    smartApplyToggle.addEventListener('change', () => handleAutomationToggle('smartApplyEnabled', 'smartapply-toggle'));
  }

  const autoSubmitToggle = document.getElementById('autosubmit-toggle');
  if (autoSubmitToggle) {
    autoSubmitToggle.addEventListener('change', () => handleAutomationToggle('autoSubmitEnabled', 'autosubmit-toggle'));
  }

  const autoNavigateToggle = document.getElementById('autonavigate-toggle');
  if (autoNavigateToggle) {
    autoNavigateToggle.addEventListener('change', () => handleAutomationToggle('autoNavigateEnabled', 'autonavigate-toggle'));
  }

  // Credentials toggle (expand/collapse)
  const credentialsToggle = document.getElementById('credentials-toggle');
  const credentialsBody = document.getElementById('credentials-body');
  if (credentialsToggle && credentialsBody) {
    credentialsToggle.addEventListener('click', () => {
      credentialsBody.classList.toggle('hidden');
      const arrow = credentialsToggle.querySelector('.toggle-arrow');
      if (arrow) {
        arrow.textContent = credentialsBody.classList.contains('hidden') ? '▼' : '▲';
      }
    });
  }

  // Save credentials button
  const saveCredentialsBtn = document.getElementById('save-credentials-btn');
  if (saveCredentialsBtn) {
    saveCredentialsBtn.addEventListener('click', saveCredentials);
  }

  // Clear credentials button
  const clearCredentialsBtn = document.getElementById('clear-credentials-btn');
  if (clearCredentialsBtn) {
    clearCredentialsBtn.addEventListener('click', clearCredentials);
  }

  // Password visibility toggle
  const togglePasswordBtn = document.getElementById('toggle-password-btn');
  const atsPasswordInput = document.getElementById('ats-password');
  if (togglePasswordBtn && atsPasswordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const type = atsPasswordInput.type === 'password' ? 'text' : 'password';
      atsPasswordInput.type = type;
      togglePasswordBtn.textContent = type === 'password' ? '👁️' : '🙈';
    });
  }

  // Tab switching
  document.querySelectorAll('.content-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Copy buttons
  const copyResumeBtn = document.getElementById('copy-resume-btn');
  if (copyResumeBtn) {
    copyResumeBtn.addEventListener('click', () => copyToClipboard('tailored-resume'));
  }

  const copyCoverBtn = document.getElementById('copy-cover-btn');
  if (copyCoverBtn) {
    copyCoverBtn.addEventListener('click', () => copyToClipboard('tailored-cover'));
  }

  // Download buttons
  const downloadResumeBtn = document.getElementById('download-resume-btn');
  if (downloadResumeBtn) {
    downloadResumeBtn.addEventListener('click', () => downloadAsPDF('resume'));
  }

  const downloadCoverBtn = document.getElementById('download-cover-btn');
  if (downloadCoverBtn) {
    downloadCoverBtn.addEventListener('click', () => downloadAsPDF('cover'));
  }

  // Dashboard button
  const openDashboardBtn = document.getElementById('open-dashboard-btn');
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: DASHBOARD_URL });
    });
  }

  // View queue button
  const viewQueueBtn = document.getElementById('view-queue-btn');
  if (viewQueueBtn) {
    viewQueueBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: `${DASHBOARD_URL}?tab=queue` });
    });
  }

  // Preview Match button
  const previewMatchBtn = document.getElementById('preview-match-btn');
  if (previewMatchBtn) {
    previewMatchBtn.addEventListener('click', handlePreviewMatch);
  }

  // Close preview button
  const closePreviewBtn = document.getElementById('close-preview-btn');
  if (closePreviewBtn) {
    closePreviewBtn.addEventListener('click', () => {
      const atsPreviewCard = document.getElementById('ats-preview-card');
      if (atsPreviewCard) atsPreviewCard.classList.add('hidden');
    });
  }

  // Proceed Apply button
  const proceedApplyBtn = document.getElementById('proceed-apply-btn');
  if (proceedApplyBtn) {
    proceedApplyBtn.addEventListener('click', () => {
      const atsPreviewCard = document.getElementById('ats-preview-card');
      if (atsPreviewCard) atsPreviewCard.classList.add('hidden');
      handleApplyWithAI();
    });
  }

  // Skip Job button
  const skipJobBtn = document.getElementById('skip-job-btn');
  if (skipJobBtn) {
    skipJobBtn.addEventListener('click', () => {
      const atsPreviewCard = document.getElementById('ats-preview-card');
      if (atsPreviewCard) atsPreviewCard.classList.add('hidden');
      showStatus('Job skipped', 'info');
    });
  }

  // Expand/Collapse results button
  const expandResultsBtn = document.getElementById('expand-results-btn');
  if (expandResultsBtn) {
    expandResultsBtn.addEventListener('click', () => {
      const expandedResults = document.getElementById('expanded-results');
      if (expandedResults) {
        expandedResults.classList.toggle('hidden');
        expandResultsBtn.textContent = expandedResults.classList.contains('hidden') ? '▼' : '▲';
      }
    });
  }

  // Queue header toggle (collapse/expand queue list)
  const queueHeader = document.getElementById('queue-header');
  if (queueHeader) {
    queueHeader.addEventListener('click', (e) => {
      // Don't toggle if clicking on buttons
      if (e.target.closest('button')) return;
      const queueList = document.getElementById('queue-list');
      if (queueList) queueList.classList.toggle('hidden');
    });
  }

  // Clear queue button
  const clearQueueBtn = document.getElementById('clear-queue-btn');
  if (clearQueueBtn) {
    clearQueueBtn.addEventListener('click', handleClearQueue);
  }

  // Pause batch button
  const pauseBatchBtn = document.getElementById('pause-batch-btn');
  if (pauseBatchBtn) {
    pauseBatchBtn.addEventListener('click', togglePauseBatch);
  }

  // Memory toggle
  const memoryToggle = document.getElementById('memory-toggle');
  if (memoryToggle) {
    memoryToggle.addEventListener('change', () => handleAutomationToggle('memoryEnabled', 'memory-toggle'));
  }

  // Clear memory button
  const clearMemoryBtn = document.getElementById('clear-memory-btn');
  if (clearMemoryBtn) {
    clearMemoryBtn.addEventListener('click', handleClearMemory);
  }

  // Speed multiplier buttons
  const speedButtons = document.querySelectorAll('.speed-btn');
  speedButtons.forEach(btn => {
    btn.addEventListener('click', () => handleSpeedButtonClick(btn));
  });

  // Generated PDFs section - Tab switching
  document.querySelectorAll('.pdf-tab').forEach(tab => {
    tab.addEventListener('click', () => switchPdfTab(tab.dataset.pdfTab));
  });

  // Preview PDFs button - opens modal
  const previewPdfsBtn = document.getElementById('preview-pdfs-btn');
  if (previewPdfsBtn) {
    previewPdfsBtn.addEventListener('click', () => openPdfModal('resume'));
  }

  // Preview individual PDF buttons
  const previewResumePdfBtn = document.getElementById('preview-resume-pdf-btn');
  if (previewResumePdfBtn) {
    previewResumePdfBtn.addEventListener('click', () => previewPdf('resume'));
  }

  const previewCoverPdfBtn = document.getElementById('preview-cover-pdf-btn');
  if (previewCoverPdfBtn) {
    previewCoverPdfBtn.addEventListener('click', () => previewPdf('cover'));
  }

  // Download PDF buttons
  const downloadResumePdfBtn = document.getElementById('download-resume-pdf-btn');
  if (downloadResumePdfBtn) {
    downloadResumePdfBtn.addEventListener('click', () => downloadGeneratedPdf('resume'));
  }

  const downloadCoverPdfBtn = document.getElementById('download-cover-pdf-btn');
  if (downloadCoverPdfBtn) {
    downloadCoverPdfBtn.addEventListener('click', () => downloadGeneratedPdf('cover'));
  }

  // Copy content button
  const copyContentBtn = document.getElementById('copy-content-btn');
  if (copyContentBtn) {
    copyContentBtn.addEventListener('click', copyCurrentPdfContent);
  }

  // PDF Preview Modal events
  const closePdfModalBtn = document.getElementById('close-pdf-modal-btn');
  if (closePdfModalBtn) {
    closePdfModalBtn.addEventListener('click', closePdfModal);
  }

  // Modal tab switching
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => switchModalTab(tab.dataset.modalTab));
  });

  // Modal action buttons
  const modalCopyBtn = document.getElementById('modal-copy-btn');
  if (modalCopyBtn) {
    modalCopyBtn.addEventListener('click', () => copyCurrentPdfContent());
  }

  const modalDownloadBtn = document.getElementById('modal-download-btn');
  if (modalDownloadBtn) {
    modalDownloadBtn.addEventListener('click', () => downloadAsPDF(currentPdfTab));
  }

  // Close modal on overlay click
  const pdfModal = document.getElementById('pdf-preview-modal');
  if (pdfModal) {
    pdfModal.addEventListener('click', (e) => {
      if (e.target === pdfModal) closePdfModal();
    });
  }

  // Load queue progress on init
  loadQueueProgress();
}

// Speed multiplier info for UI
const SPEED_MULTIPLIER_INFO = {
  1: { timing: '~90-120s/job', note: 'Safest for anti-bot' },
  1.5: { timing: '~60-80s/job', note: 'Good balance' },
  2: { timing: '~45-60s/job', note: 'Higher ban risk' },
  3: { timing: '~30-45s/job', note: 'Use with proxies' }
};

// Handle speed button click
async function handleSpeedButtonClick(selectedBtn) {
  const speed = parseFloat(selectedBtn.dataset.speed);
  
  // Update button active states
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  selectedBtn.classList.add('active');
  
  // Update info display
  const speedInfo = document.getElementById('speed-info');
  if (speedInfo) {
    const info = SPEED_MULTIPLIER_INFO[speed] || SPEED_MULTIPLIER_INFO[1];
    speedInfo.innerHTML = `
      <span class="speed-timing">${info.timing}</span>
      <span class="speed-note">${info.note}</span>
    `;
  }
  
  // Save to storage
  await chrome.storage.local.set({ speedMultiplier: speed });
  
  // Notify content script
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SPEED_CHANGED', speed }, () => {
        // Ignore chrome.runtime.lastError - content script may not be loaded
        if (chrome.runtime.lastError) {
          console.log('Speed change: content script not available');
        }
      });
    }
  } catch (e) {
    // Ignore if content script not ready
  }
}
// Load saved connection
async function loadConnection() {
  try {
    const data = await chrome.storage.local.get(['userProfile', 'accessToken']);
    
    if (data.accessToken && data.userProfile) {
      userProfile = data.userProfile;
      showConnectedState(userProfile);
      detectCurrentJob();
    } else {
      showNotConnectedState();
    }
  } catch (e) {
    console.error('Load connection error:', e);
    showNotConnectedState();
  }
}

// Load ATS credentials
async function loadCredentials() {
  try {
    const data = await chrome.storage.local.get(['atsCredentials']);
    const atsEmailInput = document.getElementById('ats-email');
    const atsPasswordInput = document.getElementById('ats-password');
    
    if (data.atsCredentials && atsEmailInput && atsPasswordInput) {
      atsEmailInput.value = data.atsCredentials.email || '';
      atsPasswordInput.value = data.atsCredentials.password || '';
    }
  } catch (e) {
    console.error('Load credentials error:', e);
  }
}

// Load job queue
async function loadJobQueue() {
  try {
    const data = await chrome.storage.local.get(['jobQueue']);
    jobQueue = data.jobQueue || [];
    updateQueueDisplay();
  } catch (e) {
    console.error('Load queue error:', e);
  }
}

// Load automation settings
async function loadAutomationSettings() {
  try {
    const data = await chrome.storage.local.get([
      'autofillEnabled', 
      'smartApplyEnabled', 
      'autoSubmitEnabled', 
      'autoNavigateEnabled',
      'speedMultiplier'
    ]);
    
    const autofillToggle = document.getElementById('autofill-toggle');
    const smartApplyToggle = document.getElementById('smartapply-toggle');
    const autoSubmitToggle = document.getElementById('autosubmit-toggle');
    const autoNavigateToggle = document.getElementById('autonavigate-toggle');
    
    if (autofillToggle) autofillToggle.checked = data.autofillEnabled !== false;
    if (smartApplyToggle) smartApplyToggle.checked = data.smartApplyEnabled !== false;
    if (autoSubmitToggle) autoSubmitToggle.checked = data.autoSubmitEnabled === true;
    if (autoNavigateToggle) autoNavigateToggle.checked = data.autoNavigateEnabled !== false;
    
    // Load speed multiplier (default 1x)
    const speedMultiplier = data.speedMultiplier || 1;
    const speedButtons = document.querySelectorAll('.speed-btn');
    speedButtons.forEach(btn => {
      const btnSpeed = parseFloat(btn.dataset.speed);
      btn.classList.toggle('active', btnSpeed === speedMultiplier);
    });
    
    // Update speed info display
    const speedInfo = document.getElementById('speed-info');
    if (speedInfo) {
      const info = SPEED_MULTIPLIER_INFO[speedMultiplier] || SPEED_MULTIPLIER_INFO[1];
      speedInfo.innerHTML = `
        <span class="speed-timing">${info.timing}</span>
        <span class="speed-note">${info.note}</span>
      `;
    }
    
    updateAutofillUI(data.autofillEnabled !== false);
  } catch (e) {
    console.error('Load automation settings error:', e);
  }
}
async function handleAutomationToggle(settingName, toggleId) {
  const toggle = document.getElementById(toggleId);
  if (!toggle) return;
  
  const enabled = toggle.checked;
  await chrome.storage.local.set({ [settingName]: enabled });
  
  const labels = {
    autofillEnabled: 'Auto-fill',
    smartApplyEnabled: 'Smart Apply',
    autoSubmitEnabled: 'Auto-submit',
    autoNavigateEnabled: 'Auto-navigate'
  };
  
  showStatus(`${labels[settingName]} ${enabled ? 'enabled' : 'disabled'}`, 'info');
}

// Handle auto-fill toggle
async function handleAutofillToggle() {
  const autofillToggle = document.getElementById('autofill-toggle');
  const enabled = autofillToggle ? autofillToggle.checked : true;
  await chrome.storage.local.set({ autofillEnabled: enabled });
  updateAutofillUI(enabled);
  showStatus(enabled ? 'Auto-fill enabled' : 'Auto-fill disabled', 'info');
}

// Update UI based on auto-fill setting
function updateAutofillUI(enabled) {
  const toggleLabel = document.querySelector('.toggle-label');
  if (toggleLabel) {
    toggleLabel.textContent = enabled ? '⚡ Auto-Fill Enabled' : '⚡ Auto-Fill Disabled';
  }
}

// Show status message
function showStatus(message, type = 'info') {
  const statusMessage = document.getElementById('status-message');
  if (!statusMessage) return;
  
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.classList.remove('hidden');
  
  setTimeout(() => {
    statusMessage.classList.add('hidden');
  }, 4000);
}

// Show connected state
function showConnectedState(profile) {
  const notConnectedSection = document.getElementById('not-connected');
  const connectedSection = document.getElementById('connected');
  
  if (notConnectedSection) notConnectedSection.classList.add('hidden');
  if (connectedSection) connectedSection.classList.remove('hidden');
  
  // Update profile display
  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User';
  
  const profileName = document.getElementById('profile-name');
  const profileEmail = document.getElementById('profile-email');
  const avatar = document.getElementById('avatar');
  
  if (profileName) profileName.textContent = name;
  if (profileEmail) profileEmail.textContent = profile.email || '';
  
  // Avatar initials
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  if (avatar) avatar.textContent = initials || 'U';
  
  // Stats
  const skills = profile.skills || [];
  const skillsCount = document.getElementById('skills-count');
  const expYears = document.getElementById('exp-years');
  const certsCount = document.getElementById('certs-count');
  
  if (skillsCount) skillsCount.textContent = Array.isArray(skills) ? skills.length : 0;
  if (expYears) expYears.textContent = profile.total_experience || '0';
  if (certsCount) certsCount.textContent = (profile.certifications || []).length;
}

// Show not connected state
function showNotConnectedState() {
  const notConnectedSection = document.getElementById('not-connected');
  const connectedSection = document.getElementById('connected');
  
  if (notConnectedSection) notConnectedSection.classList.remove('hidden');
  if (connectedSection) connectedSection.classList.add('hidden');
}

// Handle connect
async function handleConnect(e) {
  e.preventDefault();
  
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const connectBtn = document.getElementById('connect-btn');
  
  const email = emailInput?.value?.trim();
  const password = passwordInput?.value;
  
  if (!email || !password) {
    showStatus('Please enter email and password', 'error');
    return;
  }
  
  if (connectBtn) {
    connectBtn.disabled = true;
    connectBtn.innerHTML = '<span class="btn-icon">⏳</span> Connecting...';
  }
  
  try {
    // Authenticate with Supabase
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({ email, password }),
    });
    
    if (!authResponse.ok) {
      throw new Error('Invalid credentials');
    }
    
    const authData = await authResponse.json();
    
    // Fetch profile
    const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${authData.user.id}&select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${authData.access_token}`,
      },
    });
    
    const profiles = await profileResponse.json();
    const profile = profiles[0] || { email: authData.user.email };
    
    // Calculate token expiry
    const tokenExpiry = Date.now() + (authData.expires_in || 3600) * 1000;
    
    // Save to storage
    await chrome.storage.local.set({
      accessToken: authData.access_token,
      refreshToken: authData.refresh_token,
      tokenExpiry: tokenExpiry,
      userProfile: profile,
      userId: authData.user.id,
    });
    
    userProfile = profile;
    showConnectedState(profile);
    detectCurrentJob();
    showStatus('Connected successfully!', 'success');
    
  } catch (error) {
    console.error('Connection error:', error);
    showStatus(error.message || 'Failed to connect', 'error');
  } finally {
    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.innerHTML = '<span class="btn-icon">🚀</span> Connect Account';
    }
  }
}

// Handle disconnect
async function handleDisconnect() {
  await chrome.storage.local.remove(['accessToken', 'refreshToken', 'tokenExpiry', 'userProfile', 'userId']);
  userProfile = null;
  currentJob = null;
  showNotConnectedState();
  showStatus('Disconnected', 'info');
}

// Refresh profile
async function refreshProfile() {
  const refreshBtn = document.getElementById('refresh-btn');
  
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<span class="btn-icon">⏳</span> Refreshing...';
  }
  
  try {
    const data = await chrome.storage.local.get(['accessToken', 'userId']);
    
    if (!data.accessToken) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${data.userId}&select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${data.accessToken}`,
      },
    });
    
    const profiles = await response.json();
    const profile = profiles[0];
    
    if (profile) {
      await chrome.storage.local.set({ userProfile: profile });
      userProfile = profile;
      showConnectedState(profile);
      showStatus('Profile refreshed!', 'success');
    }
  } catch (error) {
    console.error('Refresh error:', error);
    showStatus('Failed to refresh profile', 'error');
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<span class="btn-icon">🔄</span> Refresh Profile';
    }
  }
}

// Save ATS credentials
async function saveCredentials() {
  const atsEmailInput = document.getElementById('ats-email');
  const atsPasswordInput = document.getElementById('ats-password');
  
  const email = atsEmailInput?.value?.trim() || '';
  const password = atsPasswordInput?.value || '';
  
  await chrome.storage.local.set({
    atsCredentials: { email, password }
  });
  
  showStatus('ATS credentials saved locally', 'success');
}

// Clear ATS credentials
async function clearCredentials() {
  await chrome.storage.local.remove(['atsCredentials']);
  
  const atsEmailInput = document.getElementById('ats-email');
  const atsPasswordInput = document.getElementById('ats-password');
  
  if (atsEmailInput) atsEmailInput.value = '';
  if (atsPasswordInput) atsPasswordInput.value = '';
  
  showStatus('ATS credentials cleared', 'info');
}

// Update queue display
function updateQueueDisplay() {
  const queueCountEl = document.getElementById('queue-count');
  const queueStatus = document.getElementById('queue-status');
  const queueList = document.getElementById('queue-list');
  const batchApplyBtn = document.getElementById('batch-apply-btn');
  
  if (queueCountEl) queueCountEl.textContent = jobQueue.length;
  if (queueStatus) queueStatus.classList.toggle('hidden', jobQueue.length === 0);
  if (batchApplyBtn) batchApplyBtn.disabled = jobQueue.length === 0;
  
  // Render queue list
  if (queueList) {
    if (jobQueue.length === 0) {
      queueList.innerHTML = '<div class="queue-empty">No jobs in queue</div>';
    } else {
      queueList.innerHTML = jobQueue.map((job, index) => `
        <div class="queue-item" data-index="${index}">
          <div class="queue-item-info">
            <span class="queue-item-title">${job.title}</span>
            <span class="queue-item-company">${job.company}</span>
          </div>
          <button class="queue-item-remove" data-index="${index}" title="Remove">✕</button>
        </div>
      `).join('');
      
      // Add remove handlers
      queueList.querySelectorAll('.queue-item-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const index = parseInt(btn.dataset.index);
          jobQueue.splice(index, 1);
          await chrome.storage.local.set({ jobQueue });
          updateQueueDisplay();
          showStatus('Job removed from queue', 'info');
        });
      });
    }
  }
}

// Detect ATS from URL
function detectATS(url) {
  if (!url) return 'Unknown';
  
  const atsMap = {
    'greenhouse.io': 'Greenhouse',
    'lever.co': 'Lever',
    'workday.com': 'Workday',
    'myworkdayjobs.com': 'Workday',
    'ashbyhq.com': 'Ashby',
    'icims.com': 'iCIMS',
    'smartrecruiters.com': 'SmartRecruiters',
    'jobvite.com': 'Jobvite',
    'bamboohr.com': 'BambooHR',
    'recruitee.com': 'Recruitee',
    'breezy.hr': 'Breezy',
  };
  
  for (const [domain, name] of Object.entries(atsMap)) {
    if (url.includes(domain)) return name;
  }
  
  return 'ATS';
}

// Detect current job on page
async function detectCurrentJob() {
  const jobDetails = document.getElementById('job-details');
  const atsBadge = document.getElementById('ats-badge');
  const applyNowBtn = document.getElementById('apply-now-btn');
  const addQueueBtn = document.getElementById('add-queue-btn');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id) {
      if (jobDetails) jobDetails.innerHTML = '<span class="no-job">No job detected</span>';
      if (applyNowBtn) applyNowBtn.disabled = true;
      if (addQueueBtn) addQueueBtn.disabled = true;
      return;
    }
    
    // Detect ATS type
    const atsType = detectATS(tab.url);
    if (atsBadge) atsBadge.textContent = atsType;
    
    // Skip job boards
    if (tab.url?.includes('linkedin.com') || tab.url?.includes('indeed.com')) {
      if (jobDetails) jobDetails.innerHTML = '<span class="no-job">Open a company job page to apply</span>';
      if (applyNowBtn) applyNowBtn.disabled = true;
      if (addQueueBtn) addQueueBtn.disabled = true;
      return;
    }
    
    // Send message to content script to extract job
    // Use try-catch and check lastError to prevent "Receiving end does not exist" errors
    try {
      chrome.tabs.sendMessage(tab.id, { action: 'extractJob' }, (response) => {
        // Must check lastError to prevent uncaught errors
        if (chrome.runtime.lastError) {
          console.log('Content script not loaded:', chrome.runtime.lastError.message);
          if (jobDetails) jobDetails.innerHTML = '<span class="no-job">No job detected on this page</span>';
          if (applyNowBtn) applyNowBtn.disabled = true;
          if (addQueueBtn) addQueueBtn.disabled = true;
          return;
        }
        
        if (!response) {
          if (jobDetails) jobDetails.innerHTML = '<span class="no-job">No job detected on this page</span>';
          if (applyNowBtn) applyNowBtn.disabled = true;
          if (addQueueBtn) addQueueBtn.disabled = true;
          return;
        }
        
        currentJob = response;
        updateJobCard(response);
      });
    } catch (e) {
      console.log('Failed to send message to content script:', e);
      if (jobDetails) jobDetails.innerHTML = '<span class="no-job">No job detected on this page</span>';
      if (applyNowBtn) applyNowBtn.disabled = true;
      if (addQueueBtn) addQueueBtn.disabled = true;
    }
    
  } catch (error) {
    console.error('Job detection error:', error);
    if (jobDetails) jobDetails.innerHTML = '<span class="no-job">Unable to detect job</span>';
    if (applyNowBtn) applyNowBtn.disabled = true;
    if (addQueueBtn) addQueueBtn.disabled = true;
  }
}

// Update job card display
function updateJobCard(job) {
  const jobDetails = document.getElementById('job-details');
  const jobActions = document.getElementById('job-actions');
  const applyNowBtn = document.getElementById('apply-now-btn');
  const addQueueBtn = document.getElementById('add-queue-btn');
  
  if (!job || job.title === 'Unknown Position') {
    if (jobDetails) jobDetails.innerHTML = '<span class="no-job">No job detected on this page</span>';
    if (jobActions) jobActions.style.display = 'none';
    if (applyNowBtn) applyNowBtn.disabled = true;
    if (addQueueBtn) addQueueBtn.disabled = true;
    return;
  }
  
  if (jobDetails) {
    jobDetails.innerHTML = `
      <div class="job-title">${job.title}</div>
      <div class="job-company">${job.company}</div>
      ${job.location ? `<div class="job-location">📍 ${job.location}</div>` : ''}
    `;
  }
  
  // Show job actions (Preview Match button)
  if (jobActions) jobActions.style.display = 'flex';
  
  if (applyNowBtn) applyNowBtn.disabled = false;
  if (addQueueBtn) addQueueBtn.disabled = false;
}

// Handle Add to Queue
async function handleAddToQueue() {
  if (!currentJob) {
    showStatus('No job detected', 'error');
    return;
  }
  
  // Check if already in queue
  const exists = jobQueue.some(j => j.url === currentJob.url);
  if (exists) {
    showStatus('Job already in queue', 'info');
    return;
  }
  
  // Add to queue
  const queueItem = {
    ...currentJob,
    addedAt: new Date().toISOString(),
    status: 'queued'
  };
  
  jobQueue.push(queueItem);
  await chrome.storage.local.set({ jobQueue });
  
  updateQueueDisplay();
  showStatus(`Added "${currentJob.title}" to queue!`, 'success');
  
  // Also save to Supabase if connected
  try {
    const data = await chrome.storage.local.get(['accessToken', 'userId']);
    if (data.accessToken && data.userId) {
      await fetch(`${SUPABASE_URL}/rest/v1/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${data.accessToken}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          user_id: data.userId,
          title: currentJob.title,
          company: currentJob.company,
          location: currentJob.location || '',
          url: currentJob.url,
          description: currentJob.description?.substring(0, 5000) || '',
          requirements: currentJob.requirements || [],
          platform: currentJob.ats || 'Unknown',
          status: 'pending'
        })
      });
    }
  } catch (err) {
    console.log('Failed to sync to cloud, but saved locally');
  }
}

// Main action: Apply with AI
async function handleApplyWithAI() {
  const progressSection = document.getElementById('progress-section');
  const resultsSection = document.getElementById('results-section');
  const applyNowBtn = document.getElementById('apply-now-btn');
  
  if (!currentJob || !userProfile) {
    showStatus('No job detected or profile not loaded', 'error');
    return;
  }
  
  // Show progress section
  if (progressSection) progressSection.classList.remove('hidden');
  if (resultsSection) resultsSection.classList.add('hidden');
  
  if (applyNowBtn) {
    applyNowBtn.disabled = true;
    const actionTitle = applyNowBtn.querySelector('.action-title');
    if (actionTitle) actionTitle.textContent = 'Processing...';
  }
  
  try {
    // Step 1: Extracting job details
    updateProgress(1, 25);
    showStatus('Extracting job details...', 'info');
    await delay(300);
    
    // Step 2: Analyzing ATS keywords
    updateProgress(2, 50);
    showStatus('Analyzing ATS keywords...', 'info');
    await delay(200);
    
    // Step 3: Tailoring resume & cover letter
    updateProgress(3, 70);
    showStatus('Tailoring resume & cover letter with AI...', 'info');
    
    const data = await chrome.storage.local.get(['accessToken']);
    
    if (!data.accessToken) {
      throw new Error('Not authenticated. Please reconnect your account.');
    }
    
    // Call the tailor-application edge function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/tailor-application`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.accessToken}`,
      },
      body: JSON.stringify({
        jobTitle: currentJob.title,
        company: currentJob.company,
        description: currentJob.description || '',
        requirements: currentJob.requirements || [],
        location: currentJob.location || '',
        userProfile: {
          firstName: userProfile.first_name,
          lastName: userProfile.last_name,
          email: userProfile.email,
          phone: userProfile.phone,
          linkedin: userProfile.linkedin,
          github: userProfile.github,
          portfolio: userProfile.portfolio,
          coverLetter: userProfile.cover_letter || '',
          workExperience: userProfile.work_experience || [],
          education: userProfile.education || [],
          skills: userProfile.skills || [],
          certifications: userProfile.certifications || [],
          achievements: userProfile.achievements || [],
          atsStrategy: userProfile.ats_strategy || 'Match keywords exactly from job description',
          city: userProfile.city,
          state: userProfile.state,
          country: userProfile.country,
          address: userProfile.address,
          zipCode: userProfile.zip_code,
        },
        includeReferral: false,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error('Session expired. Please reconnect your account.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait and try again.');
      }
      if (response.status === 402) {
        throw new Error('AI credits exhausted. Please add more credits.');
      }
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log('QuantumHire: Tailored application received', { matchScore: result.matchScore });
    
    // Step 4: Generate PDFs and Auto-fill
    updateProgress(4, 85);
    showStatus('Generating PDFs & auto-filling...', 'info');
    
    // Check if auto-fill is enabled
    const settingsData = await chrome.storage.local.get(['autofillEnabled', 'atsCredentials']);
    const autofillEnabled = settingsData.autofillEnabled !== false;
    
    if (autofillEnabled) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        try {
          // Send autofill message with tailored data - the content script will handle PDF generation
          const autofillResponse = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Autofill timed out after 60 seconds'));
            }, 60000);
            
            chrome.tabs.sendMessage(tab.id, {
              action: 'autofill',
              tailoredData: result,
              atsCredentials: settingsData.atsCredentials || null,
              options: { generatePdfs: true }
            }, (response) => {
              clearTimeout(timeout);
              if (chrome.runtime.lastError) {
                console.warn('Autofill communication error:', chrome.runtime.lastError);
                // Don't reject - we still have the tailored content
                resolve({ success: false, error: chrome.runtime.lastError.message });
              } else {
                console.log('QuantumHire: Autofill response', response);
                resolve(response || { success: true });
              }
            });
          });
          
          if (autofillResponse?.pdfUploads) {
            console.log('QuantumHire: PDF uploads result:', autofillResponse.pdfUploads);
          }
        } catch (autofillError) {
          console.warn('Autofill error (non-fatal):', autofillError);
          // Don't throw - we still have the tailored content
        }
      }
    }
    
    // Complete progress
    updateProgress(4, 100);
    await delay(400);
    
    // Show results
    displayResults(result);
    const statusMsg = autofillEnabled 
      ? '✅ Application tailored and form filled!' 
      : '✅ Application tailored! (Auto-fill disabled)';
    showStatus(statusMsg, 'success');
    
  } catch (error) {
    console.error('Apply error:', error);
    showStatus(`❌ ${error.message || 'Failed to process application'}`, 'error');
    if (progressSection) progressSection.classList.add('hidden');
  } finally {
    if (applyNowBtn) {
      applyNowBtn.disabled = false;
      const actionTitle = applyNowBtn.querySelector('.action-title');
      if (actionTitle) actionTitle.textContent = 'Apply with AI';
    }
  }
}

// Update progress display
function updateProgress(step, percent) {
  const progressFill = document.getElementById('progress-fill');
  if (progressFill) progressFill.style.width = `${percent}%`;
  
  for (let i = 1; i <= 4; i++) {
    const stepEl = document.getElementById(`step-${i}`);
    if (stepEl) {
      stepEl.classList.remove('active', 'complete');
      
      if (i < step) {
        stepEl.classList.add('complete');
      } else if (i === step) {
        stepEl.classList.add('active');
      }
    }
  }
}

// Display results
function displayResults(result) {
  const progressSection = document.getElementById('progress-section');
  const resultsSection = document.getElementById('results-section');
  const expandedResults = document.getElementById('expanded-results');
  const expandResultsBtn = document.getElementById('expand-results-btn');
  
  if (progressSection) progressSection.classList.add('hidden');
  if (resultsSection) resultsSection.classList.remove('hidden');
  
  // Auto-expand results when content is available
  if (expandedResults) expandedResults.classList.remove('hidden');
  if (expandResultsBtn) expandResultsBtn.textContent = '▲';
  
  // Update match score
  const score = result.matchScore || 0;
  const matchCircle = document.getElementById('match-circle');
  const matchScoreText = document.getElementById('match-score-text');
  
  if (matchCircle) matchCircle.setAttribute('stroke-dasharray', `${score}, 100`);
  if (matchScoreText) matchScoreText.textContent = `${score}%`;
  
  // Update keywords matched
  const keywordsMatched = result.keywordsMatched || [];
  const keywordsMatchedEl = document.getElementById('keywords-matched');
  if (keywordsMatchedEl) keywordsMatchedEl.textContent = `${keywordsMatched.length} keywords matched`;
  
  // Display keyword tags
  const keywordsList = document.getElementById('keywords-list');
  if (keywordsList) {
    keywordsList.innerHTML = '';
    
    keywordsMatched.slice(0, 10).forEach(keyword => {
      const tag = document.createElement('span');
      tag.className = 'keyword-tag matched';
      tag.textContent = keyword;
      keywordsList.appendChild(tag);
    });
    
    const keywordsMissing = result.keywordsMissing || [];
    keywordsMissing.slice(0, 5).forEach(keyword => {
      const tag = document.createElement('span');
      tag.className = 'keyword-tag missing';
      tag.textContent = keyword;
      keywordsList.appendChild(tag);
    });
  }
  
  // Display tailored content in textareas
  const tailoredResume = document.getElementById('tailored-resume');
  const tailoredCover = document.getElementById('tailored-cover');
  
  const resumeContent = result.tailoredResume || '';
  const coverContent = result.tailoredCoverLetter || '';
  
  if (tailoredResume) {
    tailoredResume.value = resumeContent;
    // Trigger input event to ensure content is rendered
    tailoredResume.dispatchEvent(new Event('input'));
  }
  if (tailoredCover) {
    tailoredCover.value = coverContent;
    tailoredCover.dispatchEvent(new Event('input'));
  }
  
  // Make sure Resume tab is active and visible
  switchTab('resume');
  
  // Show Generated PDFs section
  const userName = userProfile?.first_name && userProfile?.last_name 
    ? `${userProfile.first_name}${userProfile.last_name}`
    : 'User';
  showGeneratedPdfs(resumeContent, coverContent, userName);
  
  // Display suggestions
  const suggestions = result.suggestedImprovements || [];
  const suggestionsSection = document.getElementById('suggestions-section');
  const suggestionsList = document.getElementById('suggestions-list');
  
  if (suggestionsList) suggestionsList.innerHTML = '';
  
  if (suggestions.length > 0 && suggestionsSection && suggestionsList) {
    suggestionsSection.classList.remove('hidden');
    suggestions.forEach(suggestion => {
      const li = document.createElement('li');
      li.textContent = suggestion;
      suggestionsList.appendChild(li);
    });
  } else if (suggestionsSection) {
    suggestionsSection.classList.add('hidden');
  }
  
  console.log('QuantumHire: Results displayed', {
    hasResume: resumeContent.length > 0,
    hasCover: coverContent.length > 0,
    matchScore: score
  });
}

// Switch content tabs
function switchTab(tabName) {
  document.querySelectorAll('.content-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  const resumePane = document.getElementById('resume-pane');
  const coverPane = document.getElementById('cover-pane');
  
  if (resumePane) resumePane.classList.toggle('active', tabName === 'resume');
  if (coverPane) coverPane.classList.toggle('active', tabName !== 'resume');
}

// Copy to clipboard
async function copyToClipboard(elementId) {
  const textarea = document.getElementById(elementId);
  const btnId = elementId.includes('resume') ? 'copy-resume-btn' : 'copy-cover-btn';
  const btn = document.getElementById(btnId);
  
  try {
    await navigator.clipboard.writeText(textarea?.value || '');
    if (btn) {
      btn.innerHTML = '<span class="btn-icon">✅</span> Copied!';
      setTimeout(() => {
        btn.innerHTML = '<span class="btn-icon">📋</span> Copy';
      }, 2000);
    }
  } catch (error) {
    showStatus('Failed to copy', 'error');
  }
}

// Download as PDF - improved with actual PDF generation
async function downloadAsPDF(type) {
  const content = type === 'resume' 
    ? document.getElementById('tailored-resume')?.value 
    : document.getElementById('tailored-cover')?.value;
  
  if (!content) {
    showStatus('No content to download', 'error');
    return;
  }
  
  const btn = document.getElementById(type === 'resume' ? 'download-resume-btn' : 'download-cover-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Generating...';
  }
  
  try {
    const firstName = (userProfile?.first_name || 'User').replace(/\s+/g, '');
    const lastName = (userProfile?.last_name || '').replace(/\s+/g, '');
    const companyName = (currentJob?.company || 'Company').replace(/[^a-zA-Z0-9]/g, '');
    const fileType = type === 'resume' ? 'CV' : 'CoverLetter';
    const fileName = `${firstName}${lastName}_${companyName}_${fileType}.pdf`;
    
    // Call the PDF generation endpoint
    const data = await chrome.storage.local.get(['accessToken']);
    
    const requestBody = {
      type: type === 'resume' ? 'resume' : 'cover_letter',
      personalInfo: {
        name: `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || 'Applicant',
        email: userProfile?.email || '',
        phone: userProfile?.phone || '',
        location: currentJob?.location || userProfile?.city || '',
        linkedin: userProfile?.linkedin || '',
        github: userProfile?.github || '',
        portfolio: userProfile?.portfolio || ''
      },
      fileName: fileName
    };
    
    if (type === 'resume') {
      // Extract summary from content
      requestBody.summary = content.substring(0, 500);
      
      // Parse experience from profile
      const workExp = userProfile?.work_experience || [];
      requestBody.experience = workExp.map(exp => ({
        company: exp.company || '',
        title: exp.title || '',
        dates: exp.dates || `${exp.startDate || exp.start_date || ''} – ${exp.endDate || exp.end_date || 'Present'}`,
        bullets: Array.isArray(exp.description) ? exp.description : 
                 (typeof exp.description === 'string' ? exp.description.split('\n').filter(b => b.trim()) : [])
      }));
      
      // Parse education
      const education = userProfile?.education || [];
      requestBody.education = education.map(edu => ({
        degree: edu.degree || '',
        school: edu.school || edu.institution || '',
        dates: edu.dates || `${edu.startDate || ''} – ${edu.endDate || ''}`,
        gpa: edu.gpa || ''
      }));
      
      // Parse skills
      const skills = userProfile?.skills || [];
      if (Array.isArray(skills)) {
        const primarySkills = skills.filter(s => s.category === 'technical' || s.proficiency === 'expert' || s.proficiency === 'advanced');
        const secondarySkills = skills.filter(s => s.category !== 'technical' && s.proficiency !== 'expert' && s.proficiency !== 'advanced');
        requestBody.skills = {
          primary: primarySkills.map(s => s.name || s),
          secondary: secondarySkills.map(s => s.name || s)
        };
      }
      
      requestBody.certifications = userProfile?.certifications || [];
      
      // Parse achievements
      const achievements = userProfile?.achievements || [];
      requestBody.achievements = achievements.map(a => ({
        title: a.title || '',
        date: a.date || '',
        description: a.description || ''
      }));
    } else {
      const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 20);
      requestBody.coverLetter = {
        recipientCompany: currentJob?.company || 'Company',
        jobTitle: currentJob?.title || 'Position',
        jobId: currentJob?.jobId || '',
        paragraphs: paragraphs.length > 0 ? paragraphs : [content.trim()]
      };
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY
    };
    
    if (data.accessToken) {
      headers['Authorization'] = `Bearer ${data.accessToken}`;
    }
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-pdf`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.pdf) {
        // Create download link
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${result.pdf}`;
        link.download = result.fileName || fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showStatus(`✅ Downloaded: ${result.fileName}`, 'success');
        return;
      } else {
        console.log('QuantumHire: PDF generation returned error:', result.error);
      }
    } else {
      console.log('QuantumHire: PDF generation response not OK:', response.status);
    }
    
    // Fallback to print-based PDF
    console.log('QuantumHire: Falling back to print-based PDF');
    const title = type === 'resume' ? 'Tailored Resume' : 'Cover Letter';
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title}</title>
          <style>
            body {
              font-family: 'Times New Roman', serif;
              font-size: 11pt;
              line-height: 1.5;
              max-width: 8.5in;
              margin: 0.5in auto;
              padding: 0 0.5in;
              color: #000;
            }
            h1, h2, h3 { font-weight: bold; margin: 0.5em 0; }
            h1 { font-size: 16pt; text-align: center; }
            h2 { font-size: 12pt; border-bottom: 1px solid #000; padding-bottom: 2px; }
            p { margin: 0.5em 0; }
            ul { margin: 0.5em 0; padding-left: 1.5em; }
            li { margin: 0.25em 0; }
            @media print {
              body { margin: 0; padding: 0.5in; }
            }
          </style>
        </head>
        <body>
          <pre style="white-space: pre-wrap; font-family: inherit;">${content}</pre>
          <script>window.onload = function() { window.print(); };<\/script>
        </body>
        </html>
      `);
      printWindow.document.close();
      showStatus(`Opening ${title} for printing/PDF`, 'info');
    } else {
      showStatus('Please allow popups to download PDF', 'error');
    }
    
  } catch (error) {
    console.error('PDF download error:', error);
    showStatus('Failed to generate PDF', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-icon">⬇️</span> Download PDF';
    }
  }
}

// Utility: delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle Preview Match - show ATS preview before applying
async function handlePreviewMatch() {
  if (!currentJob || !userProfile) {
    showStatus('No job detected or profile not loaded', 'error');
    return;
  }

  const atsPreviewCard = document.getElementById('ats-preview-card');
  const previewMatchBtn = document.getElementById('preview-match-btn');
  
  if (previewMatchBtn) {
    previewMatchBtn.disabled = true;
    previewMatchBtn.innerHTML = '<span class="btn-icon">⏳</span> Analyzing...';
  }

  try {
    // Extract keywords from job description
    const jobText = `${currentJob.title} ${currentJob.description || ''} ${(currentJob.requirements || []).join(' ')}`.toLowerCase();
    
    // Get user skills
    const userSkills = (userProfile.skills || []).map(s => 
      typeof s === 'string' ? s.toLowerCase() : (s.name || '').toLowerCase()
    );
    
    // Common tech keywords to look for
    const techKeywords = [
      'python', 'javascript', 'react', 'node', 'sql', 'aws', 'docker', 'kubernetes',
      'typescript', 'java', 'c++', 'go', 'rust', 'machine learning', 'ai', 'ml',
      'data science', 'analytics', 'api', 'rest', 'graphql', 'agile', 'scrum',
      'leadership', 'management', 'communication', 'problem solving', 'teamwork'
    ];
    
    // Find matched and missing keywords
    const matchedKeywords = [];
    const missingKeywords = [];
    
    techKeywords.forEach(keyword => {
      if (jobText.includes(keyword)) {
        if (userSkills.some(skill => skill.includes(keyword) || keyword.includes(skill))) {
          matchedKeywords.push(keyword);
        } else {
          missingKeywords.push(keyword);
        }
      }
    });
    
    // Calculate match score
    const totalKeywords = matchedKeywords.length + missingKeywords.length;
    const matchScore = totalKeywords > 0 ? Math.round((matchedKeywords.length / totalKeywords) * 100) : 85;
    
    // Update preview UI
    const previewScoreCircle = document.getElementById('preview-score-circle');
    const previewScoreText = document.getElementById('preview-score-text');
    const matchedCount = document.getElementById('matched-count');
    const missingCount = document.getElementById('missing-count');
    const matchedKeywordsEl = document.getElementById('matched-keywords');
    const missingKeywordsEl = document.getElementById('missing-keywords');
    
    if (previewScoreCircle) previewScoreCircle.setAttribute('stroke-dasharray', `${matchScore}, 100`);
    if (previewScoreText) previewScoreText.textContent = `${matchScore}%`;
    if (matchedCount) matchedCount.textContent = matchedKeywords.length;
    if (missingCount) missingCount.textContent = missingKeywords.length;
    
    if (matchedKeywordsEl) {
      matchedKeywordsEl.innerHTML = matchedKeywords.slice(0, 8).map(k => 
        `<span class="keyword-chip matched">${k}</span>`
      ).join('') || '<span class="no-keywords">No matches found</span>';
    }
    
    if (missingKeywordsEl) {
      missingKeywordsEl.innerHTML = missingKeywords.slice(0, 5).map(k => 
        `<span class="keyword-chip missing">${k}</span>`
      ).join('') || '<span class="no-keywords">All keywords matched!</span>';
    }
    
    // Show preview card
    if (atsPreviewCard) atsPreviewCard.classList.remove('hidden');
    
  } catch (error) {
    console.error('Preview match error:', error);
    showStatus('Failed to analyze match', 'error');
  } finally {
    if (previewMatchBtn) {
      previewMatchBtn.disabled = false;
      previewMatchBtn.innerHTML = '<span class="btn-icon">📊</span> Preview Match';
    }
  }
}

// Clear job queue
async function handleClearQueue() {
  if (jobQueue.length === 0) {
    showStatus('Queue is already empty', 'info');
    return;
  }
  
  if (!confirm(`Clear all ${jobQueue.length} jobs from queue?`)) {
    return;
  }
  
  jobQueue = [];
  await chrome.storage.local.set({ jobQueue: [] });
  updateQueueDisplay();
  showStatus('Queue cleared', 'success');
}

// Toggle pause batch processing
let batchPaused = false;
function togglePauseBatch() {
  batchPaused = !batchPaused;
  const pauseBatchBtn = document.getElementById('pause-batch-btn');
  if (pauseBatchBtn) {
    pauseBatchBtn.textContent = batchPaused ? '▶️' : '⏸️';
    pauseBatchBtn.title = batchPaused ? 'Resume' : 'Pause';
  }
  showStatus(batchPaused ? 'Batch paused' : 'Batch resumed', 'info');
}

// Clear saved answer memory
async function handleClearMemory() {
  if (!confirm('Clear all saved answers? This cannot be undone.')) {
    return;
  }
  
  try {
    const data = await chrome.storage.local.get(['accessToken', 'userId']);
    
    if (data.accessToken && data.userId) {
      // Clear from Supabase
      await fetch(`${SUPABASE_URL}/rest/v1/user_memories?user_id=eq.${data.userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${data.accessToken}`,
        },
      });
    }
    
    // Update UI
    const savedAnswersCount = document.getElementById('saved-answers-count');
    if (savedAnswersCount) savedAnswersCount.textContent = '0';
    
    showStatus('Answer memory cleared', 'success');
  } catch (error) {
    console.error('Clear memory error:', error);
    showStatus('Failed to clear memory', 'error');
  }
}

// ============= BATCH AUTO-APPLY FUNCTIONS =============

async function handleBatchApply() {
  if (jobQueue.length === 0) {
    showStatus('No jobs in queue to process', 'error');
    return;
  }
  
  if (!userProfile) {
    showStatus('Profile not loaded. Please refresh.', 'error');
    return;
  }
  
  if (batchProcessing) {
    showStatus('Batch processing already in progress', 'info');
    return;
  }
  
  batchProcessing = true;
  batchCancelled = false;
  
  const batchSection = document.getElementById('batch-progress-section');
  const batchTotal = document.getElementById('batch-total');
  const batchCurrent = document.getElementById('batch-current');
  const batchProgressFill = document.getElementById('batch-progress-fill');
  const batchJobTitle = document.getElementById('batch-job-title');
  const batchLog = document.getElementById('batch-log');
  
  if (batchSection) batchSection.classList.remove('hidden');
  if (batchTotal) batchTotal.textContent = jobQueue.length;
  if (batchCurrent) batchCurrent.textContent = '0';
  if (batchProgressFill) batchProgressFill.style.width = '0%';
  if (batchLog) batchLog.innerHTML = '';
  
  addBatchLog('Starting batch auto-apply...', 'processing');
  
  const totalJobs = jobQueue.length;
  let processed = 0;
  let successful = 0;
  let failed = 0;
  
  for (let i = 0; i < jobQueue.length; i++) {
    if (batchCancelled) {
      addBatchLog('Batch cancelled by user', 'error');
      break;
    }
    
    const job = jobQueue[i];
    processed++;
    
    if (batchCurrent) batchCurrent.textContent = processed;
    if (batchProgressFill) batchProgressFill.style.width = `${(processed / totalJobs) * 100}%`;
    if (batchJobTitle) batchJobTitle.textContent = `${job.title} at ${job.company}`;
    
    addBatchLog(`Processing: ${job.title} at ${job.company}...`, 'processing');
    
    try {
      const result = await processBatchJob(job);
      
      if (result.success) {
        successful++;
        addBatchLog(`✓ ${job.company}: Applied successfully!`, 'success');
        job.status = 'applied';
        job.appliedAt = new Date().toISOString();
      } else {
        failed++;
        addBatchLog(`✗ ${job.company}: ${result.error || 'Failed'}`, 'error');
        job.status = 'failed';
        job.error = result.error;
      }
    } catch (error) {
      failed++;
      addBatchLog(`✗ ${job.company}: ${error.message}`, 'error');
      job.status = 'failed';
      job.error = error.message;
    }
    
    await chrome.storage.local.set({ jobQueue });
    
    if (i < jobQueue.length - 1 && !batchCancelled) {
      await delay(2000);
    }
  }
  
  batchProcessing = false;
  
  jobQueue = jobQueue.filter(j => j.status !== 'applied');
  await chrome.storage.local.set({ jobQueue });
  updateQueueDisplay();
  
  const summary = `Batch complete: ${successful} applied, ${failed} failed`;
  addBatchLog(summary, successful > 0 ? 'success' : 'error');
  showStatus(summary, successful > 0 ? 'success' : 'error');
  
  setTimeout(() => {
    if (!batchProcessing && batchSection) {
      batchSection.classList.add('hidden');
    }
  }, 5000);
}

function cancelBatchApply() {
  batchCancelled = true;
  batchProcessing = false;
  showStatus('Cancelling batch...', 'info');
}

async function processBatchJob(job) {
  try {
    const data = await chrome.storage.local.get(['accessToken', 'autofillEnabled', 'atsCredentials']);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/tailor-application`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.accessToken}`,
      },
      body: JSON.stringify({
        jobTitle: job.title,
        company: job.company,
        description: job.description || '',
        requirements: job.requirements || [],
        location: job.location || '',
        userProfile: {
          firstName: userProfile.first_name,
          lastName: userProfile.last_name,
          email: userProfile.email,
          phone: userProfile.phone,
          linkedin: userProfile.linkedin,
          github: userProfile.github,
          portfolio: userProfile.portfolio,
          coverLetter: userProfile.cover_letter || '',
          workExperience: userProfile.work_experience || [],
          education: userProfile.education || [],
          skills: userProfile.skills || [],
          certifications: userProfile.certifications || [],
          achievements: userProfile.achievements || [],
          atsStrategy: userProfile.ats_strategy || 'Match keywords exactly from job description',
          city: userProfile.city,
          country: userProfile.country,
        },
        includeReferral: false,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }
    
    const tailoredData = await response.json();
    
    if (job.url && data.autofillEnabled !== false) {
      return await openTabAndApply(job.url, tailoredData, data.atsCredentials);
    } else {
      return { success: true, message: 'Tailored (no auto-fill)' };
    }
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function openTabAndApply(url, tailoredData, atsCredentials) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'batchApplyToJob',
      url: url,
      tailoredData: tailoredData,
      atsCredentials: atsCredentials
    }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { success: true });
      }
    });
  });
}

function addBatchLog(message, type = 'info') {
  const batchLog = document.getElementById('batch-log');
  if (!batchLog) return;
  
  const logItem = document.createElement('div');
  logItem.className = `batch-log-item ${type}`;
  
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  logItem.innerHTML = `<span class="log-time">${time}</span> <span>${message}</span>`;
  
  batchLog.insertBefore(logItem, batchLog.firstChild);
  
  while (batchLog.children.length > 20) {
    batchLog.removeChild(batchLog.lastChild);
  }
}

// ============================================
// Generated PDFs Section Functions
// ============================================

// Current PDF tab state
let currentPdfTab = 'resume';
let generatedPdfContent = { resume: '', cover: '' };

// Switch PDF tab
function switchPdfTab(tab) {
  currentPdfTab = tab;
  
  // Update tab active states
  document.querySelectorAll('.pdf-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.pdfTab === tab);
  });
  
  // Update preview content
  updatePdfPreviewContent();
}

// Toggle PDF preview visibility
function togglePdfPreview() {
  const previewArea = document.getElementById('pdf-preview-area');
  if (!previewArea) return;
  
  const content = currentPdfTab === 'resume' ? generatedPdfContent.resume : generatedPdfContent.cover;
  
  if (content) {
    previewArea.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word; margin: 0; font-family: inherit;">${escapeHtml(content)}</pre>`;
  } else {
    previewArea.innerHTML = '<div class="pdf-preview-placeholder">No content generated yet. Apply to a job first.</div>';
  }
}

// Preview specific PDF
function previewPdf(type) {
  currentPdfTab = type;
  
  // Update tab UI
  document.querySelectorAll('.pdf-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.pdfTab === type);
  });
  
  togglePdfPreview();
}

// Update PDF preview content
function updatePdfPreviewContent() {
  const previewArea = document.getElementById('pdf-preview-area');
  if (!previewArea) return;
  
  const content = currentPdfTab === 'resume' ? generatedPdfContent.resume : generatedPdfContent.cover;
  
  if (content) {
    previewArea.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word; margin: 0; font-family: inherit;">${escapeHtml(content)}</pre>`;
  } else {
    previewArea.innerHTML = '<div class="pdf-preview-placeholder">No content generated yet.</div>';
  }
}

// Escape HTML for safe rendering
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Download generated PDF
async function downloadGeneratedPdf(type) {
  const content = type === 'resume' ? generatedPdfContent.resume : generatedPdfContent.cover;
  
  if (!content) {
    showStatus('No content to download. Apply to a job first.', 'error');
    return;
  }
  
  // Use the existing downloadAsPDF function
  await downloadAsPDF(type);
}

// Copy current PDF content
async function copyCurrentPdfContent() {
  const content = currentPdfTab === 'resume' ? generatedPdfContent.resume : generatedPdfContent.cover;
  
  if (!content) {
    showStatus('No content to copy', 'error');
    return;
  }
  
  try {
    await navigator.clipboard.writeText(content);
    showStatus(`${currentPdfTab === 'resume' ? 'Resume' : 'Cover letter'} copied!`, 'success');
  } catch (e) {
    console.error('Copy failed:', e);
    showStatus('Failed to copy', 'error');
  }
}

// Show generated PDFs section with content
function showGeneratedPdfs(resumeContent, coverContent, userName = 'User') {
  generatedPdfContent.resume = resumeContent || '';
  generatedPdfContent.cover = coverContent || '';
  
  const section = document.getElementById('generated-pdfs-section');
  if (section) {
    section.classList.remove('hidden');
  }
  
  // Update file names
  const resumeName = document.getElementById('resume-pdf-name');
  const coverName = document.getElementById('cover-pdf-name');
  
  if (resumeName) resumeName.textContent = `${userName.replace(/\s+/g, '')}_CV.pdf`;
  if (coverName) coverName.textContent = `${userName.replace(/\s+/g, '')}_CoverLetter.pdf`;
  
  // Estimate file sizes (rough estimate: 1KB per 1000 chars)
  const resumeSize = document.getElementById('resume-pdf-size');
  const coverSize = document.getElementById('cover-pdf-size');
  
  if (resumeSize) {
    const kb = Math.max(1, Math.round(resumeContent.length / 1000 * 1.5));
    resumeSize.textContent = `${kb} KB`;
  }
  
  if (coverSize) {
    const kb = Math.max(1, Math.round(coverContent.length / 1000 * 1.5));
    coverSize.textContent = `${kb} KB`;
  }
  
  // Update preview
  updatePdfPreviewContent();
}

// Hide generated PDFs section
function hideGeneratedPdfs() {
  const section = document.getElementById('generated-pdfs-section');
  if (section) {
    section.classList.add('hidden');
  }
  generatedPdfContent = { resume: '', cover: '' };
}

// ============================================
// PDF Preview Modal Functions
// ============================================

// Open PDF preview modal
function openPdfModal(type = 'resume') {
  currentPdfTab = type;
  const modal = document.getElementById('pdf-preview-modal');
  if (modal) {
    modal.classList.remove('hidden');
    updateModalTab(type);
    renderFormattedPdf(type);
  }
}

// Close PDF preview modal
function closePdfModal() {
  const modal = document.getElementById('pdf-preview-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Switch modal tab
function switchModalTab(tab) {
  currentPdfTab = tab;
  updateModalTab(tab);
  renderFormattedPdf(tab);
}

// Update modal tab UI
function updateModalTab(tab) {
  document.querySelectorAll('.modal-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.modalTab === tab);
  });
  
  const title = document.getElementById('pdf-modal-title');
  if (title) {
    title.textContent = tab === 'resume' ? '📄 Resume Preview' : '✉️ Cover Letter Preview';
  }
}

// Render formatted PDF content
function renderFormattedPdf(type) {
  const content = type === 'resume' ? generatedPdfContent.resume : generatedPdfContent.cover;
  const pageEl = document.getElementById('pdf-page-content');
  
  if (!pageEl) return;
  
  if (!content) {
    pageEl.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 40px;">No content generated yet. Apply to a job first.</div>';
    return;
  }
  
  if (type === 'resume') {
    pageEl.innerHTML = formatResumeHtml(content);
  } else {
    pageEl.innerHTML = formatCoverLetterHtml(content);
  }
}

// Format resume content as styled HTML
function formatResumeHtml(content) {
  const name = userProfile ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() : 'Applicant';
  const email = userProfile?.email || '';
  const phone = userProfile?.phone || '';
  const linkedin = userProfile?.linkedin || '';
  
  const contactParts = [email, phone, linkedin].filter(Boolean);
  
  // Parse sections from content
  const sections = parseResumeSections(content);
  
  let html = `
    <h1>${name}</h1>
    <div class="contact-line">${contactParts.join(' | ')}</div>
  `;
  
  if (sections.summary) {
    html += `<h2>Professional Summary</h2><p>${sections.summary}</p>`;
  }
  
  if (sections.experience) {
    html += `<h2>Experience</h2>${sections.experience}`;
  }
  
  if (sections.education) {
    html += `<h2>Education</h2>${sections.education}`;
  }
  
  if (sections.skills) {
    html += `<h2>Skills</h2><div class="skills-list">${sections.skills}</div>`;
  }
  
  return html;
}

// Parse resume sections from text
function parseResumeSections(content) {
  const lines = content.split('\n');
  const sections = { summary: '', experience: '', education: '', skills: '' };
  let currentSection = 'summary';
  let sectionContent = [];
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();
    
    if (lowerLine.includes('experience') || lowerLine.includes('employment')) {
      if (sectionContent.length) sections[currentSection] = sectionContent.join('<br>');
      currentSection = 'experience';
      sectionContent = [];
    } else if (lowerLine.includes('education')) {
      if (sectionContent.length) sections[currentSection] = sectionContent.join('<br>');
      currentSection = 'education';
      sectionContent = [];
    } else if (lowerLine.includes('skill')) {
      if (sectionContent.length) sections[currentSection] = sectionContent.join('<br>');
      currentSection = 'skills';
      sectionContent = [];
    } else if (line.trim()) {
      sectionContent.push(escapeHtml(line.trim()));
    }
  }
  
  if (sectionContent.length) sections[currentSection] = sectionContent.join('<br>');
  
  return sections;
}

// Format cover letter content as styled HTML
function formatCoverLetterHtml(content) {
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
  const company = currentJob?.company || 'Company';
  
  let html = '<div class="cover-letter-body">';
  
  paragraphs.forEach((para, idx) => {
    const trimmed = para.trim();
    if (idx === 0 && (trimmed.toLowerCase().startsWith('dear') || trimmed.toLowerCase().startsWith('to '))) {
      html += `<p class="salutation">${escapeHtml(trimmed)}</p>`;
    } else if (trimmed.toLowerCase().includes('sincerely') || trimmed.toLowerCase().includes('regards') || trimmed.toLowerCase().includes('best,')) {
      html += `<p class="closing">${escapeHtml(trimmed)}</p>`;
    } else {
      html += `<p>${escapeHtml(trimmed)}</p>`;
    }
  });
  
  html += '</div>';
  return html;
}

// Preview PDF (open modal)
function previewPdf(type) {
  openPdfModal(type);
}

// ============================================
// Queue Progress Functions
// ============================================

// Load and display queue progress
async function loadQueueProgress() {
  try {
    const data = await chrome.storage.local.get(['batchProgress', 'jobQueue']);
    
    const progress = data.batchProgress || { total: 0, current: 0, applied: 0, skipped: 0 };
    const queue = data.jobQueue || [];
    
    updateQueueProgressBar(progress, queue.length);
  } catch (e) {
    console.log('Failed to load queue progress:', e);
  }
}

// Update queue progress bar UI
function updateQueueProgressBar(progress, queueLength) {
  const bar = document.getElementById('queue-progress-bar');
  if (!bar) return;
  
  const remaining = queueLength;
  const total = progress.total || queueLength;
  const applied = progress.applied || 0;
  const skipped = progress.skipped || 0;
  
  if (remaining === 0 && applied === 0 && !batchProcessing) {
    bar.classList.add('hidden');
    return;
  }
  
  bar.classList.remove('hidden');
  
  const remainingEl = document.getElementById('queue-remaining');
  const appliedEl = document.getElementById('queue-applied');
  const skippedEl = document.getElementById('queue-skipped');
  const fillEl = document.getElementById('queue-mini-fill');
  
  if (remainingEl) remainingEl.textContent = remaining;
  if (appliedEl) appliedEl.textContent = applied;
  if (skippedEl) skippedEl.textContent = skipped;
  
  if (fillEl && total > 0) {
    const percent = ((applied + skipped) / total) * 100;
    fillEl.style.width = `${percent}%`;
  }
}

// Save and update batch progress
async function updateBatchProgress(applied, skipped, total) {
  const progress = { applied, skipped, total };
  await chrome.storage.local.set({ batchProgress: progress });
  
  const data = await chrome.storage.local.get(['jobQueue']);
  updateQueueProgressBar(progress, (data.jobQueue || []).length);
}

// Clear batch progress
async function clearBatchProgress() {
  await chrome.storage.local.remove('batchProgress');
  const bar = document.getElementById('queue-progress-bar');
  if (bar) bar.classList.add('hidden');
}
