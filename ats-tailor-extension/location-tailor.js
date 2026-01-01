/**
 * Location Tailor Module
 * Extracts and normalizes job location for dynamic CV tailoring
 * Handles REMOTE (anywhere in US) -> "United States" conversion
 */

(function() {
  'use strict';

  const LocationTailor = {
    // Location extraction selectors in priority order
    LOCATION_SELECTORS: [
      '.job-location',
      '[data-location]',
      '.location',
      '[class*="location"]',
      '[class*="Location"]',
      '.job-meta .location',
      '.job-details .location',
      '[data-automation="job-location"]',
      '[data-testid="job-location"]',
      '.jd-header-location',
      '.posting-location',
      '.job-info .location',
      'span[class*="location"]',
      'div[class*="location"]',
      '.workplace-type',
      '.job-workplace'
    ],

    // Country mapping for normalization
    COUNTRY_MAP: {
      'us': 'United States',
      'usa': 'United States',
      'united states': 'United States',
      'u.s.': 'United States',
      'u.s.a.': 'United States',
      'america': 'United States',
      'uk': 'United Kingdom',
      'united kingdom': 'United Kingdom',
      'great britain': 'United Kingdom',
      'england': 'United Kingdom',
      'gb': 'United Kingdom',
      'canada': 'Canada',
      'ca': 'Canada',
      'australia': 'Australia',
      'au': 'Australia',
      'germany': 'Germany',
      'de': 'Germany',
      'france': 'France',
      'fr': 'France',
      'ireland': 'Ireland',
      'ie': 'Ireland',
      'netherlands': 'Netherlands',
      'nl': 'Netherlands'
    },

    // US State abbreviations
    US_STATES: {
      'al': 'Alabama', 'ak': 'Alaska', 'az': 'Arizona', 'ar': 'Arkansas',
      'ca': 'California', 'co': 'Colorado', 'ct': 'Connecticut', 'de': 'Delaware',
      'fl': 'Florida', 'ga': 'Georgia', 'hi': 'Hawaii', 'id': 'Idaho',
      'il': 'Illinois', 'in': 'Indiana', 'ia': 'Iowa', 'ks': 'Kansas',
      'ky': 'Kentucky', 'la': 'Louisiana', 'me': 'Maine', 'md': 'Maryland',
      'ma': 'Massachusetts', 'mi': 'Michigan', 'mn': 'Minnesota', 'ms': 'Mississippi',
      'mo': 'Missouri', 'mt': 'Montana', 'ne': 'Nebraska', 'nv': 'Nevada',
      'nh': 'New Hampshire', 'nj': 'New Jersey', 'nm': 'New Mexico', 'ny': 'New York',
      'nc': 'North Carolina', 'nd': 'North Dakota', 'oh': 'Ohio', 'ok': 'Oklahoma',
      'or': 'Oregon', 'pa': 'Pennsylvania', 'ri': 'Rhode Island', 'sc': 'South Carolina',
      'sd': 'South Dakota', 'tn': 'Tennessee', 'tx': 'Texas', 'ut': 'Utah',
      'vt': 'Vermont', 'va': 'Virginia', 'wa': 'Washington', 'wv': 'West Virginia',
      'wi': 'Wisconsin', 'wy': 'Wyoming', 'dc': 'Washington D.C.'
    },

    /**
     * Extract location from job page HTML
     * @param {Document|string} source - DOM document or HTML string
     * @returns {string} Normalized location or fallback
     */
    extractJobLocation(source) {
      let doc = source;
      
      // If string, parse as HTML
      if (typeof source === 'string') {
        const parser = new DOMParser();
        doc = parser.parseFromString(source, 'text/html');
      }

      // Try each selector in priority order
      for (const selector of this.LOCATION_SELECTORS) {
        try {
          const el = doc.querySelector(selector);
          if (el?.textContent?.trim()) {
            const normalized = this.normalizeLocation(el.textContent.trim());
            if (normalized && normalized !== 'Open to relocation') {
              console.log('[LocationTailor] Found location:', el.textContent, '->', normalized);
              return normalized;
            }
          }
        } catch (e) {
          // Selector may fail on some pages, continue
        }
      }

      // Fallback: Search page text for location patterns
      const bodyText = doc.body?.textContent || '';
      const locationFromText = this.extractLocationFromText(bodyText);
      if (locationFromText) {
        console.log('[LocationTailor] Extracted from text:', locationFromText);
        return locationFromText;
      }

      return 'Open to relocation';
    },

    /**
     * Extract location from job data object
     * @param {Object} jobData - Job data with location field
     * @returns {string} Normalized location
     */
    extractFromJobData(jobData) {
      if (!jobData) return 'Open to relocation';

      // Check common location fields
      const locationText = jobData.location || 
                          jobData.jobLocation || 
                          jobData.workplace || 
                          jobData.city ||
                          '';

      if (locationText) {
        return this.normalizeLocation(locationText);
      }

      // Check if HTML is available
      if (jobData.html) {
        return this.extractJobLocation(jobData.html);
      }

      return 'Open to relocation';
    },

    /**
     * Normalize location string to professional format
     * Handles: "REMOTE (anywhere in US)" -> "United States"
     * @param {string} text - Raw location text
     * @returns {string} Normalized location
     */
    normalizeLocation(text) {
      if (!text) return 'Open to relocation';
      
      let location = text.toLowerCase().trim();
      
      // Remove common noise
      location = location
        .replace(/[\(\[\{].*?[\)\]\}]/g, ' ') // Remove parentheticals first pass
        .replace(/remote\s*[-–—]?\s*/gi, '')
        .replace(/hybrid\s*[-–—]?\s*/gi, '')
        .replace(/on-?site\s*[-–—]?\s*/gi, '')
        .replace(/anywhere\s*(in|within)?\s*/gi, '')
        .replace(/work\s*from\s*(home|anywhere)/gi, '')
        .replace(/fully?\s*remote/gi, '')
        .replace(/,?\s*remote\s*$/gi, '')
        .trim();

      // Handle "REMOTE (anywhere in US)" pattern
      if (text.toLowerCase().includes('us') || 
          text.toLowerCase().includes('united states') ||
          text.toLowerCase().includes('usa')) {
        
        // Extract city if present before US
        const cityMatch = text.match(/([A-Za-z\s]+)(?:,\s*)(?:US|USA|United\s*States)/i);
        if (cityMatch && cityMatch[1].trim().length > 1) {
          const city = this.capitalizeWords(cityMatch[1].trim());
          // Filter out noise words
          if (!['remote', 'anywhere', 'in', 'the', 'hybrid'].includes(city.toLowerCase())) {
            return `${city}, United States`;
          }
        }
        return 'United States';
      }

      // Check for country codes/names
      for (const [code, country] of Object.entries(this.COUNTRY_MAP)) {
        if (location.includes(code)) {
          // Extract city before country
          const parts = location.split(/[,\s]+/);
          const countryIndex = parts.findIndex(p => p.includes(code));
          if (countryIndex > 0) {
            const cityParts = parts.slice(0, countryIndex).filter(p => 
              !['remote', 'hybrid', 'anywhere', 'in', 'the'].includes(p)
            );
            if (cityParts.length > 0) {
              const city = this.capitalizeWords(cityParts.join(' '));
              return `${city}, ${country}`;
            }
          }
          return country;
        }
      }

      // Check for US state abbreviations
      for (const [abbr, stateName] of Object.entries(this.US_STATES)) {
        const statePattern = new RegExp(`\\b${abbr}\\b`, 'i');
        if (statePattern.test(location)) {
          // Extract city before state
          const cityMatch = location.match(new RegExp(`([A-Za-z\\s]+),?\\s*${abbr}`, 'i'));
          if (cityMatch && cityMatch[1].trim().length > 1) {
            const city = this.capitalizeWords(cityMatch[1].trim());
            if (!['remote', 'anywhere', 'in', 'hybrid'].includes(city.toLowerCase())) {
              return `${city}, ${stateName}, United States`;
            }
          }
          return `${stateName}, United States`;
        }
      }

      // If we have meaningful text remaining, capitalize it
      if (location.length > 1 && !['remote', 'hybrid', 'anywhere'].includes(location)) {
        return this.capitalizeWords(location);
      }

      return 'Open to relocation';
    },

    /**
     * Extract location from free text using patterns
     * @param {string} text - Full page text
     * @returns {string|null} Extracted location or null
     */
    extractLocationFromText(text) {
      if (!text) return null;

      // Common patterns
      const patterns = [
        /location[:\s]+([A-Za-z\s,]+(?:US|USA|United States))/i,
        /based\s+in\s+([A-Za-z\s,]+)/i,
        /office[:\s]+([A-Za-z\s,]+)/i,
        /([A-Za-z\s]+),\s*(US|USA|United States)/i,
        /remote\s*\(([^)]+)\)/i
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const normalized = this.normalizeLocation(match[1]);
          if (normalized !== 'Open to relocation') {
            return normalized;
          }
        }
      }

      return null;
    },

    /**
     * Capitalize each word in a string
     * @param {string} str - Input string
     * @returns {string} Capitalized string
     */
    capitalizeWords(str) {
      return str.split(/\s+/)
        .filter(w => w.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    },

    /**
     * Generate tailored CV header with dynamic location
     * @param {Object} candidateData - User profile data
     * @param {string} tailoredLocation - Normalized job location
     * @returns {string} Formatted header
     */
    generateHeader(candidateData, tailoredLocation) {
      const phone = candidateData.phone || '+353 0874261508';
      const email = candidateData.email || 'maxokafordev@gmail.com';
      const location = tailoredLocation || 'Open to relocation';
      const linkedin = candidateData.linkedin || 'https://www.linkedin.com/in/maxokafor/';
      const github = candidateData.github || 'https://github.com/MaxmilliamOkafor';
      const portfolio = candidateData.portfolio || 'https://maxmilliamplusplus.web.app/';

      return `${phone} | ${email} | ${location} | open to relocation
${linkedin} | ${github} | ${portfolio}`;
    }
  };

  // Export to global scope
  window.LocationTailor = LocationTailor;
})();
