// QuantumHire AI - Enhanced Background Service Worker v2.0
// State management, batch queue processing, platform routing

console.log('QuantumHire AI: Background service worker v2.0 started');

// ============= STATE MANAGEMENT =============

const AppState = {
  isProcessing: false,
  isPaused: false,
  currentSpeed: 1, // 1x, 1.5x, 2x, 3x
  batchQueue: [],
  currentBatchIndex: 0,
  sessionStats: {
    applied: 0,
    failed: 0,
    skipped: 0,
    startTime: null
  },
  activeTabs: new Map(), // tabId -> { status, jobData }
};

// Platform routing configuration
const PLATFORM_HANDLERS = {
  linkedin: {
    detect: (url) => url.includes('linkedin.com'),
    type: 'easy_apply',
    needsAuth: true
  },
  indeed: {
    detect: (url) => url.includes('indeed.com'),
    type: 'easy_apply',
    needsAuth: false
  },
  glassdoor: {
    detect: (url) => url.includes('glassdoor.com'),
    type: 'easy_apply',
    needsAuth: false
  },
  greenhouse: {
    detect: (url) => url.includes('greenhouse.io'),
    type: 'ats_form',
    needsAuth: false
  },
  lever: {
    detect: (url) => url.includes('lever.co'),
    type: 'ats_form',
    needsAuth: false
  },
  workday: {
    detect: (url) => url.includes('workday.com') || url.includes('myworkdayjobs.com'),
    type: 'ats_form',
    needsAuth: true
  },
  ashby: {
    detect: (url) => url.includes('ashbyhq.com'),
    type: 'ats_form',
    needsAuth: false
  },
  icims: {
    detect: (url) => url.includes('icims.com'),
    type: 'ats_form',
    needsAuth: true
  },
  smartrecruiters: {
    detect: (url) => url.includes('smartrecruiters.com'),
    type: 'ats_form',
    needsAuth: false
  },
  workable: {
    detect: (url) => url.includes('workable.com') || url.includes('apply.workable.com'),
    type: 'ats_form',
    needsAuth: false
  },
  dice: {
    detect: (url) => url.includes('dice.com'),
    type: 'easy_apply',
    needsAuth: true
  },
  ziprecruiter: {
    detect: (url) => url.includes('ziprecruiter.com'),
    type: 'easy_apply',
    needsAuth: true
  },
  monster: {
    detect: (url) => url.includes('monster.com'),
    type: 'easy_apply',
    needsAuth: true
  }
};

// Detect platform from URL
function detectPlatform(url) {
  for (const [name, config] of Object.entries(PLATFORM_HANDLERS)) {
    if (config.detect(url)) {
      return { name, ...config };
    }
  }
  return { name: 'generic', type: 'ats_form', needsAuth: false };
}

// ============= EXTENSION INSTALLATION =============

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('QuantumHire AI: Extension installed');
    
    chrome.storage.local.set({
      autoDetect: true,
      supabaseUrl: 'https://wntpldomgjutwufphnpg.supabase.co',
      supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudHBsZG9tZ2p1dHd1ZnBobnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDY0NDAsImV4cCI6MjA4MjE4MjQ0MH0.vOXBQIg6jghsAby2MA1GfE-MNTRZ9Ny1W2kfUHGUzNM',
      automationSpeed: 1,
      batchQueue: [],
      sessionStats: { applied: 0, failed: 0, skipped: 0 }
    });
  }
});

// ============= MESSAGE HANDLER =============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('QuantumHire AI: Received message', message.action);
  
  switch (message.action) {
    case 'getProfile':
      chrome.storage.local.get(['userProfile'], (data) => {
        sendResponse(data.userProfile || null);
      });
      return true;
      
    case 'getState':
      sendResponse({
        ...AppState,
        batchQueue: AppState.batchQueue.length,
        activeTabs: Array.from(AppState.activeTabs.entries())
      });
      return true;
      
    case 'setSpeed':
      AppState.currentSpeed = message.speed;
      broadcastStateUpdate();
      sendResponse({ success: true, speed: AppState.currentSpeed });
      return true;
      
    case 'pauseAutomation':
      AppState.isPaused = true;
      broadcastStateUpdate();
      sendResponse({ success: true, paused: true });
      return true;
      
    case 'resumeAutomation':
      AppState.isPaused = false;
      broadcastStateUpdate();
      sendResponse({ success: true, paused: false });
      return true;
      
    case 'skipCurrentJob':
      handleSkipJob(sender.tab?.id);
      sendResponse({ success: true });
      return true;
      
    case 'quitAutomation':
      handleQuitAutomation();
      sendResponse({ success: true });
      return true;
      
    case 'getTailoredApplication':
      getTailoredApplication(message.job)
        .then(sendResponse)
        .catch(err => {
          console.error('QuantumHire AI: Tailor error', err);
          sendResponse({ error: err.message });
        });
      return true;
      
    case 'answerQuestions':
      answerApplicationQuestions(message.questions, message.jobTitle, message.company, message.jobDescription)
        .then(sendResponse)
        .catch(err => {
          console.error('QuantumHire AI: Answer questions error', err);
          sendResponse({ answers: [], error: err.message });
        });
      return true;
      
    case 'extractJob':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'extractJob' }, sendResponse);
        } else {
          sendResponse({ error: 'No active tab' });
        }
      });
      return true;
      
    case 'addToQueue':
      addToQueue(message.job);
      sendResponse({ success: true, queueLength: AppState.batchQueue.length });
      return true;
      
    case 'getQueue':
      chrome.storage.local.get(['jobQueue'], (data) => {
        sendResponse({ queue: data.jobQueue || [] });
      });
      return true;
      
    case 'clearQueue':
      AppState.batchQueue = [];
      chrome.storage.local.set({ jobQueue: [] });
      sendResponse({ success: true });
      return true;
      
    case 'startBatchApply':
      startBatchApply(message.queue || [])
        .then(sendResponse)
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
      
    case 'cancelBatchApply':
      cancelBatchApply();
      sendResponse({ success: true });
      return true;
      
    case 'batchApplyToJob':
      handleBatchApplyToJob(message.url, message.tailoredData, message.atsCredentials)
        .then(sendResponse)
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
      
    case 'updateTabStatus':
      if (sender.tab?.id) {
        AppState.activeTabs.set(sender.tab.id, {
          status: message.status,
          jobData: message.jobData,
          progress: message.progress
        });
        broadcastStateUpdate();
      }
      sendResponse({ success: true });
      return true;
  }
});

// ============= BROADCAST STATE TO ALL TABS =============

function broadcastStateUpdate() {
  const state = {
    action: 'stateUpdate',
    isPaused: AppState.isPaused,
    speed: AppState.currentSpeed,
    isProcessing: AppState.isProcessing,
    queueLength: AppState.batchQueue.length,
    currentIndex: AppState.currentBatchIndex,
    stats: AppState.sessionStats
  };
  
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, state).catch(() => {});
    }
  });
}

// ============= QUEUE MANAGEMENT =============

async function addToQueue(job) {
  const data = await chrome.storage.local.get(['jobQueue']);
  const queue = data.jobQueue || [];
  
  // Check for duplicates
  const exists = queue.some(j => j.url === job.url);
  if (!exists) {
    queue.push({
      ...job,
      addedAt: Date.now(),
      status: 'pending',
      platform: detectPlatform(job.url).name
    });
    await chrome.storage.local.set({ jobQueue: queue });
    AppState.batchQueue = queue;
  }
  
  return queue.length;
}

// ============= BATCH APPLY PROCESSING =============

async function startBatchApply(queue) {
  if (AppState.isProcessing) {
    return { success: false, error: 'Already processing' };
  }
  
  AppState.isProcessing = true;
  AppState.isPaused = false;
  AppState.batchQueue = queue;
  AppState.currentBatchIndex = 0;
  AppState.sessionStats = { applied: 0, failed: 0, skipped: 0, startTime: Date.now() };
  
  broadcastStateUpdate();
  
  for (let i = 0; i < queue.length && AppState.isProcessing; i++) {
    // Check for pause
    while (AppState.isPaused && AppState.isProcessing) {
      await new Promise(r => setTimeout(r, 500));
    }
    
    if (!AppState.isProcessing) break;
    
    AppState.currentBatchIndex = i;
    broadcastStateUpdate();
    
    const job = queue[i];
    console.log(`QuantumHire AI: Processing job ${i + 1}/${queue.length}: ${job.title}`);
    
    try {
      const result = await processJob(job);
      
      if (result.success) {
        AppState.sessionStats.applied++;
        job.status = 'applied';
      } else {
        AppState.sessionStats.failed++;
        job.status = 'failed';
        job.error = result.error;
      }
    } catch (error) {
      console.error('QuantumHire AI: Job processing error', error);
      AppState.sessionStats.failed++;
      job.status = 'failed';
      job.error = error.message;
    }
    
    // Update queue in storage
    await chrome.storage.local.set({ jobQueue: queue });
    broadcastStateUpdate();
    
    // Delay based on speed
    const delay = getDelayForSpeed();
    await new Promise(r => setTimeout(r, delay));
  }
  
  AppState.isProcessing = false;
  broadcastStateUpdate();
  
  return {
    success: true,
    stats: AppState.sessionStats,
    duration: Date.now() - AppState.sessionStats.startTime
  };
}

function getDelayForSpeed() {
  const delays = { 1: 3000, 1.5: 2000, 2: 1500, 3: 1000 };
  return delays[AppState.currentSpeed] || 3000;
}

async function processJob(job) {
  const platform = detectPlatform(job.url);
  console.log(`QuantumHire AI: Processing ${platform.name} job: ${job.title}`);
  
  // Get tailored application
  const tailoredData = await getTailoredApplication({
    title: job.title,
    company: job.company,
    description: job.description || '',
    location: job.location || '',
    url: job.url
  });
  
  if (tailoredData.error) {
    return { success: false, error: tailoredData.error };
  }
  
  // Get ATS credentials
  const credData = await chrome.storage.local.get(['atsCredentials']);
  const atsCredentials = credData.atsCredentials || {};
  
  // Open tab and apply
  return handleBatchApplyToJob(job.url, tailoredData, atsCredentials);
}

function cancelBatchApply() {
  AppState.isProcessing = false;
  AppState.isPaused = false;
  broadcastStateUpdate();
}

function handleSkipJob(tabId) {
  if (tabId && AppState.activeTabs.has(tabId)) {
    chrome.tabs.sendMessage(tabId, { action: 'skip' }).catch(() => {});
  }
}

function handleQuitAutomation() {
  AppState.isProcessing = false;
  AppState.isPaused = false;
  
  // Close all automation tabs
  for (const [tabId] of AppState.activeTabs) {
    chrome.tabs.remove(tabId).catch(() => {});
  }
  AppState.activeTabs.clear();
  
  broadcastStateUpdate();
}

// ============= BATCH APPLY TO SINGLE JOB =============

async function handleBatchApplyToJob(url, tailoredData, atsCredentials) {
  console.log('QuantumHire AI: Batch applying to', url);
  
  return new Promise((resolve) => {
    chrome.tabs.create({ url: url, active: false }, (tab) => {
      const tabId = tab.id;
      AppState.activeTabs.set(tabId, { status: 'loading', url });
      
      const onUpdated = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
              action: 'autofill',
              tailoredData: tailoredData,
              atsCredentials: atsCredentials,
              options: { 
                batchMode: true,
                autoSubmit: true,
                generatePdfs: true
              }
            }, (response) => {
              // Keep tab open longer for form submission
              setTimeout(() => {
                AppState.activeTabs.delete(tabId);
                chrome.tabs.remove(tabId).catch(() => {});
              }, 8000);
              
              if (chrome.runtime.lastError) {
                console.log('QuantumHire AI: Autofill message error', chrome.runtime.lastError);
                resolve({ success: false, error: 'Could not communicate with page' });
              } else {
                resolve({ success: response?.success || false, response });
              }
            });
          }, 4000); // Wait for dynamic content
        }
      };
      
      chrome.tabs.onUpdated.addListener(onUpdated);
      
      // Timeout after 60 seconds
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        AppState.activeTabs.delete(tabId);
        chrome.tabs.remove(tabId).catch(() => {});
        resolve({ success: false, error: 'Page load timeout' });
      }, 60000);
    });
  });
}

// ============= TAILOR APPLICATION =============

async function getTailoredApplication(job) {
  console.log('QuantumHire AI: Getting tailored application for', job.title, 'at', job.company);
  
  const data = await chrome.storage.local.get(['supabaseUrl', 'supabaseKey', 'accessToken', 'userProfile']);
  
  if (!data.userProfile) {
    throw new Error('No profile found. Please connect your account first.');
  }
  
  if (!data.supabaseUrl || !data.supabaseKey) {
    throw new Error('Not configured. Please reconnect your account.');
  }
  
  const profile = data.userProfile;
  
  const response = await fetch(`${data.supabaseUrl}/functions/v1/tailor-application`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': data.supabaseKey,
      'Authorization': `Bearer ${data.accessToken || data.supabaseKey}`,
    },
    body: JSON.stringify({
      jobTitle: job.title,
      company: job.company,
      description: job.description || '',
      requirements: job.requirements || [],
      location: job.location || '',
      jobId: job.jobId || null,
      userProfile: {
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: profile.email,
        phone: profile.phone,
        linkedin: profile.linkedin,
        github: profile.github,
        portfolio: profile.portfolio,
        coverLetter: profile.cover_letter || '',
        workExperience: profile.work_experience || [],
        education: profile.education || [],
        skills: profile.skills || [],
        certifications: profile.certifications || [],
        achievements: profile.achievements || [],
        atsStrategy: profile.ats_strategy || 'Match keywords from job description',
        city: profile.city,
        state: profile.state,
        country: profile.country,
        address: profile.address,
        zipCode: profile.zip_code,
      },
      includeReferral: false,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('QuantumHire AI: API error', response.status, errorText);
    
    if (response.status === 400 && errorText.includes('API key')) {
      throw new Error('OpenAI API key not configured. Please add your API key in Profile settings on the web app.');
    }
    if (response.status === 401) throw new Error('Authentication failed. Please reconnect or check your OpenAI API key.');
    if (response.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
    if (response.status === 402) throw new Error('OpenAI billing issue. Please check your OpenAI account.');
    
    throw new Error(`API error: ${response.status}`);
  }
  
  return await response.json();
}

// ============= ANSWER QUESTIONS =============

async function answerApplicationQuestions(questions, jobTitle, company, jobDescription = '') {
  console.log('QuantumHire AI: Answering', questions.length, 'questions');
  
  const data = await chrome.storage.local.get(['supabaseUrl', 'supabaseKey', 'accessToken', 'userProfile']);
  
  if (!data.userProfile) throw new Error('No profile found');
  
  const profile = data.userProfile;
  
  const userProfileForAI = {
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: profile.email,
    phone: profile.phone,
    skills: profile.skills || [],
    workExperience: profile.work_experience || [],
    education: profile.education || [],
    certifications: profile.certifications || [],
    achievements: profile.achievements || [],
    languages: profile.languages || [],
    city: profile.city,
    state: profile.state,
    country: profile.country,
    citizenship: profile.citizenship || 'United States',
    willingToRelocate: profile.willing_to_relocate !== false,
    visaRequired: false,
    veteranStatus: profile.veteran_status || false,
    disability: profile.disability || false,
    raceEthnicity: profile.race_ethnicity || 'Decline to self-identify',
    drivingLicense: profile.driving_license !== false,
    securityClearance: profile.security_clearance || false,
    expectedSalary: profile.expected_salary || '$75,000 - $95,000',
    currentSalary: profile.current_salary,
    noticePeriod: profile.notice_period || '2 weeks',
    totalExperience: profile.total_experience || '8',
    linkedin: profile.linkedin,
    github: profile.github,
    portfolio: profile.portfolio,
    highestEducation: profile.highest_education || "Bachelor's Degree",
  };
  
  const response = await fetch(`${data.supabaseUrl}/functions/v1/answer-questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': data.supabaseKey,
      'Authorization': `Bearer ${data.accessToken || data.supabaseKey}`,
    },
    body: JSON.stringify({
      questions,
      jobTitle,
      company,
      jobDescription,
      userProfile: userProfileForAI,
    }),
  });
  
  if (!response.ok) {
    if (response.status === 429) return { answers: [], error: 'Rate limit exceeded' };
    if (response.status === 402) return { answers: [], error: 'Payment required' };
    return { answers: [], error: `API error: ${response.status}` };
  }
  
  return await response.json();
}

// ============= TOKEN REFRESH =============

async function refreshAccessToken() {
  const data = await chrome.storage.local.get(['supabaseUrl', 'supabaseKey', 'refreshToken']);
  if (!data.refreshToken) return;
  
  try {
    const response = await fetch(`${data.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': data.supabaseKey,
      },
      body: JSON.stringify({ refresh_token: data.refreshToken }),
    });
    
    if (response.ok) {
      const authData = await response.json();
      await chrome.storage.local.set({
        accessToken: authData.access_token,
        refreshToken: authData.refresh_token,
      });
      console.log('QuantumHire AI: Token refreshed');
    }
  } catch (error) {
    console.error('QuantumHire AI: Token refresh error', error);
  }
}

// Refresh token every 50 minutes
setInterval(refreshAccessToken, 50 * 60 * 1000);
chrome.runtime.onStartup.addListener(refreshAccessToken);

// ============= TAB CLEANUP =============

chrome.tabs.onRemoved.addListener((tabId) => {
  AppState.activeTabs.delete(tabId);
});
