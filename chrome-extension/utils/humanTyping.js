// QuantumHire AI - Human-like Typing Simulation
// Mimics natural human typing patterns to evade bot detection

// Speed multiplier configuration (synced with content.js)
const SPEED_CONFIGS = {
  1: { typeMin: 300, typeMax: 600, clickMin: 400, clickMax: 600 },
  1.5: { typeMin: 200, typeMax: 400, clickMin: 280, clickMax: 450 },
  2: { typeMin: 150, typeMax: 300, clickMin: 200, clickMax: 350 },
  3: { typeMin: 100, typeMax: 200, clickMin: 130, clickMax: 250 }
};

// Get current speed multiplier from storage
async function getSpeedMultiplierLocal() {
  try {
    const data = await chrome.storage.local.get(['speedMultiplier']);
    return data.speedMultiplier || 1;
  } catch (e) {
    return 1;
  }
}

/**
 * Generate a random delay within a range
 * @param {number} min - Minimum delay in ms
 * @param {number} max - Maximum delay in ms
 * @returns {number} Random delay
 */
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Type a string character-by-character with human-like delays
 * @param {HTMLElement} element - Input element to type into
 * @param {string} text - Text to type
 * @param {Object} options - Typing options
 * @returns {Promise<boolean>} Success status
 */
async function humanTypeText(element, text, options = {}) {
  // Get speed config
  const multiplier = await getSpeedMultiplierLocal();
  const speedConfig = SPEED_CONFIGS[multiplier] || SPEED_CONFIGS[1];
  
  const {
    baseDelay = (speedConfig.typeMin + speedConfig.typeMax) / 2,  // Dynamic based on speed
    variance = (speedConfig.typeMax - speedConfig.typeMin) / 2,   // Variance range
    pauseAfterPunctuation = Math.floor(150 / multiplier),         // Scale with speed
    pauseChance = 0.05 / multiplier,    // Reduce thinking pauses at higher speeds
    pauseDuration = Math.floor(300 / multiplier),
    typoChance = multiplier === 1 ? 0.02 : 0,  // Only typos at 1x for realism
    clearFirst = false,
  } = options;

  if (!element || !text) return false;

  try {
    element.focus();
    element.click();

    // Clear field if requested
    if (clearFirst && element.value) {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Skip if field already has matching content
    if (element.value && element.value.trim() === text.trim()) {
      return true;
    }

    // Type character by character
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // Random pause (simulates thinking)
      if (Math.random() < pauseChance) {
        await new Promise(r => setTimeout(r, randomDelay(pauseDuration, pauseDuration * 2)));
      }

      // Simulate typo and correction
      if (Math.random() < typoChance && i < text.length - 1) {
        const typoChar = getRandomTypoChar(char);
        await typeChar(element, typoChar);
        await new Promise(r => setTimeout(r, randomDelay(100, 200)));
        // Backspace to correct
        await simulateBackspace(element);
        await new Promise(r => setTimeout(r, randomDelay(50, 100)));
      }

      // Type the actual character
      await typeChar(element, char);

      // Calculate delay for next character
      let delay = randomDelay(baseDelay - variance, baseDelay + variance);

      // Extra pause after punctuation
      if (['.', ',', '!', '?', ';', ':'].includes(char)) {
        delay += randomDelay(pauseAfterPunctuation / 2, pauseAfterPunctuation);
      }

      // Slightly longer delay at word boundaries
      if (char === ' ') {
        delay += randomDelay(20, 50);
      }

      await new Promise(r => setTimeout(r, delay));
    }

    // Final blur event
    element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
  } catch (error) {
    console.error('QuantumHire AI: Human typing error', error);
    return false;
  }
}

/**
 * Type a single character with proper events
 */
async function typeChar(element, char) {
  // Simulate keydown
  element.dispatchEvent(new KeyboardEvent('keydown', {
    key: char,
    code: getKeyCode(char),
    keyCode: char.charCodeAt(0),
    which: char.charCodeAt(0),
    bubbles: true,
    cancelable: true,
  }));

  // Update value
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set;
  const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set;

  const newValue = (element.value || '') + char;
  
  if (element.tagName === 'INPUT' && nativeInputValueSetter) {
    nativeInputValueSetter.call(element, newValue);
  } else if (element.tagName === 'TEXTAREA' && nativeTextareaValueSetter) {
    nativeTextareaValueSetter.call(element, newValue);
  } else {
    element.value = newValue;
  }

  // Simulate keypress
  element.dispatchEvent(new KeyboardEvent('keypress', {
    key: char,
    code: getKeyCode(char),
    keyCode: char.charCodeAt(0),
    which: char.charCodeAt(0),
    bubbles: true,
    cancelable: true,
  }));

  // Input event for React/Vue/Angular compatibility
  element.dispatchEvent(new Event('input', { bubbles: true }));

  // Simulate keyup
  element.dispatchEvent(new KeyboardEvent('keyup', {
    key: char,
    code: getKeyCode(char),
    keyCode: char.charCodeAt(0),
    which: char.charCodeAt(0),
    bubbles: true,
    cancelable: true,
  }));
}

/**
 * Simulate backspace key
 */
async function simulateBackspace(element) {
  element.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Backspace',
    code: 'Backspace',
    keyCode: 8,
    which: 8,
    bubbles: true,
    cancelable: true,
  }));

  const newValue = element.value.slice(0, -1);
  
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set;
  
  if (element.tagName === 'INPUT' && nativeInputValueSetter) {
    nativeInputValueSetter.call(element, newValue);
  } else {
    element.value = newValue;
  }

  element.dispatchEvent(new Event('input', { bubbles: true }));
  
  element.dispatchEvent(new KeyboardEvent('keyup', {
    key: 'Backspace',
    code: 'Backspace',
    keyCode: 8,
    which: 8,
    bubbles: true,
    cancelable: true,
  }));
}

/**
 * Get keyboard key code for a character
 */
function getKeyCode(char) {
  const code = char.toUpperCase().charCodeAt(0);
  if (char >= 'a' && char <= 'z') return `Key${char.toUpperCase()}`;
  if (char >= 'A' && char <= 'Z') return `Key${char}`;
  if (char >= '0' && char <= '9') return `Digit${char}`;
  if (char === ' ') return 'Space';
  return `Key${char}`;
}

/**
 * Get a random nearby character for typo simulation
 */
function getRandomTypoChar(original) {
  const qwertyNeighbors = {
    'a': ['s', 'q', 'w', 'z'],
    'b': ['v', 'n', 'g', 'h'],
    'c': ['x', 'v', 'd', 'f'],
    'd': ['s', 'f', 'e', 'r', 'c', 'x'],
    'e': ['w', 'r', 's', 'd'],
    'f': ['d', 'g', 'r', 't', 'v', 'c'],
    'g': ['f', 'h', 't', 'y', 'b', 'v'],
    'h': ['g', 'j', 'y', 'u', 'n', 'b'],
    'i': ['u', 'o', 'j', 'k'],
    'j': ['h', 'k', 'u', 'i', 'm', 'n'],
    'k': ['j', 'l', 'i', 'o', ',', 'm'],
    'l': ['k', ';', 'o', 'p', '.', ','],
    'm': ['n', ',', 'j', 'k'],
    'n': ['b', 'm', 'h', 'j'],
    'o': ['i', 'p', 'k', 'l'],
    'p': ['o', '[', 'l', ';'],
    'q': ['w', 'a'],
    'r': ['e', 't', 'd', 'f'],
    's': ['a', 'd', 'w', 'e', 'z', 'x'],
    't': ['r', 'y', 'f', 'g'],
    'u': ['y', 'i', 'h', 'j'],
    'v': ['c', 'b', 'f', 'g'],
    'w': ['q', 'e', 'a', 's'],
    'x': ['z', 'c', 's', 'd'],
    'y': ['t', 'u', 'g', 'h'],
    'z': ['a', 'x', 's'],
  };
  
  const lowerChar = original.toLowerCase();
  const neighbors = qwertyNeighbors[lowerChar];
  
  if (neighbors && neighbors.length > 0) {
    const typo = neighbors[Math.floor(Math.random() * neighbors.length)];
    return original === original.toUpperCase() ? typo.toUpperCase() : typo;
  }
  
  return original;
}

/**
 * Human-like click with slight position variance
 */
async function humanClick(element, options = {}) {
  const { delay = true } = options;
  
  // Get speed config for click delays
  const multiplier = await getSpeedMultiplierLocal();
  const speedConfig = SPEED_CONFIGS[multiplier] || SPEED_CONFIGS[1];
  
  if (!element) return false;

  try {
    // Scroll into view smoothly
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    
    // Wait for scroll - scaled by speed
    const scrollWait = randomDelay(
      Math.floor(200 / multiplier), 
      Math.floor(400 / multiplier)
    );
    await new Promise(r => setTimeout(r, scrollWait));

    // Get element bounds
    const rect = element.getBoundingClientRect();
    
    // Calculate click position with slight variance (like a real cursor)
    const x = rect.left + rect.width / 2 + randomDelay(-5, 5);
    const y = rect.top + rect.height / 2 + randomDelay(-3, 3);

    // Mouse enter
    element.dispatchEvent(new MouseEvent('mouseenter', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
    }));

    // Small delay before click (like real hover-then-click) - scaled by speed
    if (delay) {
      const hoverDelay = randomDelay(
        Math.floor(speedConfig.clickMin / 4),
        Math.floor(speedConfig.clickMax / 4)
      );
      await new Promise(r => setTimeout(r, hoverDelay));
    }

    // Mousedown
    element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      clientX: x,
      clientY: y,
    }));

    // Tiny delay between down and up
    await new Promise(r => setTimeout(r, randomDelay(30, 80)));

    // Mouseup
    element.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      clientX: x,
      clientY: y,
    }));

    // Click
    element.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      clientX: x,
      clientY: y,
    }));

    // Also call native click as fallback
    element.click();

    return true;
  } catch (error) {
    console.error('QuantumHire AI: Human click error', error);
    return false;
  }
}

/**
 * Human-like dropdown selection
 */
async function humanSelectDropdown(selectElement, value, options = {}) {
  if (!selectElement) return false;
  
  try {
    // Click to focus
    await humanClick(selectElement);
    await new Promise(r => setTimeout(r, randomDelay(150, 300)));

    // Find matching option
    const optionsList = Array.from(selectElement.options);
    const valueLower = String(value).toLowerCase().trim();
    
    let match = optionsList.find(o => 
      o.text.toLowerCase().trim() === valueLower ||
      o.value.toLowerCase().trim() === valueLower
    );

    if (!match) {
      match = optionsList.find(o =>
        o.text.toLowerCase().includes(valueLower) ||
        valueLower.includes(o.text.toLowerCase())
      );
    }

    if (match) {
      // Set value
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype, 'value'
      )?.set;
      
      if (nativeSetter) {
        nativeSetter.call(selectElement, match.value);
      } else {
        selectElement.value = match.value;
      }

      // Fire events
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      selectElement.dispatchEvent(new Event('input', { bubbles: true }));
      
      await new Promise(r => setTimeout(r, randomDelay(50, 150)));
      selectElement.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

      return true;
    }

    return false;
  } catch (error) {
    console.error('QuantumHire AI: Dropdown error', error);
    return false;
  }
}

// Export for use in content scripts
if (typeof window !== 'undefined') {
  window.QuantumHireHumanTyping = {
    humanTypeText,
    humanClick,
    humanSelectDropdown,
    randomDelay,
  };
}
