// QuantumHire AI - Floating Control Panel Component
// Provides real-time status, speed controls, pause/resume functionality

function createFloatingControlPanel() {
  // Remove existing panel
  const existing = document.getElementById('qh-control-panel');
  if (existing) existing.remove();
  
  const panel = document.createElement('div');
  panel.id = 'qh-control-panel';
  panel.className = 'qh-floating-panel';
  
  panel.innerHTML = `
    <div class="qh-panel-header" id="qh-panel-drag-handle">
      <div class="qh-panel-logo">
        <div class="qh-panel-logo-icon">⚡</div>
        <div>
          <div class="qh-panel-title">QuantumHire AI</div>
          <div class="qh-panel-subtitle" id="qh-platform-name">Detecting...</div>
        </div>
      </div>
      <div class="qh-panel-controls">
        <button class="qh-panel-btn minimize" id="qh-minimize-btn" title="Minimize">−</button>
        <button class="qh-panel-btn close" id="qh-close-btn" title="Close">×</button>
      </div>
    </div>
    
    <div class="qh-panel-body">
      <!-- Status Section -->
      <div class="qh-status-section">
        <div class="qh-status-indicator" id="qh-status-indicator"></div>
        <div class="qh-status-info">
          <div class="qh-status-text" id="qh-status-text">Ready to apply</div>
          <div class="qh-status-detail" id="qh-status-detail">Waiting for action</div>
        </div>
      </div>
      
      <!-- Speed Control -->
      <div class="qh-speed-section">
        <div class="qh-speed-label">Automation Speed</div>
        <div class="qh-speed-buttons">
          <button class="qh-speed-btn active" data-speed="1">1x</button>
          <button class="qh-speed-btn" data-speed="1.5">1.5x</button>
          <button class="qh-speed-btn" data-speed="2">2x</button>
          <button class="qh-speed-btn" data-speed="3">3x</button>
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div class="qh-action-section">
        <button class="qh-action-btn primary" id="qh-apply-btn">
          <span>⚡</span> Apply Now
        </button>
        <button class="qh-action-btn secondary" id="qh-pause-btn" style="display: none;">
          <span id="qh-pause-icon">⏸️</span> <span id="qh-pause-text">Pause</span>
        </button>
      </div>
      
      <div class="qh-action-section" id="qh-running-controls" style="display: none;">
        <button class="qh-action-btn secondary" id="qh-skip-btn">
          <span>⏭️</span> Skip
        </button>
        <button class="qh-action-btn danger" id="qh-quit-btn">
          <span>⏹️</span> Stop
        </button>
      </div>
      
      <!-- Progress Section (hidden by default) -->
      <div class="qh-progress-section" id="qh-progress-section" style="display: none;">
        <div class="qh-progress-header">
          <span class="qh-progress-title">Filling application...</span>
          <span class="qh-progress-count" id="qh-progress-count">0%</span>
        </div>
        <div class="qh-progress-bar">
          <div class="qh-progress-fill" id="qh-progress-fill" style="width: 0%"></div>
        </div>
      </div>
      
      <!-- Stats Row -->
      <div class="qh-stats-row" id="qh-stats-row" style="display: none;">
        <div class="qh-stat-item">
          <div class="qh-stat-value success" id="qh-stat-applied">0</div>
          <div class="qh-stat-label">Applied</div>
        </div>
        <div class="qh-stat-item">
          <div class="qh-stat-value error" id="qh-stat-failed">0</div>
          <div class="qh-stat-label">Failed</div>
        </div>
        <div class="qh-stat-item">
          <div class="qh-stat-value warning" id="qh-stat-skipped">0</div>
          <div class="qh-stat-label">Skipped</div>
        </div>
      </div>
      
      <!-- Current Job (hidden by default) -->
      <div class="qh-current-job" id="qh-current-job" style="display: none;">
        <div class="qh-current-job-label">Currently Processing</div>
        <div class="qh-current-job-title" id="qh-job-title">-</div>
        <div class="qh-current-job-company" id="qh-job-company">-</div>
      </div>
      
      <!-- Log Area -->
      <div class="qh-log-area" id="qh-log-area"></div>
    </div>
  `;
  
  document.body.appendChild(panel);
  
  // Initialize panel functionality
  initPanelControls(panel);
  initDragFunctionality(panel);
  initStateListener();
  detectAndDisplayPlatform();
  
  return panel;
}

function initPanelControls(panel) {
  // Close button
  panel.querySelector('#qh-close-btn').addEventListener('click', () => {
    panel.remove();
  });
  
  // Minimize button
  panel.querySelector('#qh-minimize-btn').addEventListener('click', () => {
    panel.classList.toggle('minimized');
    const btn = panel.querySelector('#qh-minimize-btn');
    btn.textContent = panel.classList.contains('minimized') ? '+' : '−';
  });
  
  // Speed buttons
  panel.querySelectorAll('.qh-speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.qh-speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const speed = parseFloat(btn.dataset.speed);
      
      chrome.runtime.sendMessage({ action: 'setSpeed', speed }, (response) => {
        if (response?.success) {
          addLogEntry(`Speed set to ${speed}x`, 'info');
        }
      });
      
      // Update local automation state
      if (typeof automationState !== 'undefined') {
        automationState.speed = speed;
      }
    });
  });
  
  // Apply button
  panel.querySelector('#qh-apply-btn').addEventListener('click', async () => {
    const applyBtn = panel.querySelector('#qh-apply-btn');
    applyBtn.disabled = true;
    applyBtn.innerHTML = '<span>⏳</span> Processing...';
    
    showRunningState(true);
    
    try {
      // Get job details
      const jobData = extractJobDetails();
      addLogEntry(`Detected: ${jobData.title || 'Job'}`, 'info');
      
      // Get tailored application
      addLogEntry('Tailoring resume & cover letter...', 'info');
      updateStatus('processing', 'Tailoring application...', 'AI is optimizing your resume');
      
      const tailoredData = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getTailoredApplication', job: jobData }, (response) => {
          if (response?.error) reject(new Error(response.error));
          else resolve(response);
        });
      });
      
      addLogEntry(`Match score: ${tailoredData.matchScore}%`, 'success');
      
      // Start autofill
      addLogEntry('Auto-filling application form...', 'info');
      updateStatus('processing', 'Filling form...', 'Entering your information');
      
      const result = await autofillForm(tailoredData, null, { autoAdvance: true });
      
      if (result.success) {
        addLogEntry(`Filled ${result.totalFilled} fields`, 'success');
        updateStatus('success', 'Application ready!', `${result.totalFilled} fields filled`);
      } else {
        addLogEntry(result.error || 'Some fields may need review', 'error');
        updateStatus('error', 'Needs review', result.error || 'Check highlighted fields');
      }
      
    } catch (error) {
      console.error('Apply error:', error);
      addLogEntry(error.message, 'error');
      updateStatus('error', 'Error occurred', error.message);
    }
    
    applyBtn.disabled = false;
    applyBtn.innerHTML = '<span>⚡</span> Apply Now';
  });
  
  // Pause/Resume button
  panel.querySelector('#qh-pause-btn').addEventListener('click', () => {
    const isPaused = panel.querySelector('#qh-pause-text').textContent === 'Resume';
    
    if (isPaused) {
      chrome.runtime.sendMessage({ action: 'resumeAutomation' });
      panel.querySelector('#qh-pause-icon').textContent = '⏸️';
      panel.querySelector('#qh-pause-text').textContent = 'Pause';
      if (typeof automationState !== 'undefined') automationState.isPaused = false;
      addLogEntry('Resumed', 'info');
    } else {
      chrome.runtime.sendMessage({ action: 'pauseAutomation' });
      panel.querySelector('#qh-pause-icon').textContent = '▶️';
      panel.querySelector('#qh-pause-text').textContent = 'Resume';
      if (typeof automationState !== 'undefined') automationState.isPaused = true;
      addLogEntry('Paused', 'info');
    }
  });
  
  // Skip button
  panel.querySelector('#qh-skip-btn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'skipCurrentJob' });
    if (typeof automationState !== 'undefined') automationState.shouldSkip = true;
    addLogEntry('Skipping current job...', 'warning');
  });
  
  // Quit button
  panel.querySelector('#qh-quit-btn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'quitAutomation' });
    if (typeof automationState !== 'undefined') automationState.shouldQuit = true;
    showRunningState(false);
    updateStatus('idle', 'Stopped', 'Automation cancelled');
    addLogEntry('Stopped', 'error');
  });
}

function initDragFunctionality(panel) {
  const handle = panel.querySelector('#qh-panel-drag-handle');
  let isDragging = false;
  let startX, startY, initialX, initialY;
  
  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('.qh-panel-btn')) return;
    
    isDragging = true;
    panel.classList.add('dragging');
    
    const rect = panel.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    initialX = rect.left;
    initialY = rect.top;
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newX = initialX + deltaX;
    let newY = initialY + deltaY;
    
    // Bounds checking
    const maxX = window.innerWidth - panel.offsetWidth;
    const maxY = window.innerHeight - panel.offsetHeight;
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    
    panel.style.left = `${newX}px`;
    panel.style.top = `${newY}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    panel.classList.remove('dragging');
  });
}

function initStateListener() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'stateUpdate') {
      const panel = document.getElementById('qh-control-panel');
      if (!panel) return;
      
      // Update speed buttons
      if (message.speed) {
        panel.querySelectorAll('.qh-speed-btn').forEach(btn => {
          btn.classList.toggle('active', parseFloat(btn.dataset.speed) === message.speed);
        });
      }
      
      // Update pause state
      if (message.isPaused !== undefined) {
        const pauseIcon = panel.querySelector('#qh-pause-icon');
        const pauseText = panel.querySelector('#qh-pause-text');
        const indicator = panel.querySelector('#qh-status-indicator');
        
        if (message.isPaused) {
          pauseIcon.textContent = '▶️';
          pauseText.textContent = 'Resume';
          indicator.classList.add('paused');
        } else {
          pauseIcon.textContent = '⏸️';
          pauseText.textContent = 'Pause';
          indicator.classList.remove('paused');
        }
      }
      
      // Update stats
      if (message.stats) {
        panel.querySelector('#qh-stat-applied').textContent = message.stats.applied || 0;
        panel.querySelector('#qh-stat-failed').textContent = message.stats.failed || 0;
        panel.querySelector('#qh-stat-skipped').textContent = message.stats.skipped || 0;
      }
      
      // Show/hide running state
      if (message.isProcessing !== undefined) {
        showRunningState(message.isProcessing);
      }
    }
  });
}

function detectAndDisplayPlatform() {
  const panel = document.getElementById('qh-control-panel');
  if (!panel) return;
  
  const hostname = window.location.hostname;
  let platform = 'Unknown ATS';
  
  if (hostname.includes('greenhouse.io')) platform = 'Greenhouse';
  else if (hostname.includes('lever.co')) platform = 'Lever';
  else if (hostname.includes('workday.com') || hostname.includes('myworkdayjobs.com')) platform = 'Workday';
  else if (hostname.includes('linkedin.com')) platform = 'LinkedIn';
  else if (hostname.includes('indeed.com')) platform = 'Indeed';
  else if (hostname.includes('glassdoor.com')) platform = 'Glassdoor';
  else if (hostname.includes('ashbyhq.com')) platform = 'Ashby';
  else if (hostname.includes('icims.com')) platform = 'iCIMS';
  else if (hostname.includes('smartrecruiters.com')) platform = 'SmartRecruiters';
  else if (hostname.includes('dice.com')) platform = 'Dice';
  else if (hostname.includes('ziprecruiter.com')) platform = 'ZipRecruiter';
  else if (hostname.includes('monster.com')) platform = 'Monster';
  else if (hostname.includes('taleo.net')) platform = 'Taleo';
  else if (document.querySelector('form input[type="text"]')) platform = 'Generic ATS';
  
  panel.querySelector('#qh-platform-name').textContent = platform;
}

function showRunningState(isRunning) {
  const panel = document.getElementById('qh-control-panel');
  if (!panel) return;
  
  panel.querySelector('#qh-pause-btn').style.display = isRunning ? 'flex' : 'none';
  panel.querySelector('#qh-running-controls').style.display = isRunning ? 'flex' : 'none';
  panel.querySelector('#qh-progress-section').style.display = isRunning ? 'block' : 'none';
  panel.querySelector('#qh-stats-row').style.display = isRunning ? 'flex' : 'none';
}

function updateStatus(type, text, detail) {
  const panel = document.getElementById('qh-control-panel');
  if (!panel) return;
  
  const indicator = panel.querySelector('#qh-status-indicator');
  const statusText = panel.querySelector('#qh-status-text');
  const statusDetail = panel.querySelector('#qh-status-detail');
  
  indicator.className = 'qh-status-indicator';
  if (type === 'error') indicator.classList.add('error');
  else if (type === 'paused') indicator.classList.add('paused');
  
  statusText.textContent = text;
  statusDetail.textContent = detail;
}

function updateProgress(percent, current, total) {
  const panel = document.getElementById('qh-control-panel');
  if (!panel) return;
  
  panel.querySelector('#qh-progress-count').textContent = `${percent}%`;
  panel.querySelector('#qh-progress-fill').style.width = `${percent}%`;
  
  if (current !== undefined && total !== undefined) {
    panel.querySelector('.qh-progress-title').textContent = `Step ${current} of ${total}`;
  }
}

function addLogEntry(message, type = 'info') {
  const panel = document.getElementById('qh-control-panel');
  if (!panel) return;
  
  const logArea = panel.querySelector('#qh-log-area');
  const entry = document.createElement('div');
  entry.className = `qh-log-entry ${type}`;
  
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  entry.textContent = `[${time}] ${message}`;
  
  logArea.appendChild(entry);
  logArea.scrollTop = logArea.scrollHeight;
  
  // Keep only last 50 entries
  while (logArea.children.length > 50) {
    logArea.removeChild(logArea.firstChild);
  }
}

function showCurrentJob(title, company) {
  const panel = document.getElementById('qh-control-panel');
  if (!panel) return;
  
  const jobSection = panel.querySelector('#qh-current-job');
  jobSection.style.display = 'block';
  panel.querySelector('#qh-job-title').textContent = title || 'Unknown Position';
  panel.querySelector('#qh-job-company').textContent = company || 'Unknown Company';
}

// Export functions for use in content.js
if (typeof window !== 'undefined') {
  window.QHControlPanel = {
    create: createFloatingControlPanel,
    updateStatus,
    updateProgress,
    addLogEntry,
    showCurrentJob,
    showRunningState
  };
}
