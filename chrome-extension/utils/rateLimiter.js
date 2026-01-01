// QuantumHire AI - Rate Limiter
// Prevents detection by throttling requests and adding natural delays

const RateLimiter = {
  // Rate limit configuration per platform
  limits: {
    linkedin: {
      requestsPerMinute: 10,
      minDelay: 3000,      // 3 seconds minimum between actions
      maxDelay: 8000,      // 8 seconds max random delay
      cooldownAfter: 20,   // Cooldown after 20 applications
      cooldownDuration: 300000, // 5 minute cooldown
    },
    indeed: {
      requestsPerMinute: 15,
      minDelay: 2000,
      maxDelay: 5000,
      cooldownAfter: 30,
      cooldownDuration: 180000,
    },
    greenhouse: {
      requestsPerMinute: 20,
      minDelay: 1500,
      maxDelay: 4000,
      cooldownAfter: 50,
      cooldownDuration: 120000,
    },
    lever: {
      requestsPerMinute: 20,
      minDelay: 1500,
      maxDelay: 4000,
      cooldownAfter: 50,
      cooldownDuration: 120000,
    },
    workday: {
      requestsPerMinute: 8,
      minDelay: 4000,
      maxDelay: 10000,
      cooldownAfter: 15,
      cooldownDuration: 600000, // 10 minute cooldown
    },
    default: {
      requestsPerMinute: 12,
      minDelay: 2500,
      maxDelay: 6000,
      cooldownAfter: 25,
      cooldownDuration: 240000,
    },
  },

  // Track request history per platform
  history: new Map(),

  // Track session state
  sessionState: {
    totalApplications: 0,
    startTime: null,
    pausedUntil: null,
    platformCounts: {},
  },

  /**
   * Get limits for a platform
   */
  getLimits(platform) {
    return this.limits[platform] || this.limits.default;
  },

  /**
   * Get or create history for a platform
   */
  getHistory(platform) {
    if (!this.history.has(platform)) {
      this.history.set(platform, {
        requests: [],
        lastRequest: null,
        consecutiveCount: 0,
        inCooldown: false,
        cooldownEnds: null,
      });
    }
    return this.history.get(platform);
  },

  /**
   * Clean old requests from history (older than 1 minute)
   */
  cleanHistory(platform) {
    const history = this.getHistory(platform);
    const oneMinuteAgo = Date.now() - 60000;
    history.requests = history.requests.filter(t => t > oneMinuteAgo);
  },

  /**
   * Check if we're rate limited
   */
  isRateLimited(platform) {
    const limits = this.getLimits(platform);
    const history = this.getHistory(platform);
    
    // Check cooldown
    if (history.inCooldown && history.cooldownEnds > Date.now()) {
      const remaining = Math.ceil((history.cooldownEnds - Date.now()) / 1000);
      console.log(`QuantumHire AI: ${platform} in cooldown for ${remaining}s`);
      return { limited: true, reason: 'cooldown', remainingSeconds: remaining };
    } else if (history.inCooldown) {
      // Cooldown ended
      history.inCooldown = false;
      history.cooldownEnds = null;
      history.consecutiveCount = 0;
    }
    
    // Clean old requests
    this.cleanHistory(platform);
    
    // Check requests per minute
    if (history.requests.length >= limits.requestsPerMinute) {
      const oldestRequest = history.requests[0];
      const waitTime = oldestRequest + 60000 - Date.now();
      if (waitTime > 0) {
        console.log(`QuantumHire AI: ${platform} rate limited, wait ${Math.ceil(waitTime/1000)}s`);
        return { limited: true, reason: 'rate_limit', waitMs: waitTime };
      }
    }
    
    // Check consecutive applications (trigger cooldown)
    if (history.consecutiveCount >= limits.cooldownAfter) {
      history.inCooldown = true;
      history.cooldownEnds = Date.now() + limits.cooldownDuration;
      console.log(`QuantumHire AI: ${platform} cooldown triggered for ${limits.cooldownDuration/1000}s`);
      return { 
        limited: true, 
        reason: 'cooldown_triggered', 
        remainingSeconds: Math.ceil(limits.cooldownDuration / 1000),
      };
    }
    
    return { limited: false };
  },

  /**
   * Calculate delay before next request
   */
  getDelay(platform) {
    const limits = this.getLimits(platform);
    const history = this.getHistory(platform);
    
    let baseDelay = limits.minDelay;
    
    // Increase delay based on consecutive count (more cautious with more apps)
    if (history.consecutiveCount > 5) {
      baseDelay += 1000;
    }
    if (history.consecutiveCount > 10) {
      baseDelay += 2000;
    }
    if (history.consecutiveCount > 15) {
      baseDelay += 3000;
    }
    
    // Add random variance
    const variance = limits.maxDelay - limits.minDelay;
    const randomDelay = Math.floor(Math.random() * variance);
    
    return baseDelay + randomDelay;
  },

  /**
   * Record a request
   */
  recordRequest(platform) {
    const history = this.getHistory(platform);
    
    history.requests.push(Date.now());
    history.lastRequest = Date.now();
    history.consecutiveCount++;
    
    this.sessionState.totalApplications++;
    this.sessionState.platformCounts[platform] = 
      (this.sessionState.platformCounts[platform] || 0) + 1;
    
    console.log(`QuantumHire AI: Recorded request for ${platform}. ` +
                `Consecutive: ${history.consecutiveCount}, ` +
                `Per minute: ${history.requests.length}`);
  },

  /**
   * Wait for rate limit if needed
   */
  async waitIfLimited(platform) {
    const status = this.isRateLimited(platform);
    
    if (status.limited) {
      const waitTime = status.waitMs || (status.remainingSeconds * 1000) || 30000;
      console.log(`QuantumHire AI: Waiting ${waitTime/1000}s due to rate limit`);
      await new Promise(r => setTimeout(r, waitTime));
      return true;
    }
    
    return false;
  },

  /**
   * Wait for natural delay between requests
   */
  async waitBetweenRequests(platform) {
    const delay = this.getDelay(platform);
    console.log(`QuantumHire AI: Natural delay ${delay/1000}s before next ${platform} request`);
    await new Promise(r => setTimeout(r, delay));
  },

  /**
   * Execute with rate limiting
   */
  async execute(platform, fn) {
    // Check if limited
    await this.waitIfLimited(platform);
    
    // Natural delay
    await this.waitBetweenRequests(platform);
    
    // Record request
    this.recordRequest(platform);
    
    // Execute
    return fn();
  },

  /**
   * Reset platform history
   */
  resetPlatform(platform) {
    this.history.delete(platform);
    console.log(`QuantumHire AI: Rate limit history cleared for ${platform}`);
  },

  /**
   * Reset all history
   */
  resetAll() {
    this.history.clear();
    this.sessionState = {
      totalApplications: 0,
      startTime: Date.now(),
      pausedUntil: null,
      platformCounts: {},
    };
    console.log('QuantumHire AI: All rate limit history cleared');
  },

  /**
   * Get session statistics
   */
  getStats() {
    const stats = {
      ...this.sessionState,
      platformStats: {},
    };
    
    for (const [platform, history] of this.history) {
      const limits = this.getLimits(platform);
      stats.platformStats[platform] = {
        requestsLastMinute: history.requests.length,
        consecutiveCount: history.consecutiveCount,
        inCooldown: history.inCooldown,
        cooldownRemaining: history.cooldownEnds ? 
          Math.max(0, Math.ceil((history.cooldownEnds - Date.now()) / 1000)) : 0,
        limit: limits.requestsPerMinute,
      };
    }
    
    return stats;
  },

  /**
   * Pause all platforms for a duration
   */
  pauseAll(durationMs) {
    this.sessionState.pausedUntil = Date.now() + durationMs;
    console.log(`QuantumHire AI: All platforms paused for ${durationMs/1000}s`);
  },

  /**
   * Check if globally paused
   */
  isPaused() {
    return this.sessionState.pausedUntil && 
           this.sessionState.pausedUntil > Date.now();
  },
};

// Export for use in extension
if (typeof window !== 'undefined') {
  window.QuantumHireRateLimiter = RateLimiter;
}
