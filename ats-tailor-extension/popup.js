// ATS Tailored CV & Cover Letter - Popup Script
// Uses same approach as chrome-extension for reliable job detection

const SUPABASE_URL = 'https://wntpldomgjutwufphnpg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudHBsZG9tZ2p1dHd1ZnBobnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDY0NDAsImV4cCI6MjA4MjE4MjQ0MH0.vOXBQIg6jghsAby2MA1GfE-MNTRZ9Ny1W2kfUHGUzNM';

// Supported ATS platforms (excluding Lever and Ashby)
const SUPPORTED_HOSTS = [
  'greenhouse.io',
  'job-boards.greenhouse.io',
  'boards.greenhouse.io',
  'workday.com',
  'myworkdayjobs.com',
  'smartrecruiters.com',
  'bullhornstaffing.com',
  'bullhorn.com',
  'teamtailor.com',
  'workable.com',
  'apply.workable.com',
  'icims.com',
  'oracle.com',
  'oraclecloud.com',
  'taleo.net',
];

class ATSTailor {
  constructor() {
    this.session = null;
    this.currentJob = null;
    this.generatedDocuments = { 
      cv: null, 
      coverLetter: null, 
      cvPdf: null, 
      coverPdf: null, 
      cvFileName: null, 
      coverFileName: null,
      matchScore: 0,
      matchedKeywords: [],
      missingKeywords: []
    };
    this.stats = { today: 0, total: 0, avgTime: 0, times: [] };
    this.currentPreviewTab = 'cv';
    this.autoTailorEnabled = true;
    this.jobCache = {};

    this.init();
  }

  async init() {
    await this.loadSession();
    this.bindEvents();
    this.updateUI();

    // Auto-detect job when popup opens (but do NOT auto-tailor)
    if (this.session) {
      await this.refreshSessionIfNeeded();
      await this.detectCurrentJob();
    }
  }

  async refreshSessionIfNeeded() {
    try {
      if (!this.session?.refresh_token || !this.session?.access_token) return;

      // If we don't have expiry info, do a lightweight call to validate token first.
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${this.session.access_token}`,
        },
      });

      if (res.ok) return;

      // Refresh
      const refreshRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ refresh_token: this.session.refresh_token }),
      });

      if (!refreshRes.ok) {
        console.warn('[ATS Tailor] refresh failed; clearing session');
        this.session = null;
        await chrome.storage.local.remove(['ats_session']);
        this.updateUI();
        return;
      }

      const data = await refreshRes.json();
      this.session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user || this.session.user,
      };
      await this.saveSession();
    } catch (e) {
      console.warn('[ATS Tailor] refreshSessionIfNeeded error', e);
    }
  }

  async loadSession() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ['ats_session', 'ats_stats', 'ats_todayDate', 'ats_autoTailorEnabled', 'ats_jobCache', 'ats_lastGeneratedDocuments', 'ats_lastJob'],
        (result) => {
          this.session = result.ats_session || null;

          this.autoTailorEnabled = typeof result.ats_autoTailorEnabled === 'boolean' ? result.ats_autoTailorEnabled : true;
          this.jobCache = result.ats_jobCache || {};

          // Restore last job/documents for preview continuity
          this.currentJob = result.ats_lastJob || this.currentJob;
          if (result.ats_lastGeneratedDocuments) {
            this.generatedDocuments = { ...this.generatedDocuments, ...result.ats_lastGeneratedDocuments };
          }

          if (result.ats_stats) {
            this.stats = result.ats_stats;
          }

          const today = new Date().toDateString();
          if (result.ats_todayDate !== today) {
            this.stats.today = 0;
            chrome.storage.local.set({ ats_todayDate: today });
          }

          resolve();
        }
      );
    });
  }

  async saveSession() {
    await chrome.storage.local.set({ ats_session: this.session });
  }

  async saveStats() {
    await chrome.storage.local.set({
      ats_stats: this.stats,
      ats_todayDate: new Date().toDateString()
    });
  }

  bindEvents() {
    document.getElementById('loginBtn')?.addEventListener('click', () => this.login());
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
    document.getElementById('tailorBtn')?.addEventListener('click', () => this.tailorDocuments({ force: true }));
    document.getElementById('refreshJob')?.addEventListener('click', () => this.detectCurrentJob());
    document.getElementById('downloadCv')?.addEventListener('click', () => this.downloadDocument('cv'));
    document.getElementById('downloadCover')?.addEventListener('click', () => this.downloadDocument('cover'));
    document.getElementById('attachBoth')?.addEventListener('click', () => this.attachBothDocuments());
    document.getElementById('copyContent')?.addEventListener('click', () => this.copyCurrentContent());

    // Settings
    document.getElementById('autoTailorToggle')?.addEventListener('change', (e) => {
      const enabled = !!e.target?.checked;
      this.autoTailorEnabled = enabled;
      chrome.storage.local.set({ ats_autoTailorEnabled: enabled });
      this.showToast(enabled ? 'Auto tailor enabled' : 'Auto tailor disabled', 'success');
    });

    // Preview tabs
    document.getElementById('previewCvTab')?.addEventListener('click', () => this.switchPreviewTab('cv'));
    document.getElementById('previewCoverTab')?.addEventListener('click', () => this.switchPreviewTab('cover'));

    // Enter key for login
    document.getElementById('password')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.login();
    });
  }

  copyCurrentContent() {
    const content = this.currentPreviewTab === 'cv' 
      ? this.generatedDocuments.cv 
      : this.generatedDocuments.coverLetter;
    
    if (content) {
      navigator.clipboard.writeText(content)
        .then(() => this.showToast('Copied to clipboard!', 'success'))
        .catch(() => this.showToast('Failed to copy', 'error'));
    } else {
      this.showToast('No content to copy', 'error');
    }
  }

  switchPreviewTab(tab) {
    this.currentPreviewTab = tab;
    
    // Update tab buttons
    document.getElementById('previewCvTab')?.classList.toggle('active', tab === 'cv');
    document.getElementById('previewCoverTab')?.classList.toggle('active', tab === 'cover');
    
    // Update preview content
    this.updatePreviewContent();
  }

  updatePreviewContent() {
    const previewContent = document.getElementById('previewContent');
    if (!previewContent) return;
    
    const content = this.currentPreviewTab === 'cv' 
      ? this.generatedDocuments.cv 
      : this.generatedDocuments.coverLetter;
    
    // Also check if we have PDFs even if text content is missing
    const hasPdf = this.currentPreviewTab === 'cv' 
      ? this.generatedDocuments.cvPdf 
      : this.generatedDocuments.coverPdf;
    
    if (content) {
      // Format content for better readability
      previewContent.innerHTML = this.formatPreviewContent(content, this.currentPreviewTab);
      previewContent.classList.remove('placeholder');
    } else if (hasPdf) {
      previewContent.textContent = `PDF generated - click Download to view the ${this.currentPreviewTab === 'cv' ? 'CV' : 'Cover Letter'}`;
      previewContent.classList.add('placeholder');
    } else {
      previewContent.textContent = 'Click "Tailor CV & Cover Letter" to generate...';
      previewContent.classList.add('placeholder');
    }
  }

  formatPreviewContent(content, type) {
    if (!content) return '';
    
    // Escape HTML
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };
    
    let formatted = escapeHtml(content);
    
    if (type === 'cv') {
      // Format resume sections
      formatted = formatted
        .replace(/^(PROFESSIONAL SUMMARY|EXPERIENCE|EDUCATION|SKILLS|CERTIFICATIONS|ACHIEVEMENTS|PROJECTS)/gm, 
          '<span class="section-header">$1</span>')
        .replace(/^([A-Z][A-Za-z\s&]+)\s*\|\s*(.+)$/gm, 
          '<strong>$1</strong> | <span class="date-line">$2</span>')
        .replace(/^•\s*/gm, '• ');
    } else {
      // Format cover letter with date header
      formatted = formatted
        .replace(/^(Date:.+)$/m, '<span class="date-line">$1</span>')
        .replace(/^(Dear .+,)$/m, '<strong>$1</strong>')
        .replace(/^(Sincerely,|Best regards,|Regards,)$/m, '<br><strong>$1</strong>');
    }
    
    return formatted;
  }

  updateUI() {
    const loginSection = document.getElementById('loginSection');
    const mainSection = document.getElementById('mainSection');
    const userEmail = document.getElementById('userEmail');
    
    if (!this.session) {
      loginSection?.classList.remove('hidden');
      mainSection?.classList.add('hidden');
      this.setStatus('Login Required', 'error');
    } else {
      loginSection?.classList.add('hidden');
      mainSection?.classList.remove('hidden');
      if (userEmail) userEmail.textContent = this.session.user?.email || 'Logged in';
      this.setStatus('Ready', 'ready');
    }
    
    document.getElementById('todayCount').textContent = this.stats.today;
    document.getElementById('totalCount').textContent = this.stats.total;
    document.getElementById('avgTime').textContent = this.stats.avgTime > 0 ? `${Math.round(this.stats.avgTime)}s` : '0s';
    
    // Initialize auto-tailor toggle from stored state
    const autoTailorToggle = document.getElementById('autoTailorToggle');
    if (autoTailorToggle) {
      autoTailorToggle.checked = this.autoTailorEnabled;
    }
    
    // Show documents card if we have previously generated documents (text or PDF)
    const hasDocuments = this.generatedDocuments.cv || 
                         this.generatedDocuments.coverLetter || 
                         this.generatedDocuments.cvPdf || 
                         this.generatedDocuments.coverPdf;
    if (hasDocuments) {
      document.getElementById('documentsCard')?.classList.remove('hidden');
      this.updateDocumentDisplay();
      this.updatePreviewContent();
    }
  }

  updateDocumentDisplay() {
    // Update filenames
    const cvFileName = document.getElementById('cvFileName');
    const coverFileName = document.getElementById('coverFileName');
    
    if (cvFileName && this.generatedDocuments.cvFileName) {
      cvFileName.textContent = this.generatedDocuments.cvFileName;
      cvFileName.title = this.generatedDocuments.cvFileName;
    }
    
    if (coverFileName && this.generatedDocuments.coverFileName) {
      coverFileName.textContent = this.generatedDocuments.coverFileName;
      coverFileName.title = this.generatedDocuments.coverFileName;
    }
    
    // Update file sizes
    const cvSize = document.getElementById('cvSize');
    const coverSize = document.getElementById('coverSize');
    
    if (cvSize && this.generatedDocuments.cvPdf) {
      const sizeKB = Math.round(this.generatedDocuments.cvPdf.length * 0.75 / 1024);
      cvSize.textContent = `${sizeKB} KB`;
    }
    
    if (coverSize && this.generatedDocuments.coverPdf) {
      const sizeKB = Math.round(this.generatedDocuments.coverPdf.length * 0.75 / 1024);
      coverSize.textContent = `${sizeKB} KB`;
    }
    
    // Update ATS match score
    const atsScore = document.getElementById('atsMatchScore');
    const atsSection = document.getElementById('atsMatchSection');
    const atsKeywords = document.getElementById('atsKeywords');
    const matchedKeywords = document.getElementById('matchedKeywords');
    const missingKeywords = document.getElementById('missingKeywords');
    
    if (atsScore && this.generatedDocuments.matchScore) {
      atsScore.textContent = `${this.generatedDocuments.matchScore}%`;
      atsSection?.classList.remove('hidden');
      
      // Show keywords
      if (atsKeywords && (this.generatedDocuments.matchedKeywords?.length || this.generatedDocuments.missingKeywords?.length)) {
        atsKeywords.classList.remove('hidden');
        
        if (matchedKeywords && this.generatedDocuments.matchedKeywords?.length) {
          matchedKeywords.textContent = `✓ ${this.generatedDocuments.matchedKeywords.slice(0, 8).join(', ')}`;
        }
        
        if (missingKeywords && this.generatedDocuments.missingKeywords?.length) {
          missingKeywords.textContent = `⚠ Missing: ${this.generatedDocuments.missingKeywords.slice(0, 5).join(', ')}`;
        }
      }
    }
  }

  setStatus(text, type = 'ready') {
    const indicator = document.getElementById('statusIndicator');
    const statusText = indicator?.querySelector('.status-text');
    
    if (indicator) indicator.className = `status-indicator ${type}`;
    if (statusText) statusText.textContent = text;
  }

  async login() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    
    const email = emailInput?.value?.trim();
    const password = passwordInput?.value;
    
    if (!email || !password) {
      this.showToast('Please enter email and password', 'error');
      return;
    }
    
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Login failed');
      }
      
      this.session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user
      };
      
      await this.saveSession();
      this.showToast('Logged in successfully!', 'success');
      this.updateUI();
      
      // Auto-detect and tailor
      const found = await this.detectCurrentJob();
      if (found && this.currentJob) {
        this.tailorDocuments();
      }
      
    } catch (error) {
      console.error('Login error:', error);
      this.showToast(error.message || 'Login failed', 'error');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  }

  async logout() {
    this.session = null;
    await chrome.storage.local.remove(['ats_session']);
    this.showToast('Logged out', 'success');
    this.updateUI();
  }

  isSupportedHost(hostname) {
    return SUPPORTED_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`));
  }

  async detectCurrentJob() {
    this.setStatus('Scanning...', 'working');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id || !tab?.url) {
        this.currentJob = null;
        this.updateJobDisplay();
        this.setStatus('No active tab', 'error');
        return false;
      }

      // Skip restricted URLs
      if (
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('about:') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('moz-extension://')
      ) {
        this.currentJob = null;
        this.updateJobDisplay();
        this.setStatus('Navigate to a job page', 'error');
        return false;
      }

      // Check if on supported ATS platform
      const url = new URL(tab.url);
      if (!this.isSupportedHost(url.hostname)) {
        this.currentJob = null;
        this.updateJobDisplay();
        this.setStatus(`Unsupported: ${url.hostname}`, 'error');
        return false;
      }

      // Execute extraction script in the page context
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractJobInfoFromPageInjected,
      });

      if (results?.[0]?.result) {
        this.currentJob = results[0].result;
        await chrome.storage.local.set({ ats_lastJob: this.currentJob });
        this.updateJobDisplay();
        this.setStatus('Job found!', 'ready');
        return true;
      }

      this.currentJob = null;
      this.updateJobDisplay();
      this.setStatus('No job found on page', 'error');
      return false;
    } catch (error) {
      console.error('Job detection error:', error);
      this.currentJob = null;
      this.updateJobDisplay();
      this.setStatus('Detection failed', 'error');
      return false;
    }
  }

  updateJobDisplay() {
    const titleEl = document.getElementById('jobTitle');
    const companyEl = document.getElementById('jobCompany');
    const locationEl = document.getElementById('jobLocation');
    const noJobBadge = document.getElementById('noJobBadge');
    
    if (this.currentJob) {
      if (titleEl) titleEl.textContent = this.currentJob.title || 'Job Position';
      if (companyEl) companyEl.textContent = this.currentJob.company || '';
      if (locationEl) locationEl.textContent = this.currentJob.location || '';
      if (noJobBadge) noJobBadge.classList.add('hidden');
    } else {
      if (titleEl) titleEl.textContent = 'No job detected';
      if (companyEl) companyEl.textContent = 'Navigate to a job posting';
      if (locationEl) locationEl.textContent = '';
      if (noJobBadge) noJobBadge.classList.remove('hidden');
    }
  }

  async tailorDocuments() {
    if (!this.currentJob) {
      this.showToast('No job detected', 'error');
      return;
    }

    const startTime = Date.now();
    const btn = document.getElementById('tailorBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Tailoring...';
    progressContainer?.classList.remove('hidden');
    this.setStatus('Tailoring...', 'working');

    const updateProgress = (percent, text) => {
      if (progressFill) progressFill.style.width = `${percent}%`;
      if (progressText) progressText.textContent = text;
    };

    try {
      updateProgress(20, 'Loading your profile...');

      await this.refreshSessionIfNeeded();
      if (!this.session?.access_token || !this.session?.user?.id) {
        throw new Error('Please sign in again');
      }

      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${this.session.user.id}&select=first_name,last_name,email,phone,linkedin,github,portfolio,cover_letter,work_experience,education,skills,certifications,achievements,ats_strategy,city,country,address,state,zip_code`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${this.session.access_token}`,
          },
        }
      );

      if (!profileRes.ok) {
        throw new Error('Could not load profile. Open the QuantumHire app and complete your profile.');
      }

      const profileRows = await profileRes.json();
      const p = profileRows?.[0] || {};

      updateProgress(35, 'Generating tailored documents...');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/tailor-application`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          jobTitle: this.currentJob.title || '',
          company: this.currentJob.company || '',
          location: this.currentJob.location || '',
          description: this.currentJob.description || '',
          requirements: [],
          userProfile: {
            firstName: p.first_name || '',
            lastName: p.last_name || '',
            email: p.email || this.session.user.email || '',
            phone: p.phone || '',
            linkedin: p.linkedin || '',
            github: p.github || '',
            portfolio: p.portfolio || '',
            coverLetter: p.cover_letter || '',
            workExperience: Array.isArray(p.work_experience) ? p.work_experience : [],
            education: Array.isArray(p.education) ? p.education : [],
            skills: Array.isArray(p.skills) ? p.skills : [],
            certifications: Array.isArray(p.certifications) ? p.certifications : [],
            achievements: Array.isArray(p.achievements) ? p.achievements : [],
            atsStrategy: p.ats_strategy || '',
            city: p.city || undefined,
            country: p.country || undefined,
            address: p.address || undefined,
            state: p.state || undefined,
            zipCode: p.zip_code || undefined,
          },
        }),
      });

      updateProgress(70, 'Processing results...');

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Server error');
      }

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      // Generate fallback filename with FirstName_LastName format
      const fallbackName = `${(p.first_name || '').trim()}_${(p.last_name || '').trim()}`.replace(/\s+/g, '_') || 'Applicant';
      
      this.generatedDocuments = {
        cv: result.tailoredResume,
        coverLetter: result.tailoredCoverLetter || result.coverLetter,
        cvPdf: result.resumePdf,
        coverPdf: result.coverLetterPdf,
        cvFileName: result.cvFileName || result.resumePdfFileName || `${fallbackName}_CV.pdf`,
        coverFileName: result.coverLetterFileName || result.coverLetterPdfFileName || `${fallbackName}_Cover_Letter.pdf`,
        matchScore: result.matchScore || 0,
        matchedKeywords: result.keywordsMatched || result.matchedKeywords || [],
        missingKeywords: result.keywordsMissing || result.missingKeywords || []
      };

      await chrome.storage.local.set({ ats_lastGeneratedDocuments: this.generatedDocuments });

      updateProgress(100, 'Complete!');

      const elapsed = (Date.now() - startTime) / 1000;
      this.stats.today++;
      this.stats.total++;
      this.stats.times.push(elapsed);
      if (this.stats.times.length > 10) this.stats.times.shift();
      this.stats.avgTime = this.stats.times.reduce((a, b) => a + b, 0) / this.stats.times.length;
      await this.saveStats();
      this.updateUI();

      // Show documents card and preview
      document.getElementById('documentsCard')?.classList.remove('hidden');
      this.updateDocumentDisplay();
      this.updatePreviewContent();
      
      this.showToast(`Done in ${elapsed.toFixed(1)}s! Match: ${this.generatedDocuments.matchScore}%`, 'success');
      this.setStatus('Complete', 'ready');

    } catch (error) {
      console.error('Tailoring error:', error);
      this.showToast(error.message || 'Failed', 'error');
      this.setStatus('Error', 'error');
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Tailor CV & Cover Letter';
      setTimeout(() => progressContainer?.classList.add('hidden'), 2000);
    }
  }

  downloadDocument(type) {
    const doc = type === 'cv' ? this.generatedDocuments.cvPdf : this.generatedDocuments.coverPdf;
    const textDoc = type === 'cv' ? this.generatedDocuments.cv : this.generatedDocuments.coverLetter;
    // Use the filename from backend which includes user's name with proper format
    const filename = type === 'cv' 
      ? (this.generatedDocuments.cvFileName || `Applicant_CV.pdf`)
      : (this.generatedDocuments.coverFileName || `Applicant_Cover_Letter.pdf`);
    
    if (doc) {
      const blob = this.base64ToBlob(doc, 'application/pdf');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Downloaded!', 'success');
    } else if (textDoc) {
      const blob = new Blob([textDoc], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace('.pdf', '.txt');
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Downloaded!', 'success');
    } else {
      this.showToast('No document available', 'error');
    }
  }

  base64ToBlob(base64, type) {
    const byteCharacters = atob(base64);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([byteArray], { type });
  }

  async attachDocument(type) {
    const doc = type === 'cv' ? this.generatedDocuments.cvPdf : this.generatedDocuments.coverPdf;
    const textDoc = type === 'cv' ? this.generatedDocuments.cv : this.generatedDocuments.coverLetter;
    // Use filename from backend which includes user's name with proper format
    const filename =
      type === 'cv'
        ? this.generatedDocuments.cvFileName || `Applicant_CV.pdf`
        : this.generatedDocuments.coverFileName || `Applicant_Cover_Letter.pdf`;

    if (!doc && !textDoc) {
      this.showToast('No document available', 'error');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');

      const res = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: 'attachDocument',
            type,
            pdf: doc,
            text: textDoc,
            filename,
          },
          (response) => {
            const err = chrome.runtime.lastError;
            if (err) return reject(new Error(err.message || 'Send message failed'));
            resolve(response);
          }
        );
      });

      if (res?.success && res?.skipped) {
        // Common for Greenhouse: cover letter may be a button/text flow rather than file upload.
        this.showToast(res.message || 'Skipped (no upload field)', 'success');
        return;
      }

      if (res?.success) {
        this.showToast(`${type === 'cv' ? 'CV' : 'Cover Letter'} attached!`, 'success');
        return;
      }

      this.showToast(res?.message || 'Failed to attach document', 'error');
    } catch (error) {
      console.error('Attach error:', error);
      this.showToast(error?.message || 'Failed to attach document', 'error');
    }
  }

  async attachBothDocuments() {
    await this.attachDocument('cv');
    await new Promise(r => setTimeout(r, 500));
    await this.attachDocument('cover');
  }

  showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// This function is injected into the page context - it must be self-contained
function extractJobInfoFromPageInjected() {
  const hostname = window.location.hostname;

  const getText = (selectors) => {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) return el.textContent.trim();
      } catch {
        // ignore
      }
    }
    return '';
  };

  const getMeta = (name) =>
    document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ||
    document.querySelector(`meta[property="${name}"]`)?.getAttribute('content') ||
    '';

  // Platform-specific selectors
  const platformSelectors = {
    greenhouse: {
      title: ['h1.app-title', 'h1.posting-headline', 'h1', '[data-test="posting-title"]'],
      company: ['#company-name', '.company-name', '.posting-categories strong', '[data-test="company-name"]', 'a[href*="/jobs"] span'],
      location: ['.location', '.posting-categories .location', '[data-test="location"]'],
      description: ['#content', '.posting', '.posting-description', '[data-test="description"]'],
    },
    workday: {
      title: ['h1[data-automation-id="jobPostingHeader"]', 'h1[data-automation-id="jobPostingTitle"]', 'h1', '[data-automation-id="job-title"]'],
      company: ['div[data-automation-id="jobPostingCompany"]', '[data-automation-id="companyName"]', '.css-1f9qtsv'],
      location: ['div[data-automation-id="locations"]', '[data-automation-id="jobPostingLocation"]', '[data-automation-id="location"]'],
      description: ['div[data-automation-id="jobPostingDescription"]', '[data-automation-id="jobDescription"]', '.jobPostingDescription'],
    },
    smartrecruiters: {
      title: ['h1[data-test="job-title"]', 'h1', '.job-title'],
      company: ['[data-test="job-company-name"]', '[class*="company" i]', '.company-name'],
      location: ['[data-test="job-location"]', '[class*="location" i]', '.job-location'],
      description: ['[data-test="job-description"]', '[class*="job-description" i]', '.job-description'],
    },
    teamtailor: {
      title: ['h1', '[data-qa="job-title"]', '.job-title'],
      company: ['[data-qa="job-company"]', '[class*="company" i]', '.department-name'],
      location: ['[data-qa="job-location"]', '[class*="location" i]', '.location'],
      description: ['[data-qa="job-description"]', 'main', '.job-description'],
    },
    workable: {
      title: ['h1', '[data-ui="job-title"]', '.job-title'],
      company: ['[data-ui="company-name"]', '[class*="company" i]', 'header a'],
      location: ['[data-ui="job-location"]', '[class*="location" i]', '.location'],
      description: ['[data-ui="job-description"]', '[class*="description" i]', 'section'],
    },
    icims: {
      title: ['h1', '.iCIMS_Header', '[class*="header" i] h1', '.job-title'],
      company: ['[class*="company" i]', '.company'],
      location: ['[class*="location" i]', '.location'],
      description: ['#job-content', '[class*="description" i]', 'main', '.job-description'],
    },
    oracle: {
      title: ['h1', '[class*="job-title" i]', '.job-title'],
      company: ['[class*="company" i]', '.company'],
      location: ['[class*="location" i]', '.location'],
      description: ['[class*="description" i]', 'main', '.job-description'],
    },
    bullhorn: {
      title: ['h1', '[class*="job-title" i]', '.job-title'],
      company: ['[class*="company" i]', '.company'],
      location: ['[class*="location" i]', '.location'],
      description: ['[class*="description" i]', 'main', '.job-description'],
    },
  };

  const detectPlatformKey = () => {
    if (hostname.includes('greenhouse.io')) return 'greenhouse';
    if (hostname.includes('workday.com') || hostname.includes('myworkdayjobs.com')) return 'workday';
    if (hostname.includes('smartrecruiters.com')) return 'smartrecruiters';
    if (hostname.includes('teamtailor.com')) return 'teamtailor';
    if (hostname.includes('workable.com')) return 'workable';
    if (hostname.includes('icims.com')) return 'icims';
    if (hostname.includes('bullhorn')) return 'bullhorn';
    if (hostname.includes('oracle') || hostname.includes('taleo.net') || hostname.includes('oraclecloud')) return 'oracle';
    return null;
  };

  const platformKey = detectPlatformKey();
  const selectors = platformKey ? platformSelectors[platformKey] : null;

  // Try platform-specific selectors first, then fallback to meta tags and document title
  let title = selectors ? getText(selectors.title) : '';
  if (!title) title = getMeta('og:title') || '';
  if (!title) title = document.title?.split('|')?.[0]?.split('-')?.[0]?.split('at ')?.[0]?.trim() || '';

  if (!title || title.length < 2) return null;

  let company = selectors ? getText(selectors.company) : '';
  if (!company) company = getMeta('og:site_name') || '';
  
  // Try to extract company from title if format is "Role at Company"
  if (!company && title.includes(' at ')) {
    const parts = document.title.split(' at ');
    if (parts.length > 1) {
      company = parts[parts.length - 1].split('|')[0].split('-')[0].trim();
    }
  }

  const location = selectors ? getText(selectors.location) : '';

  const rawDesc = selectors ? getText(selectors.description) : '';
  const description = rawDesc?.trim()?.length > 80 ? rawDesc.trim().substring(0, 3000) : '';

  return {
    title: title.substring(0, 200),
    company: company.substring(0, 100),
    location: location.substring(0, 100),
    description,
    url: window.location.href,
    platform: platformKey || hostname.replace('www.', '').split('.')[0],
  };
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new ATSTailor();
});
