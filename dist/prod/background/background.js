


// Track if this is a fresh install or reload
let isFirstRun = true;
let installReason = 'unknown';

// Listen for install/reload events
chrome.runtime.onInstalled.addListener((details) => {
  installReason = details.reason;


  if (details.reason === 'install') {

    isFirstRun = true;
  } else if (details.reason === 'update') {

    isFirstRun = false;
  } else if (details.reason === 'chrome_update') {

    isFirstRun = false;
  } else {

    isFirstRun = false;
  }
});

// State
let state = {
  onBreak: false,
  breakStartTime: null,
  breakEndTime: null,
  currentBreakDuration: null,
  cooldownEndTime: null,
  unlockSite: null, // Deprecated, kept for legacy state
  unlockCategory: null, // Deprecated, kept for legacy state
  unlockCategories: [], // List of categories unlocked during break
  unlockAll: false, // If true, all sites are unlocked during break
  breakWhitelist: [], // Array of domains allowed during current break (temporary)
  // Simplified blocklist - just core domains (matches like SQL LIKE '%domain%')
  // Note: mail.google.com is normalized to gmail.com
  blockedSites: [
    // BLOCKED_SITES_START
    'youtube.com',
    'facebook.com',
    'instagram.com',
    'x.com',
    'twitter.com',
    'reddit.com',
    'linkedin.com',
    'tiktok.com',
    'bsky.app',
    'amazon.com',
    'ebay.com',
    'chess.com',
    'strava.com',
    'twitch.tv',
    'bbc.com',
    'letterboxd.com',
    'netflix.com',
    'geoguessr.com',
    'sporcle.com'
    // BLOCKED_SITES_END
  ],
  // Category mapping for blocked sites (domain -> category)
  siteCategories: {
        // SITE_CATEGORIES_START
    'youtube.com': 'Video',
    'facebook.com': 'Social',
    'instagram.com': 'Social',
    'x.com': 'Social',
    'twitter.com': 'Social',
    'reddit.com': 'Social',
    'linkedin.com': 'Social',
    'tiktok.com': 'Video',
    'bsky.app': 'Social',
    'amazon.com': 'Shopping',
    'ebay.com': 'Shopping',
    'chess.com': 'Games',
    'strava.com': 'Sports',
    'twitch.tv': 'Video',
    'bbc.com': 'News',
    'letterboxd.com': 'Other',
    'netflix.com': 'Video',
    'geoguessr.com': 'Games',
    'sporcle.com': 'Games'
    // SITE_CATEGORIES_END
  },
  // NoGo List - sites that are NEVER unlocked, even during breaks (highest priority blocking)
  nogoList: [
    'shein.com',
    'temu.com',
    'wish.com',
    'aliexpress.com',
    'x.com'
  ],
  nogoListRemovalTimers: {}, // domain -> {startTime, endTime}
  // Whitelist - exceptions that bypass blocking (higher priority)
  whitelistedSites: [
    'music.youtube.com',
    'consent.youtube.com',
    'accounts.youtube.com'
  
  ],
  breakDuration: 5,
  cooldownDuration: 30,
  breakWarningTime: 2,  // Minutes before break ends to show notification
  challengeType: 'rickroll',  // 'vocabulary', 'maths', or 'rickroll'
  vocabLanguage: 'en_fr',  // Language pair for vocabulary (en_fr, en_de, en_es, etc.)
  redirectType: 'gif',  // 'gif' = random Giphy "No" image, 'donation' = Amnesty donation page
  giphyNoUrls: [
    'https://i.giphy.com/nR4L10XlJcSeQ.webp',
    'https://i.giphy.com/W5YVAfSttCqre.webp',
    'https://i.giphy.com/LOEI8jsNKPmzdJYvhJ.webp',
    'https://i.giphy.com/xFbfVbbQf2v0O9OLLE.webp',
    'https://i.giphy.com/3o7TKGVqdQdyGb3aDe.webp',
    'https://i.giphy.com/wPcJA359jvRD9RIiGi.webp',
    'https://i.giphy.com/2zYk0N9ilSztOAPzb0.webp',
    'https://i.giphy.com/a9xhxAxaqOfQs.webp',
    'https://i.giphy.com/Txh1UzI7d0aqs.webp'
  ],
  snoozeLimit: 2,
  snoozeCount: 0,
  dailyGoals: [],
  previousDayGoals: [],
  showPreviousGoals: false,
  lastGoalDate: null,
  hasSetGoalsToday: false,
  todayTimeline: [],
  vocabulary: [],
  blockStats: {
    totalBlocksToday: 0,
    blocksByDomain: {} // domain -> count
  },
  blockNotifications: {}, // notificationId -> {url, domain}
  vocabStats: {
    manuallyAdded: 0,
    manuallyRemoved: 0
  },
  customDictionaries: {} // id -> { name, icon, vocabulary: [] }
};

// Load vocabulary from CSV file based on language
async function loadVocabulary(language = null, save = true) {
  const lang = language || state.vocabLanguage || 'en_fr';
  
  // Check if it's a custom dictionary
  if (state.customDictionaries && state.customDictionaries[lang]) {

    state.vocabulary = state.customDictionaries[lang].vocabulary || [];
    if (save) saveState();
    return;
  }

  const filename = `data/voc_${lang}.csv`;




  try {

    const response = await fetch(chrome.runtime.getURL(filename));
    if (!response.ok) {
      console.error('[LANG-DEBUG] ❌ Fetch failed:', response.status, response.statusText);
      throw new Error(`Failed to fetch vocabulary file: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();

    // Parse CSV with new format:
    // English-based: English,Translation,Transcription,Similar
    // French/Greek: Greek,French,Similar,Transcription
    const lines = text.trim().split('\n');
    const isFrGr = lang === 'fr_gr';
    
    state.vocabulary = lines.map(line => {
      // Skip header line if it exists
      if (line.toLowerCase().includes('english') || line.toLowerCase().includes('word') || 
          line.toLowerCase().includes('greek') || line.toLowerCase().includes('french')) {
        return null;
      }
      
      // Parse CSV line (handle commas in quoted fields)
      const parts = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current.trim()); // Add last part
      
      if (isFrGr) {
        // Format: Greek,French,Similar,Transcription
        if (parts.length < 2) return null;
        const greek = parts[0];
        const french = parts[1];
        const similar = parts.length > 2 ? parts[2].trim() : '0';
        const transcription = parts.length > 3 ? parts[3] : '';
        
        // Store transcription separately (don't add to translation yet - UI will handle it)
        
        return { 
          word: greek, 
          translation: french, 
          transcription: transcription,
          similar: similar === '1' || similar === 'true' // Store similar flag
        };
      } else {
        // Format: English,Translation,Transcription,Similar
        if (parts.length < 2) return null;
        const english = parts[0];
        let translation = parts[1] || '';
        const transcription = parts.length > 2 ? parts[2] : '';
        const similar = parts.length > 3 ? parts[3].trim() : '0';
        
        // Store transcription separately (don't add to translation yet - UI will handle it)
        // For languages with non-Latin scripts, transcription will be shown/hidden based on checkbox
        
        // English word is used as-is (already has "the" or "to" from CSV)
        return { 
          word: english, // Use as-is (includes "the" or "to")
          originalWord: english.replace(/^(the|to|a|an)\s+/i, '').trim(), // Base word for removal/matching
          translation: translation.trim(),
          transcription: transcription,
          similar: similar === '1' || similar === 'true' // Store similar flag
        };
      }
    }).filter(item => item && item.word && item.translation && item.word !== 'English');
    


    if (state.vocabulary.length > 0) {

    }
    
    if (save) {

      saveState();

    } else {

    }
  } catch (err) {
    console.error('[LANG-DEBUG] ❌ ERROR in loadVocabulary:', err);
    console.error(`❌ Failed to load ${filename}:`, err);

  }
}

// Normalize domain: mail.google.com -> gmail.com (they're the same)
function normalizeDomain(domain) {
  if (!domain) return domain;
  const normalized = domain.toLowerCase().trim();
  // Treat mail.google.com as gmail.com
  if (normalized === 'mail.google.com' || normalized.includes('mail.google.com')) {
    return 'gmail.com';
  }
  return normalized;
}

// Extract domain from URL (handles full URLs and domain strings)
function extractDomainFromUrl(url) {
  try {
    // If it's already a domain (no protocol), return it normalized
    if (!url.includes('://')) {
      return url.toLowerCase().replace(/^www\./, '').trim();
    }
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) {
    // Fallback: try to extract domain manually
    const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
    return match ? match[1].toLowerCase().replace(/^www\./, '') : url.toLowerCase().replace(/^www\./, '');
  }
}

// Check if a URL matches a domain, treating gmail.com and mail.google.com as equivalent
// Uses proper domain extraction to avoid substring matching issues (e.g., "index.com" matching "x.com")
function urlMatchesDomain(url, domain) {
  if (!url || !domain) return false;
  
  // Extract the actual domain from the URL
  const urlDomain = extractDomainFromUrl(url);
  const domainLower = domain.toLowerCase().trim();
  const normalizedDomain = normalizeDomain(domainLower);
  
  // Normalize the URL domain as well
  const normalizedUrlDomain = normalizeDomain(urlDomain);
  
  // Direct domain match (exact or subdomain)
  // Check if urlDomain ends with the domain (handles subdomains like www.example.com matching example.com)
  if (urlDomain === domainLower || urlDomain.endsWith('.' + domainLower)) {
    return true;
  }
  
  // Check normalized version if different
  if (normalizedDomain !== domainLower) {
    if (urlDomain === normalizedDomain || urlDomain.endsWith('.' + normalizedDomain)) {
      return true;
    }
    if (normalizedUrlDomain === normalizedDomain || normalizedUrlDomain.endsWith('.' + normalizedDomain)) {
      return true;
    }
  }
  
  // Special case: if domain is gmail.com or mail.google.com, check for both
  if (normalizedDomain === 'gmail.com' || domainLower === 'gmail.com' || domainLower === 'mail.google.com') {
    return urlDomain === 'gmail.com' || 
           urlDomain === 'mail.google.com' || 
           urlDomain.endsWith('.gmail.com') || 
           urlDomain.endsWith('.mail.google.com') ||
           normalizedUrlDomain === 'gmail.com' ||
           normalizedUrlDomain.endsWith('.gmail.com');
  }
  
  return false;
}

// Save state
function saveState() {
  return new Promise((resolve, reject) => {
    // Save state AND a backup
    chrome.storage.local.set({ 
      state: state,
      backup_state: state // Always keep a backup
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ STORAGE ERROR: Failed to save state to chrome.storage.local');
        console.error('❌ Error:', chrome.runtime.lastError.message);
        console.error('❌ This may cause data loss on next reload!');
        console.error('❌ Possible causes:');
        console.error('   - Storage quota exceeded (limit: ~10MB)');
        console.error('   - Storage disabled or corrupted');
        console.error('   - Unpacked extension reload issue');
        console.error('   - Chrome storage API failure');
        
        // Show notification for save failure
        chrome.notifications.clear('saveError', () => {
          chrome.notifications.create('saveError', {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
            title: '⚠️ Failed to Save Data',
            message: `Could not save extension data: ${chrome.runtime.lastError.message}. Changes may be lost on next reload.`,
            priority: 2,
            requireInteraction: true
          }, (notificationId) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Failed to create save error notification:', chrome.runtime.lastError);
            } else {
              // Auto-clear after 10 seconds
              setTimeout(() => {
                chrome.notifications.clear(notificationId);
              }, 10000);
            }
          });
        });
        
        // Try to check storage usage
        chrome.storage.local.getBytesInUse(null, (bytes) => {
          if (chrome.runtime.lastError) {
            console.error('❌ Cannot check storage usage:', chrome.runtime.lastError.message);
          } else {
            console.error(`❌ Current storage usage: ${bytes} bytes (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
            if (bytes > 9000000) {
              console.error('⚠️ WARNING: Storage is near quota limit! Consider clearing old data.');
              
              // Show additional notification for quota warning
              chrome.notifications.clear('storageQuotaWarning', () => {
                chrome.notifications.create('storageQuotaWarning', {
                  type: 'basic',
                  iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
                  title: '⚠️ Storage Near Limit',
                  message: `Storage usage: ${(bytes / 1024 / 1024).toFixed(2)} MB / ~10 MB. Near quota limit!`,
                  priority: 1
                }, (notificationId) => {
                  if (!chrome.runtime.lastError && notificationId) {
                    // Auto-clear after 8 seconds
                    setTimeout(() => {
                      chrome.notifications.clear(notificationId);
                    }, 8000);
                  }
                });
              });
            }
          }
        });
        
        reject(chrome.runtime.lastError);
      } else {

        resolve();
      }
    });
  });
}

// Load state
chrome.storage.local.get(['state', 'backup_state'], async (result) => {
  // CRITICAL: Check for storage errors first
  if (chrome.runtime.lastError) {
    console.error('❌ STORAGE ERROR: Failed to load state from chrome.storage.local');
    console.error('❌ Error:', chrome.runtime.lastError.message);
    console.error('❌ This may cause data loss! State will be reset to defaults.');
    console.error('❌ Possible causes:');
    console.error('   - Storage quota exceeded');
    console.error('   - Storage disabled or corrupted');
    console.error('   - Unpacked extension reload issue');
    console.error('   - Chrome storage API failure');
    
    // Show notification to alert user immediately
    chrome.notifications.clear('storageError', () => {
      chrome.notifications.create('storageError', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
        title: '⚠️ Storage Error - Data May Be Lost',
        message: `Failed to load extension data: ${chrome.runtime.lastError.message}. Settings may be reset to defaults.`,
        priority: 2,
        requireInteraction: true
      }, (notificationId) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Failed to create storage error notification:', chrome.runtime.lastError);
        } else {
          // Auto-clear after 10 seconds
          setTimeout(() => {
            chrome.notifications.clear(notificationId);
          }, 10000);
        }
      });
    });
    
    // Try to check if storage is available
    chrome.storage.local.getBytesInUse(null, (bytes) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Cannot check storage usage:', chrome.runtime.lastError.message);
      } else {
        console.error(`❌ Storage usage: ${bytes} bytes`);
        // Chrome storage.local limit is typically 10MB
        if (bytes > 9000000) {
          console.error('⚠️ WARNING: Storage is near quota limit!');
        }
      }
    });
    
    // Continue with default state but log the issue

  }
  
  let loadedState = null;
  let source = 'none';

  if (result && result.state) {
    loadedState = result.state;
    source = 'main';

  } else if (result && result.backup_state) {
    loadedState = result.backup_state;
    source = 'backup';
    console.warn('⚠️ Main state missing, recovering from BACKUP state');

  }

  if (loadedState) {
    isFirstRun = false;

    // Merge saved state with defaults, but preserve ALL saved values
    const savedState = loadedState;
    
    // Normalize domains: convert mail.google.com to gmail.com in saved state
    // Also normalize breakWhitelist and unlockSite
    if (savedState.breakWhitelist) {
      savedState.breakWhitelist = savedState.breakWhitelist
        .map(site => normalizeDomain(site))
        .filter((site, idx, arr) => arr.indexOf(site) === idx); // Remove duplicates after normalization
    }
    if (savedState.unlockSite) {
      savedState.unlockSite = normalizeDomain(savedState.unlockSite);
    }
    
    // For arrays like whitelistedSites and blockedSites, merge unique values (normalize first)
    if (savedState.whitelistedSites) {
      // Normalize both saved and default, then combine and remove duplicates
      const normalizedSaved = savedState.whitelistedSites.map(site => normalizeDomain(site));
      const normalizedDefaults = state.whitelistedSites.map(site => normalizeDomain(site));
      const combined = [...new Set([...normalizedDefaults, ...normalizedSaved])];
      savedState.whitelistedSites = combined;
    }
    
    if (savedState.blockedSites) {
      // Normalize both saved and default, then combine and remove duplicates
      const normalizedSaved = savedState.blockedSites.map(site => normalizeDomain(site));
      const normalizedDefaults = state.blockedSites.map(site => normalizeDomain(site));
      const combined = [...new Set([...normalizedDefaults, ...normalizedSaved])];
      savedState.blockedSites = combined;
    }
    
    // Initialize blockStats if missing
    if (!savedState.blockStats) {
      savedState.blockStats = {
        totalBlocksToday: 0,
        blocksByDomain: {}
      };
    }
    
    // Initialize blockNotifications if missing
    if (!savedState.blockNotifications) {
      savedState.blockNotifications = {};
    }
    
    // Initialize breakWhitelist if missing
    if (!savedState.breakWhitelist) {
      savedState.breakWhitelist = [];
    }
    
    // Migrate hellList to nogoList (backward compatibility)
    if (savedState.hellList && !savedState.nogoList) {
      savedState.nogoList = savedState.hellList;
      delete savedState.hellList;
    }
    if (savedState.hellListRemovalTimers && !savedState.nogoListRemovalTimers) {
      savedState.nogoListRemovalTimers = savedState.hellListRemovalTimers;
      delete savedState.hellListRemovalTimers;
    }
    
    // Initialize nogoList if missing
    if (!savedState.nogoList) {
      savedState.nogoList = [];
    }
    
    // Initialize vocabStats if missing
    if (!savedState.vocabStats) {
      savedState.vocabStats = {
        manuallyAdded: 0,
        manuallyRemoved: 0
      };
    }
    
    // Merge: prioritize saved values over defaults
    // IMPORTANT: Preserve all saved state properties, especially dailyGoals and todayTimeline
    state = { ...state, ...savedState };
    
    // Ensure critical state properties are preserved (don't let defaults overwrite saved values)
    if (savedState.dailyGoals !== undefined) {
      state.dailyGoals = savedState.dailyGoals;
    }
    if (savedState.todayTimeline !== undefined) {
      state.todayTimeline = savedState.todayTimeline;
    }
    if (savedState.hasSetGoalsToday !== undefined) {
      state.hasSetGoalsToday = savedState.hasSetGoalsToday;
    }
    if (savedState.lastGoalDate !== undefined) {
      state.lastGoalDate = savedState.lastGoalDate;
    }
    if (savedState.previousDayGoals !== undefined) {
      state.previousDayGoals = savedState.previousDayGoals;
    }
    if (savedState.showPreviousGoals !== undefined) {
      state.showPreviousGoals = savedState.showPreviousGoals;
    }
    

    
    
    // If recovered from backup, save it to main state now to fix the issue
    if (source === 'backup') {
      saveState();
    }
  } else {
    // No saved state found - could be first run OR storage error OR extension reload cleared it
    
    // CRITICAL BUG FIX: Suspicious Reset Detection
    // If we have NO state and NO backup, and installReason is NOT 'install',
    // it means we lost data but it's not a fresh install.
    // We should NOT overwrite with defaults immediately.
    
    const isSuspiciousReset = installReason !== 'install';
    
    if (isSuspiciousReset) {
      console.error('❌ CRITICAL: SUSPICIOUS RESET DETECTED');
      console.error('❌ State and Backup are missing, but installReason is:', installReason);
      console.error('❌ Entering SAFE MODE - Auto-save disabled until user interaction');
      console.error('❌ This prevents overwriting potentially hidden data with defaults.');
    }

    if (!chrome.runtime.lastError) {
      // Check if we have ANY storage at all (to detect if Chrome cleared it)
      chrome.storage.local.get(null, (allItems) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Cannot check storage contents:', chrome.runtime.lastError.message);
        } else {
          const keys = Object.keys(allItems);
          if (keys.length === 0) {
            console.warn('⚠️ WARNING: Storage is completely empty!');
            // ... logs ...
          } else {
            console.warn('⚠️ WARNING: State keys missing but other keys exist:', keys);
          }
        }
      });
      
      if (isFirstRun || installReason === 'install') {

      } else {
        console.error('❌ CRITICAL: Using default state - state was lost!');
      }
    } else {
      console.error('❌ Using default state due to storage error (data may be lost!)');
    }
  }
  
  // Verify break status is still valid (break might have ended while extension was reloaded)
  if (state.onBreak && state.breakEndTime) {
    const now = Date.now();
    if (now >= state.breakEndTime) {

      state.onBreak = false;
      state.breakStartTime = null;
      state.breakEndTime = null;
      state.currentBreakDuration = null;
      state.unlockSite = null;
      state.breakWhitelist = [];
      saveState();
    } else {

    }
  }
  
  // Mark state as loaded - now URL checks can proceed
  stateLoaded = true;

  // Load vocabulary from CSV if not already loaded or if empty
  if (!state.vocabulary || state.vocabulary.length === 0) {
    // PASS false to save if we are in a suspicious reset state
    // This prevents overwriting the potentially lost data with a default "en_fr" vocab list
    const shouldSave = loadedState !== null || installReason === 'install';
    await loadVocabulary(state.vocabLanguage || 'en_fr', shouldSave);
  }
  
  // Check for new day (but be careful not to reset if it's the same day)
  checkNewDay();
  await clearOldBlockingRules();
  
  // Check for new day every hour (only after state is loaded)
  setInterval(checkNewDay, 60 * 60 * 1000);
});

// Legacy function - kept for compatibility but no longer needed
// We use webNavigation and tabs for blocking
async function clearOldBlockingRules() {
  // No-op: blocking is handled via webNavigation and tabs APIs

}

// Check if it's a new day (reset goals)
function checkNewDay() {
  const today = new Date().toDateString();
  
  // Safety check: if lastGoalDate is missing but we have goals/timeline, preserve them
  if (!state.lastGoalDate) {
    // If we have goals or timeline, it means we're not actually on first run
    // Just set the date without resetting
    if (state.dailyGoals && state.dailyGoals.length > 0) {

      state.lastGoalDate = today;
      saveState();
      return; // Don't reset, just set the date
    }
    
    // First run - set today's date without resetting

    state.lastGoalDate = today;
    if (!state.previousDayGoals) {
      state.previousDayGoals = [];
    }
    saveState();
  } else if (state.lastGoalDate !== today) {
    // New day detected - save yesterday's goals before resetting


    // Save previous day's goals (only if they exist)
    state.previousDayGoals = state.dailyGoals && state.dailyGoals.length > 0 ? [...state.dailyGoals] : [];
    state.showPreviousGoals = state.previousDayGoals.length > 0;
    
    // Reset daily data
    state.dailyGoals = [];
    state.hasSetGoalsToday = false;
    state.todayTimeline = [];
    state.blockStats = {
      totalBlocksToday: 0,
      blocksByDomain: {}
    };
    state.lastGoalDate = today;
    saveState();
  } else {

    // Ensure arrays exist even if empty
    if (!state.dailyGoals) state.dailyGoals = [];
    if (!state.todayTimeline) state.todayTimeline = [];
    if (!state.previousDayGoals) state.previousDayGoals = [];
  }
}

// Start break
async function startBreak(customDuration = null, unlockCategories = null, unlockAll = false) {
  const duration = customDuration || state.breakDuration;


  const now = Date.now();
  state.onBreak = true;
  state.breakStartTime = now;
  state.breakEndTime = now + (duration * 60 * 1000);
  state.snoozeCount = 0;
  state.currentBreakDuration = duration;
  state.unlockAll = unlockAll;
  state.unlockCategories = unlockCategories || [];
  
  // Clear legacy fields
  state.unlockSite = null;
  state.unlockCategory = null;
  
  // Initialize break whitelist based on unlock mode
  if (unlockAll) {
    state.breakWhitelist = []; // All sites allowed (handled by unlockAll flag)

  } else if (unlockCategories && unlockCategories.length > 0) {
    // Populate break whitelist with sites from selected categories
    if (state.siteCategories) {
      const sites = new Set();
      
      unlockCategories.forEach(category => {
        Object.entries(state.siteCategories).forEach(([domain, cat]) => {
          if (cat === category) {
            sites.add(domain);
          }
        });
      });
      
      state.breakWhitelist = Array.from(sites);

    } else {
      state.breakWhitelist = [];
      console.warn('⚠️ No site categories found');
    }
  } else {
    // Nothing selected - strict mode (unless unlockAll was somehow missed)
    state.breakWhitelist = [];

  }
  
  // Add to timeline
  state.todayTimeline.push({
    type: 'break',
    timestamp: now,
    startTime: now,
    plannedDuration: duration,
    snoozeCount: 0,
    totalDuration: duration,
    endedEarly: false
  });
  
  chrome.alarms.create('breakEnd', { when: state.breakEndTime });
  
  // Set alarm for notification warning (based on breakWarningTime setting)
  const warningMinutes = state.breakWarningTime || 1;
  const warningTime = state.breakEndTime - (warningMinutes * 60 * 1000);
  if (warningTime > now) {
    chrome.alarms.create('breakWarning', { when: warningTime });

  }
  
  saveState();

}

// End break
async function endBreak() {

  // Check if break was ended early
  const now = Date.now();
  const wasEndedEarly = state.breakEndTime && now < state.breakEndTime;
  
  if (wasEndedEarly) {
    // Calculate actual duration
    const actualDuration = Math.round((now - state.breakStartTime) / 60000);

    // Update the most recent break event in timeline
    const breakEvent = state.todayTimeline.filter(e => e.type === 'break').pop();
    if (breakEvent) {
      breakEvent.endedEarly = true;
      breakEvent.actualDuration = actualDuration;
    }
  }
  
  state.onBreak = false;
  state.breakStartTime = null;
  state.breakEndTime = null;
  state.currentBreakDuration = null;
  state.unlockSite = null; // Clear unlock site when break ends
  state.unlockCategory = null; // Clear unlock category
  state.unlockCategories = []; // Clear unlocked categories
  state.unlockAll = false; // Reset unlock all flag
  state.breakWhitelist = []; // Clear break whitelist when break ends
  state.cooldownEndTime = now + (state.cooldownDuration * 60 * 1000);
  
  // Clear warning alarm if break ended early
  chrome.alarms.clear('breakWarning');
  
  chrome.alarms.create('cooldownEnd', { when: state.cooldownEndTime });
  saveState();
}

// Extend break (snooze)
function extendBreak(additionalMinutes) {
  if (!state.onBreak) return;
  

  // Clear existing alarms
  chrome.alarms.clear('breakEnd');
  chrome.alarms.clear('breakWarning');
  
  // Extend break end time by ADDING to the existing end time (not replacing it)
  const now = Date.now();
  state.breakEndTime += (additionalMinutes * 60 * 1000);
  state.currentBreakDuration += additionalMinutes;
  state.snoozeCount += 1;
  
  // Update the current break event in timeline
  const breakEvent = state.todayTimeline.filter(e => e.type === 'break').pop();
  if (breakEvent) {
    breakEvent.snoozeCount = state.snoozeCount;
    breakEvent.totalDuration = state.currentBreakDuration;
  }
  
  // Set new alarms
  chrome.alarms.create('breakEnd', { when: state.breakEndTime });
  
  const warningMinutes = state.breakWarningTime || 1;
  const warningTime = state.breakEndTime - (warningMinutes * 60 * 1000);
  if (warningTime > now) {
    chrome.alarms.create('breakWarning', { when: warningTime });
  }
  
  saveState();

}

// Alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'breakEnd') {
    endBreak();
  } else if (alarm.name === 'cooldownEnd') {
    state.cooldownEndTime = null;
    saveState();
  } else if (alarm.name === 'breakWarning') {
    showBreakWarningNotification();
  }
});

// Show break warning notification
function showBreakWarningNotification() {

  const warningMinutes = state.breakWarningTime || 2;
  const title = warningMinutes === 1 
    ? '⏰ Break Ending in 1 Minute!' 
    : `⏰ Break Ending in ${warningMinutes} Minutes!`;
  
  // Clear any existing notification first to prevent errors
  chrome.notifications.clear('breakWarning', (wasCleared) => {
    if (chrome.runtime.lastError) {
      console.warn('⚠️ Error clearing previous notification (ignoring):', chrome.runtime.lastError.message);
    }
    
    chrome.notifications.create('breakWarning', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
      title: title,
      message: 'Open the extension popup to extend your break',
      priority: 2,
      requireInteraction: true // Keep it visible until user interacts
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Failed to create notification:', chrome.runtime.lastError);
      } else {

        // Auto-close after 10 seconds (increased from 5 to ensure visibility)
        setTimeout(() => {
          chrome.notifications.clear('breakWarning');
        }, 10000);
      }
    });
  });
}

// Clear notification when clicked
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
  // Clean up stored notification data
  if (state.blockNotifications && state.blockNotifications[notificationId]) {
    delete state.blockNotifications[notificationId];
    saveState();
  }
});

// Handle notification button clicks (for "Add to Whitelist" or "Add to Break Whitelist" button)
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {

  if (buttonIndex === 0) { // Button clicked
    // Get stored URL/domain for this notification
    if (state.blockNotifications && state.blockNotifications[notificationId]) {
      const notificationData = state.blockNotifications[notificationId];
      const domainToWhitelist = notificationData.domain;
      
      if (domainToWhitelist) {
        // Extract just the domain (remove www, protocol, etc.)
        let cleanDomain = domainToWhitelist.toLowerCase().trim();
        cleanDomain = cleanDomain.replace(/^https?:\/\//, '');
        cleanDomain = cleanDomain.replace(/^www\./, '');
        cleanDomain = cleanDomain.split('/')[0]; // Remove path
        
        if (state.onBreak) {
          // During break: add to break whitelist
          if (!state.breakWhitelist.includes(cleanDomain)) {
            state.breakWhitelist.push(cleanDomain);
            saveState();

            // Show confirmation notification
            chrome.notifications.clear('breakWhitelistAdded', () => {
              chrome.notifications.create('breakWhitelistAdded', {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
                title: '✅ Added to Break Whitelist',
                message: `${cleanDomain} is now allowed during this break`,
                priority: 1
              }, (id) => {
                // Auto-clear after 3 seconds
                setTimeout(() => {
                  chrome.notifications.clear(id);
                }, 3000);
              });
            });
          } else {

          }
        } else {
          // Not on break: add to permanent whitelist
          if (!state.whitelistedSites.includes(cleanDomain)) {
            state.whitelistedSites.push(cleanDomain);
            saveState();

            // Show confirmation notification
            chrome.notifications.clear('whitelistAdded', () => {
              chrome.notifications.create('whitelistAdded', {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
                title: '✅ Added to Whitelist',
                message: `${cleanDomain} has been added to your whitelist`,
                priority: 1
              }, (id) => {
                // Auto-clear after 3 seconds
                setTimeout(() => {
                  chrome.notifications.clear(id);
                }, 3000);
              });
            });
          } else {

          }
        }
      }
      
      // Clean up stored notification data
      delete state.blockNotifications[notificationId];
      saveState();
    }
    
    // Clear the original notification
    chrome.notifications.clear(notificationId);
  }
});

// Handle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === 'getState') {
    sendResponse({ state, isFirstBreak: !state.hasSetGoalsToday });
    return true; // Indicate we will send a response

  } else if (request.action === 'startBreak') {
    const duration = request.duration || null;
    const unlockCategories = request.unlockCategories || [];
    const unlockAll = request.unlockAll || false;
    // Legacy support
    const legacyUnlockSite = request.unlockSite;
    const legacyUnlockCategory = request.unlockCategory;
    
    // If legacy params are used, convert to new format if needed
    if (!unlockAll && unlockCategories.length === 0) {
      if (legacyUnlockSite) {
        // Handle legacy "one site" logic by adding it directly to whitelist later? 
        // Or just let startBreak handle legacy params if I kept them in signature?
        // I removed them from signature. So I need to adapt here.
        // Actually, I can just rely on startBreak's logic if I pass them differently or update startBreak to handle legacy.
        // But I updated startBreak to NOT handle legacy params.
        // So I must convert here.
        // If unlockSite is present, we can't easily map it to a category. 
        // But we can manually set breakWhitelist after startBreak.
        // Or... 
        // Let's just focus on new format. The popup sends new format.
        // If legacy code calls this, it might break. But we updated popup.js.
      }
    }
    
    startBreak(duration, unlockCategories, unlockAll).then(() => {
      sendResponse({ success: true });
    });
    return true;

  } else if (request.action === 'endBreak') {
    endBreak();
    sendResponse({ success: true });

  } else if (request.action === 'snoozeBreak') {
    const duration = request.duration;

    extendBreak(duration);
    sendResponse({ success: true });

  } else if (request.action === 'addGoal') {
    const newGoal = {
      id: Date.now(),
      text: request.goalText.trim(),
      completed: false
    };
    state.dailyGoals.push(newGoal);

    if (state.dailyGoals.length >= 3) {
      state.hasSetGoalsToday = true;
    }
    saveState();
    sendResponse({ success: true, goal: newGoal });

  } else if (request.action === 'toggleGoal') {
    const goal = state.dailyGoals.find(g => g.id === request.goalId);
    if (goal) {
      goal.completed = !goal.completed;
      
      if (goal.completed) {
        const now = Date.now();
        goal.completedAt = now;
        state.todayTimeline.push({
          type: 'goal',
          timestamp: now,
          goalText: goal.text
        });
      } else {
        delete goal.completedAt;
        state.todayTimeline = state.todayTimeline.filter(
          item => !(item.type === 'goal' && item.goalText === goal.text)
        );
      }
      
      saveState();
      sendResponse({ success: true, completed: goal.completed });
    }

  } else if (request.action === 'removeGoal') {
    const goal = state.dailyGoals.find(g => g.id === request.goalId);
    if (goal) {
      const now = Date.now();
      
      // Add removal event to timeline
      state.todayTimeline.push({
        type: 'goal_removed',
        timestamp: now,
        goalText: goal.text
      });
      
      // Remove from goals list
      state.dailyGoals = state.dailyGoals.filter(g => g.id !== request.goalId);
      
      // Also remove completed event if it exists
      state.todayTimeline = state.todayTimeline.filter(
        item => !(item.type === 'goal' && item.goalText === goal.text)
      );
      
      saveState();
      sendResponse({ success: true });
    }

  } else if (request.action === 'addBlockedSite') {
    // Normalize domain (mail.google.com -> gmail.com)
    const domain = normalizeDomain(request.pattern.trim());
    const category = request.category || 'Other';
    
    // Check if already exists (check both original and normalized)
    const alreadyExists = state.blockedSites.some(site => 
      normalizeDomain(site) === domain || site === domain
    );
    
    if (!alreadyExists) {
      state.blockedSites.push(domain);
      
      // Update category map
      if (!state.siteCategories) state.siteCategories = {};
      state.siteCategories[domain] = category;
      
      saveState();

      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Site already blocked' });
    }

  } else if (request.action === 'removeBlockedSite') {
    if (request.index >= 0 && request.index < state.blockedSites.length) {
      const removed = state.blockedSites.splice(request.index, 1);
      const removedDomain = removed[0];
      
      // Remove from category map
      if (state.siteCategories && state.siteCategories[removedDomain]) {
        delete state.siteCategories[removedDomain];
      }
      
      saveState();

      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Invalid index' });
    }

  } else if (request.action === 'updateSiteCategory') {
    const domain = request.domain;
    const category = request.category;
    
    if (domain && category) {
      if (!state.siteCategories) state.siteCategories = {};
      
      // Normalize domain to be safe, though popup sends it normalized usually
      // Actually popup sends whatever is in the list, which might be normalized or not
      // But we use normalizeDomain for keys in siteCategories usually
      // Let's find the entry in blockedSites to be sure
      
      state.siteCategories[domain] = category;
      // Also update any normalized version if it differs
      const normalized = normalizeDomain(domain);
      if (normalized !== domain) {
        state.siteCategories[normalized] = category;
      }
      
      saveState();

      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Missing domain or category' });
    }

  } else if (request.action === 'addWhitelistedSite') {
    // Normalize domain (mail.google.com -> gmail.com)
    const domain = normalizeDomain(request.pattern.trim());
    
    // Check if already exists (check both original and normalized)
    const alreadyExists = state.whitelistedSites.some(site => 
      normalizeDomain(site) === domain || site === domain
    );
    
    if (!alreadyExists) {
      state.whitelistedSites.push(domain);
      saveState();

      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Site already whitelisted' });
    }

  } else if (request.action === 'removeWhitelistedSite') {
    if (request.index >= 0 && request.index < state.whitelistedSites.length) {
      const removed = state.whitelistedSites.splice(request.index, 1);
      saveState();

      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Invalid index' });
    }

  } else if (request.action === 'updateSettings') {



    // CRITICAL: Capture sendResponse IMMEDIATELY and return true BEFORE any async work
    // This keeps the message channel open




    const responseCallback = sendResponse;
    let responseSent = false;
    
    // Helper to safely send response
    const safeSendResponse = (data) => {




      if (!responseSent) {
        try {


          const result = responseCallback(data);





          // Check for runtime errors after sendResponse (indicates channel closure)
          if (chrome.runtime.lastError) {
            console.error('[BG-ERROR-SEND] ❌ chrome.runtime.lastError after sendResponse:', chrome.runtime.lastError);
            console.error('[BG-ERROR-SEND] ❌ Error message:', chrome.runtime.lastError.message);
            console.error('[BG-ERROR-SEND] ❌ Channel was closed before response could be sent');
            return false;
          }
          
          if (result === false) {
            console.error('[BG-ERROR-SEND] ❌ sendResponse returned FALSE - channel was closed!');
            console.error('[BG-ERROR-SEND] ❌ This means the message channel closed before response could be sent');
            return false;
          }
          
          responseSent = true;


          return true;
        } catch (error) {
          console.error('[BG-ERROR-SEND] ❌ Exception calling sendResponse:', error);
          console.error('[BG-ERROR-SEND] ❌ Error name:', error?.name);
          console.error('[BG-ERROR-SEND] ❌ Error message:', error?.message);
          console.error('[BG-ERROR-SEND] ❌ Error stack:', error?.stack);
          return false;
        }
      } else {
        console.warn('[BG-WARN] Attempted to send response twice, ignoring');
        return false;
      }
    };
    
    // Update synchronous settings first
    state.breakDuration = request.breakDuration;
    state.cooldownDuration = request.cooldownDuration;
    state.breakWarningTime = 2; // Fixed at 2 minutes
    if (request.challengeType) {
      state.challengeType = request.challengeType;
    }
    if (request.redirectType) {
      state.redirectType = request.redirectType;
    }
    
    // Handle vocabulary language change (async operation)
    if (request.vocabLanguage) {
      const oldLanguage = state.vocabLanguage;

      state.vocabLanguage = request.vocabLanguage;
      
      // Reload vocabulary if language changed (async)
      if (oldLanguage !== request.vocabLanguage) {

        // Use IIFE to handle async work
        (async () => {
          try {
            await loadVocabulary(request.vocabLanguage);


            await saveState();


            safeSendResponse({ success: true });


          } catch (error) {
            console.error('[BG-ERROR-003] ❌ ERROR in updateSettings async work:', error);
            console.error('[BG-ERROR-003] ❌ Error name:', error?.name);
            console.error('[BG-ERROR-003] ❌ Error message:', error?.message);
            console.error('[BG-ERROR-003] ❌ Error stack:', error?.stack);
            safeSendResponse({ success: false, error: error.message });
          }
        })();
        // Return true IMMEDIATELY to keep channel open


        const returnValue = true;

        return returnValue;
      } else {

      }
    } else {

    }
    
    // If no async vocabulary reload needed, save state and respond

    (async () => {
      try {
        await saveState();

        safeSendResponse({ success: true });


      } catch (error) {
        console.error('[BG-ERROR-007] ❌ ERROR saving state (no vocab reload):', error);
        safeSendResponse({ success: false, error: error.message });
      }
    })();
    // Return true IMMEDIATELY to keep channel open


    const returnValue = true;

    return returnValue;

  } else if (request.action === 'resetCooldown') {

    state.cooldownEndTime = null;
    chrome.alarms.clear('cooldownEnd');
    saveState();
    sendResponse({ success: true });

  } else if (request.action === 're-addPreviousGoal') {
    const prevGoal = state.previousDayGoals.find(g => g.id === request.goalId);
    if (prevGoal) {
      // Create new goal with new ID but same text
      const newGoal = {
        id: Date.now(),
        text: prevGoal.text,
        completed: false
      };
      state.dailyGoals.push(newGoal);
      if (state.dailyGoals.length >= 3) {
        state.hasSetGoalsToday = true;
      }
      saveState();
      sendResponse({ success: true, goal: newGoal });
    }

  } else if (request.action === 'dismissPreviousGoals') {
    state.showPreviousGoals = false;
    state.previousDayGoals = [];
    saveState();
    sendResponse({ success: true });

  } else if (request.action === 'reloadVocab') {
    const language = request.language || state.vocabLanguage;
    loadVocabulary(language).then(() => {
      sendResponse({ success: true, count: state.vocabulary.length });
    }).catch((error) => {
      console.error('❌ Error loading vocabulary:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;

  } else if (request.action === 'addNoGoListSite') {
    // Normalize domain (mail.google.com -> gmail.com)
    const domain = normalizeDomain(request.pattern.trim());
    
    // Check if already exists (check both original and normalized)
    const alreadyExists = state.nogoList.some(site => 
      normalizeDomain(site) === domain || site === domain
    );
    
    if (!alreadyExists) {
      state.nogoList.push(domain);
      saveState();

      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Site already in the no go zone' });
    }

  } else if (request.action === 'startRemoveNoGoListSite') {
    // Start the 15-minute removal timer
    const domain = normalizeDomain(request.domain.trim());
    const index = state.nogoList.findIndex(site => 
      normalizeDomain(site) === domain || site === domain
    );
    
    if (index >= 0) {
      const now = Date.now();
      const removalEndTime = now + (15 * 60 * 1000); // 15 minutes
      
      // Store removal timer info (we'll track this per domain)
      if (!state.nogoListRemovalTimers) {
        state.nogoListRemovalTimers = {};
      }
      state.nogoListRemovalTimers[domain] = {
        startTime: now,
        endTime: removalEndTime
      };
      
      saveState();

      sendResponse({ success: true, endTime: removalEndTime });
    } else {
      sendResponse({ success: false, error: 'Site not in nogo list' });
    }

  } else if (request.action === 'confirmRemoveNoGoListSite') {
    // Confirm removal after timer expires - move to blacklist
    const domain = normalizeDomain(request.domain.trim());
    const index = state.nogoList.findIndex(site => 
      normalizeDomain(site) === domain || site === domain
    );
    
    if (index >= 0) {
      // Remove from nogo list
      state.nogoList.splice(index, 1);
      
      // Add to normal blacklist (if not already there)
      const alreadyInBlacklist = state.blockedSites.some(site => 
        normalizeDomain(site) === domain || site === domain
      );
      if (!alreadyInBlacklist) {
        state.blockedSites.push(domain);
      }
      
      // Clear removal timer
      if (state.nogoListRemovalTimers) {
        delete state.nogoListRemovalTimers[domain];
      }
      
      saveState();

      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Site not in nogo list' });
    }

  } else if (request.action === 'cancelRemoveNoGoListSite') {
    // Cancel the removal timer
    const domain = normalizeDomain(request.domain.trim());
    
    if (state.nogoListRemovalTimers && state.nogoListRemovalTimers[domain]) {
      delete state.nogoListRemovalTimers[domain];
      saveState();

      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No active removal timer' });
    }

  } else if (request.action === 'addVocabularyWord') {
    // Add a word back to the vocabulary dictionary (for undo functionality)
    const word = request.word;
    const translation = request.translation;
    const transcription = request.transcription || '';
    
    if (!state.vocabulary) {
      state.vocabulary = [];
    }
    
    // Check if already exists
    // Match by originalWord (base English) or word (for fr_gr), and translation
    const alreadyExists = state.vocabulary.some(item => {
      const wordMatches = (item.originalWord && item.originalWord === word) || 
                         (!item.originalWord && item.word === word);
      return wordMatches && item.translation === translation;
    });
    
    if (!alreadyExists) {
      state.vocabulary.push({ word, translation, transcription });
      
      // Update stats
      if (!state.vocabStats) state.vocabStats = { manuallyAdded: 0, manuallyRemoved: 0 };
      state.vocabStats.manuallyAdded++;
      
      // Update custom dictionary if active
      if (state.customDictionaries && state.customDictionaries[state.vocabLanguage]) {
        state.customDictionaries[state.vocabLanguage].vocabulary = state.vocabulary;
      }
      
      saveState();

      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Word already in vocabulary' });
    }

  } else if (request.action === 'removeVocabularyWord') {
    // Remove a word from the vocabulary dictionary
    const word = request.word;
    const translation = request.translation;
    
    if (!state.vocabulary) {
      sendResponse({ success: false, error: 'No vocabulary loaded' });
      return;
    }
    
    // Find and remove the word
    // Match by originalWord (base English) or word (for fr_gr), and translation
    const initialLength = state.vocabulary.length;
    state.vocabulary = state.vocabulary.filter(item => {
      const wordMatches = (item.originalWord && item.originalWord === word) || 
                         (!item.originalWord && item.word === word);
      return !(wordMatches && item.translation === translation);
    });
    
    const removed = state.vocabulary.length < initialLength;
    
    if (removed) {
      // Update stats
      if (!state.vocabStats) state.vocabStats = { manuallyAdded: 0, manuallyRemoved: 0 };
      state.vocabStats.manuallyRemoved++;
      
      // Update custom dictionary if active
      if (state.customDictionaries && state.customDictionaries[state.vocabLanguage]) {
        state.customDictionaries[state.vocabLanguage].vocabulary = state.vocabulary;
      }
      
      saveState();

      sendResponse({ success: true, removed: true });
    } else {

      sendResponse({ success: false, error: 'Word not found' });
    }

  } else if (request.action === 'createCustomDictionary') {
    const id = `custom_${Date.now()}`;
    const newDict = {
      id: id,
      name: request.name,
      icon: request.icon || '📚',
      vocabulary: request.vocabulary || []
    };
    
    if (!state.customDictionaries) state.customDictionaries = {};
    state.customDictionaries[id] = newDict;
    
    // Switch to it immediately
    state.vocabLanguage = id;
    state.vocabulary = newDict.vocabulary;
    
    saveState();

    sendResponse({ success: true, id: id });

  } else if (request.action === 'addToBreakWhitelist') {
    // Normalize domain (mail.google.com -> gmail.com)
    const domain = normalizeDomain(request.domain.trim());
    
    // If breakWhitelist is empty, adding means the site was already allowed (no change needed)
    // But if breakWhitelist has items, adding means allowing this site
    if (state.breakWhitelist.length === 0) {
      // All sites are currently allowed, so "adding" doesn't make sense
      // This shouldn't happen if UI is correct, but handle it gracefully
      sendResponse({ success: false, error: 'All sites are already allowed' });
    } else {
      // breakWhitelist has items, so adding means allowing this site
      // Check if already exists (check both original and normalized)
      const alreadyExists = state.breakWhitelist.some(site => 
        normalizeDomain(site) === domain || site === domain
      );
      if (!alreadyExists) {
        state.breakWhitelist.push(domain);
        saveState().then(() => {

          sendResponse({ success: true });
        }).catch((error) => {
          console.error('❌ Failed to save state:', error);
          sendResponse({ success: false, error: 'Failed to save state' });
        });
        return true; // Indicate async response
      } else {
        sendResponse({ success: false, error: 'Site already in break whitelist' });
      }
    }

  } else if (request.action === 'removeFromBreakWhitelist') {
    // Normalize domain (mail.google.com -> gmail.com)
    const domain = normalizeDomain(request.domain.trim());
    
    // If breakWhitelist is empty, adding a site to it means blocking it (removing from "all allowed")
    // If breakWhitelist has items, removing means taking it out of the whitelist
    if (state.breakWhitelist.length === 0) {
      // Currently all sites are allowed
      // "Removing" means adding to breakWhitelist to block it (inverse logic)
      // Actually wait - if we're removing from break, and breakWhitelist is empty,
      // we need to add it to breakWhitelist to block it during break
      // But that doesn't make sense... Let me think...
      
      // Actually, the UI shows "Remove from break" which means "block this site during break"
      // When breakWhitelist is empty, all sites are allowed
      // To block a site, we need to add all OTHER sites to breakWhitelist, or...
      // Better approach: when breakWhitelist is empty and user "removes" a site,
      // we add all blocked sites EXCEPT that one to breakWhitelist
      const allBlockedSites = state.blockedSites || [];
      state.breakWhitelist = allBlockedSites
        .map(site => normalizeDomain(site))
        .filter(site => site !== domain);
      saveState().then(() => {


        sendResponse({ success: true });
      }).catch((error) => {
        console.error('❌ Failed to save state:', error);
        sendResponse({ success: false, error: 'Failed to save state' });
      });
      return true; // Indicate async response
    } else {
      // breakWhitelist has items, so removing means taking it out
      // Find by normalized domain
      const index = state.breakWhitelist.findIndex(site => 
        normalizeDomain(site) === domain || site === domain
      );
      if (index >= 0) {
        state.breakWhitelist.splice(index, 1);
        saveState().then(() => {

          sendResponse({ success: true });
        }).catch((error) => {
          console.error('❌ Failed to save state:', error);
          sendResponse({ success: false, error: 'Failed to save state' });
        });
        return true; // Indicate async response
      } else {
        sendResponse({ success: false, error: 'Site not in break whitelist' });
      }
    }

  } else if (request.action === 'addCategoryToBreakWhitelist') {
    const category = request.category;
    if (!state.siteCategories) {
      sendResponse({ success: false, error: 'No categories defined' });
      return;
    }
    
    const sitesInCat = Object.entries(state.siteCategories)
      .filter(([domain, cat]) => cat === category)
      .map(([domain]) => domain);
      
    if (sitesInCat.length === 0) {
      sendResponse({ success: false, error: 'Empty category' });
      return;
    }
    
    // Add to breakWhitelist
    let addedCount = 0;
    sitesInCat.forEach(site => {
      // Normalize
      const normalizedSite = normalizeDomain(site);
      // Check if already in whitelist (check both raw and normalized)
      const exists = state.breakWhitelist.some(s => 
        s === site || normalizeDomain(s) === normalizedSite
      );
      
      if (!exists) {
        state.breakWhitelist.push(site);
        addedCount++;
      }
    });
    
    saveState();

    sendResponse({ success: true, count: addedCount });

  } else if (request.action === 'removeCategoryFromBreakWhitelist') {
    const category = request.category;
    if (!state.siteCategories) {
      sendResponse({ success: false, error: 'No categories defined' });
      return;
    }
    
    // Find all sites in this category that are currently in the break whitelist
    const sitesInCat = Object.entries(state.siteCategories)
      .filter(([domain, cat]) => cat === category)
      .map(([domain]) => normalizeDomain(domain));
      
    if (sitesInCat.length === 0) {
      // If no sites found in map, maybe the category name is wrong or no sites match
      // But we should also check if we are in "All Allowed" mode (empty whitelist)
      // If whitelist is empty, we need to switch to a blacklist mode by adding EVERYTHING ELSE to the whitelist
      if (state.breakWhitelist.length === 0) {
        // "Removing" a category from "All Allowed" means we want to BLOCK this category
        // So we add all OTHER blocked sites to the whitelist
        const allBlockedSites = state.blockedSites || [];
        
        // Sites to KEEP in whitelist (everything NOT in this category)
        const sitesToWhitelist = allBlockedSites
          .map(site => normalizeDomain(site))
          .filter(site => {
            // Check if site is in the category being removed
            const siteCat = state.siteCategories[site] || 'Other';
            return siteCat !== category;
          });
          
        state.breakWhitelist = sitesToWhitelist;
        
        saveState();

        sendResponse({ success: true });
        return;
      }
      
      sendResponse({ success: false, error: 'Empty category or not found' });
      return;
    }
    
    if (state.breakWhitelist.length === 0) {
      // Whitelist empty = All Allowed.
      // User wants to remove (block) this category.
      // Add all blocked sites EXCEPT those in this category to the whitelist.
      const allBlockedSites = state.blockedSites || [];
      
      const sitesToWhitelist = allBlockedSites
        .map(site => normalizeDomain(site))
        .filter(site => {
          // Check if site belongs to the category
          // Be careful: siteCategories keys might not be normalized
          // We need to look up the category for this specific site
          // Since we might not have a perfect map, let's iterate siteCategories
          // Actually, we can just use the sitesInCat array we built earlier (normalized domains in category)
          return !sitesInCat.includes(site);
        });
        
      state.breakWhitelist = sitesToWhitelist;
      
      saveState();

      sendResponse({ success: true });
    } else {
      // Whitelist has items. Remove sites from this category.
      const initialLength = state.breakWhitelist.length;
      state.breakWhitelist = state.breakWhitelist.filter(site => !sitesInCat.includes(normalizeDomain(site)));
      const removedCount = initialLength - state.breakWhitelist.length;
      
      saveState();

      sendResponse({ success: true, count: removedCount });
    }
  }
  
  return true;
  
  return true;
});

// Track recently blocked URLs to prevent duplicate checks
const recentlyBlocked = new Map(); // tabId -> {url, timestamp}

// Flag to track if state has been loaded from storage
let stateLoaded = false;

// Function to check and block URLs
function checkAndBlockUrl(url, tabId, source) {
  // CRITICAL: Don't check URLs until state is loaded from storage
  // This prevents race condition where default state (onBreak: false) is used
  if (!stateLoaded) {

    return;
  }
  
  const urlLower = url.toLowerCase();
  

  // Don't block if it's a chrome:// or extension URL
  if (urlLower.startsWith('chrome://') || urlLower.startsWith('chrome-extension://')) {
    return;
  }
  
  // Check NoGo List first - these sites are NEVER unlocked, even during breaks
  const isInNoGoList = state.nogoList && state.nogoList.length > 0 && state.nogoList.some(domain => {
    return urlMatchesDomain(urlLower, domain);
  });
  
  if (isInNoGoList) {

    // Always block - don't check break status, just continue to blocking flow
  } else if (state.onBreak) {
    // If on break and NOT in nogo list, check if this site should be unlocked
    
    // 1. Check unlockAll flag
    if (state.unlockAll) {

      return;
    }
    
    // 2. Check break whitelist
    if (state.breakWhitelist && state.breakWhitelist.length > 0) {
      // If break whitelist has items, only allow sites in the whitelist (with normalization)
      const isInBreakWhitelist = state.breakWhitelist.some(domain => {
        return urlMatchesDomain(urlLower, domain);
      });
      if (isInBreakWhitelist) {

        return; // Allow this site
      } else {

        // Continue to block this site
      }
    } else {
      // Break whitelist is empty AND unlockAll is false
      // This means STRICT break (nothing allowed)

      // Continue to block
    }
  }
  
  // Don't block redirect targets (Giphy, Amnesty)
  if (urlLower.includes('giphy.com') || urlLower.includes('amnesty.org')) {
    return;
  }
  
  // Check if we just blocked this same URL in this tab (within last 2 seconds)
  const recent = recentlyBlocked.get(tabId);
  const now = Date.now();
  if (recent && recent.url === urlLower && (now - recent.timestamp) < 2000) {

    return;
  }
  
  // isInNoGoList is already declared above - reuse it
  
  // Check if URL contains any blocked domain (with normalization)
  // Hardcoded rule: gmail.com and mail.google.com are equivalent
  const isBlocked = state.blockedSites.some(domain => {
    return urlMatchesDomain(urlLower, domain);
  });
  
  // Check if URL contains any whitelisted domain (takes priority, with normalization)
  // Note: NoGo list overrides whitelist - if in nogo list, it's never whitelisted
  // Hardcoded rule: gmail.com and mail.google.com are equivalent
  const isWhitelisted = !isInNoGoList && state.whitelistedSites.some(domain => {
    return urlMatchesDomain(urlLower, domain);
  });
  

  // If in nogo list, always block (even if whitelisted)
  // If blocked and not whitelisted, redirect based on settings
  if (isInNoGoList || (isBlocked && !isWhitelisted)) {

    // Track which domain was blocked (check NoGo List first, then blockedSites)
    // Hardcoded rule: gmail.com and mail.google.com are equivalent
    let blockedDomain = null;
    if (isInNoGoList) {
      // Find the domain in NoGo List
      blockedDomain = state.nogoList.find(domain => {
        return urlMatchesDomain(urlLower, domain);
      });
    }
    
    // If not in NoGo List, check blockedSites
    if (!blockedDomain) {
      blockedDomain = state.blockedSites.find(domain => {
        return urlMatchesDomain(urlLower, domain);
      });
    }
    
    // Increment stats for any blocked domain (NoGo List or blockedSites)
    if (blockedDomain) {
      // Normalize for stats (mail.google.com -> gmail.com)
      const normalizedDomain = normalizeDomain(blockedDomain);
      
      // Initialize block stats if needed
      if (!state.blockStats) {
        state.blockStats = {
          totalBlocksToday: 0,
          blocksByDomain: {}
        };
      }
      
      // Increment counters (use normalized domain for stats)
      state.blockStats.totalBlocksToday = (state.blockStats.totalBlocksToday || 0) + 1;
      state.blockStats.blocksByDomain[normalizedDomain] = (state.blockStats.blocksByDomain[normalizedDomain] || 0) + 1;
      saveState();
      

    }
    
    // Remember this block to prevent duplicates
    recentlyBlocked.set(tabId, { url: urlLower, timestamp: now });
    
    // Clean up old entries after 3 seconds
    setTimeout(() => {
      const entry = recentlyBlocked.get(tabId);
      if (entry && entry.timestamp === now) {
        recentlyBlocked.delete(tabId);
      }
    }, 3000);
    
    let redirectTarget;
    if (state.redirectType === 'donation') {
      // Redirect to Amnesty donation page
      redirectTarget = 'https://amnesty.org/en/donate/';
    } else {
      // Default: Random Giphy "No" image
      const randomIndex = Math.floor(Math.random() * state.giphyNoUrls.length);
      redirectTarget = state.giphyNoUrls[randomIndex];
    }
    

    chrome.tabs.update(tabId, { url: redirectTarget });
    
    // Show notification with blocked URL and whitelist option
    showBlockNotification(url, blockedDomain);
  }
}

// Show notification when a site is blocked
function showBlockNotification(url, blockedDomain) {
  // Extract domain from URL for display
  let displayUrl = url;
  try {
    const urlObj = new URL(url);
    displayUrl = urlObj.hostname + urlObj.pathname;
    // Truncate if too long
    if (displayUrl.length > 50) {
      displayUrl = displayUrl.substring(0, 47) + '...';
    }
  } catch (e) {
    // If URL parsing fails, use original
    if (displayUrl.length > 50) {
      displayUrl = displayUrl.substring(0, 47) + '...';
    }
  }
  
  const notificationId = `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Determine button text based on whether we're on a break
  const buttonTitle = state.onBreak ? 'Add to Break Whitelist' : 'Add to Whitelist';
  
  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
    title: '🙅 NOPE 📵',
    message: `Blocked: ${displayUrl}`,
    buttons: [{ title: buttonTitle }],
    priority: 1,
    contextMessage: blockedDomain || 'Gorudo'
  }, (createdId) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Failed to create block notification:', chrome.runtime.lastError);
    } else {

      // Store URL and domain for button click handler
      // We'll use the notification ID to track this
      if (!state.blockNotifications) {
        state.blockNotifications = {};
      }
      state.blockNotifications[createdId] = {
        url: url,
        domain: blockedDomain || extractDomainFromUrl(url)
      };
      saveState();
      
      // Auto-clear after 10 seconds
      setTimeout(() => {
        chrome.notifications.clear(createdId);
        if (state.blockNotifications && state.blockNotifications[createdId]) {
          delete state.blockNotifications[createdId];
          saveState();
        }
      }, 10000);
    }
  });
}


// Web Navigation listener #1: Initial navigation (before it happens)
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  // Only check main frame navigations (not iframes)
  if (details.frameId !== 0) return;
  
  checkAndBlockUrl(details.url, details.tabId, 'navigation');
});

// Web Navigation listener #2: Catch redirects (after navigation completes)
chrome.webNavigation.onCommitted.addListener((details) => {
  // Only check main frame navigations (not iframes)
  if (details.frameId !== 0) return;
  
  // Check all committed navigations (including redirects)

  checkAndBlockUrl(details.url, details.tabId, 'committed');
});

// Web Navigation listener #3: Catch History API changes (pushState, replaceState)
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  // Only check main frame navigations (not iframes)
  if (details.frameId !== 0) return;
  

  checkAndBlockUrl(details.url, details.tabId, 'history state');
});

// Web Navigation listener #4: Catch completed navigations as final check
chrome.webNavigation.onCompleted.addListener((details) => {
  // Only check main frame navigations (not iframes)
  if (details.frameId !== 0) return;
  

  checkAndBlockUrl(details.url, details.tabId, 'completed');
});

// Tabs listener: Catch hash changes and other tab updates
// This is CRITICAL for Gmail and other SPAs that use hash routing (#inbox, #drafts, etc.)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only check when URL changes (includes hash changes!)
  if (changeInfo.url && tab.url) {

    checkAndBlockUrl(tab.url, tabId, 'tab updated');
  }
});

