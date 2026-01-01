// QuantumHire AI - Retry Manager with Exponential Backoff
// Handles failed applications with intelligent retry logic

const RetryManager = {
  // Retry configuration
  config: {
    maxRetries: 3,
    baseDelay: 2000,       // 2 seconds base delay
    maxDelay: 60000,       // 1 minute max delay
    backoffMultiplier: 2,  // Double delay each retry
    jitterRange: 0.25,     // 25% random jitter
  },

  // Track retry state per job
  retryState: new Map(),

  // Errors that shouldn't be retried
  nonRetryableErrors: [
    'CAPTCHA',
    'account_locked',
    'job_closed',
    'already_applied',
    'authentication_required',
    'profile_incomplete',
    'region_restricted',
  ],

  // Errors that should be retried
  retryableErrors: [
    'network_error',
    'timeout',
    'rate_limited',
    'server_error',
    'page_load_failed',
    'element_not_found',
    'dom_changed',
  ],

  /**
   * Check if an error is retryable
   */
  isRetryable(error) {
    const errorStr = String(error).toLowerCase();
    
    // Check for non-retryable errors first
    if (this.nonRetryableErrors.some(e => errorStr.includes(e.toLowerCase()))) {
      return false;
    }

    // Check for retryable errors
    if (this.retryableErrors.some(e => errorStr.includes(e.toLowerCase()))) {
      return true;
    }

    // Network errors are retryable
    if (errorStr.includes('network') || errorStr.includes('fetch')) {
      return true;
    }

    // 5xx server errors are retryable
    if (errorStr.match(/5\d\d/)) {
      return true;
    }

    // Default: retry transient-looking errors
    return errorStr.includes('timeout') || 
           errorStr.includes('temporary') ||
           errorStr.includes('unavailable');
  },

  /**
   * Get retry state for a job
   */
  getState(jobId) {
    if (!this.retryState.has(jobId)) {
      this.retryState.set(jobId, {
        attempts: 0,
        lastError: null,
        lastAttempt: null,
        nextRetryTime: null,
      });
    }
    return this.retryState.get(jobId);
  },

  /**
   * Calculate delay with exponential backoff and jitter
   */
  calculateDelay(attempt) {
    const { baseDelay, maxDelay, backoffMultiplier, jitterRange } = this.config;
    
    // Exponential backoff
    let delay = baseDelay * Math.pow(backoffMultiplier, attempt);
    
    // Cap at max delay
    delay = Math.min(delay, maxDelay);
    
    // Add random jitter (±25%)
    const jitter = delay * jitterRange * (Math.random() * 2 - 1);
    delay = Math.floor(delay + jitter);
    
    return Math.max(delay, 1000); // Minimum 1 second
  },

  /**
   * Should we retry this job?
   */
  shouldRetry(jobId, error) {
    const state = this.getState(jobId);
    
    // Check max retries
    if (state.attempts >= this.config.maxRetries) {
      console.log(`QuantumHire AI: Max retries (${this.config.maxRetries}) reached for job ${jobId}`);
      return false;
    }

    // Check if error is retryable
    if (!this.isRetryable(error)) {
      console.log(`QuantumHire AI: Non-retryable error for job ${jobId}:`, error);
      return false;
    }

    return true;
  },

  /**
   * Record a failed attempt
   */
  recordFailure(jobId, error) {
    const state = this.getState(jobId);
    
    state.attempts++;
    state.lastError = String(error);
    state.lastAttempt = Date.now();
    
    if (this.shouldRetry(jobId, error)) {
      const delay = this.calculateDelay(state.attempts);
      state.nextRetryTime = Date.now() + delay;
      
      console.log(`QuantumHire AI: Job ${jobId} failed (attempt ${state.attempts}). ` +
                  `Retry in ${delay/1000}s`);
      
      return {
        shouldRetry: true,
        delay,
        nextRetryTime: state.nextRetryTime,
        attempts: state.attempts,
      };
    }

    return {
      shouldRetry: false,
      attempts: state.attempts,
      reason: state.attempts >= this.config.maxRetries ? 'max_retries' : 'non_retryable',
    };
  },

  /**
   * Record a successful attempt
   */
  recordSuccess(jobId) {
    this.retryState.delete(jobId);
    console.log(`QuantumHire AI: Job ${jobId} succeeded, cleared retry state`);
  },

  /**
   * Clear retry state for a job
   */
  clear(jobId) {
    this.retryState.delete(jobId);
  },

  /**
   * Clear all retry states
   */
  clearAll() {
    this.retryState.clear();
  },

  /**
   * Get all jobs that are ready for retry
   */
  getReadyForRetry() {
    const now = Date.now();
    const ready = [];
    
    for (const [jobId, state] of this.retryState) {
      if (state.nextRetryTime && state.nextRetryTime <= now) {
        ready.push({ jobId, ...state });
      }
    }
    
    return ready;
  },

  /**
   * Wait for retry delay
   */
  async waitForRetry(jobId) {
    const state = this.getState(jobId);
    
    if (state.nextRetryTime) {
      const waitTime = state.nextRetryTime - Date.now();
      if (waitTime > 0) {
        console.log(`QuantumHire AI: Waiting ${waitTime/1000}s before retry for job ${jobId}`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  },

  /**
   * Execute with retry logic
   */
  async executeWithRetry(jobId, fn, options = {}) {
    const { onRetry, onFinalFailure } = options;
    
    while (true) {
      try {
        const result = await fn();
        this.recordSuccess(jobId);
        return { success: true, result };
      } catch (error) {
        const retryInfo = this.recordFailure(jobId, error);
        
        if (retryInfo.shouldRetry) {
          if (onRetry) {
            onRetry(retryInfo);
          }
          await new Promise(r => setTimeout(r, retryInfo.delay));
          continue;
        }
        
        if (onFinalFailure) {
          onFinalFailure(error, retryInfo);
        }
        
        return {
          success: false,
          error: String(error),
          attempts: retryInfo.attempts,
          reason: retryInfo.reason,
        };
      }
    }
  },

  /**
   * Get statistics
   */
  getStats() {
    const stats = {
      totalTracked: this.retryState.size,
      pendingRetries: 0,
      byAttempts: {},
    };

    for (const [, state] of this.retryState) {
      if (state.nextRetryTime && state.nextRetryTime > Date.now()) {
        stats.pendingRetries++;
      }
      const key = `attempt_${state.attempts}`;
      stats.byAttempts[key] = (stats.byAttempts[key] || 0) + 1;
    }

    return stats;
  },
};

// Export for use in extension
if (typeof window !== 'undefined') {
  window.QuantumHireRetryManager = RetryManager;
}

if (typeof module !== 'undefined') {
  module.exports = RetryManager;
}
