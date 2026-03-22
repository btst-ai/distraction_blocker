// FULL-FEATURED POPUP
let currentState = null;
let currentVocabWords = [];
let revealedCount = 0;
let challengeType = null; // 'normal', 'special', or 'reset'
let specialBreakDuration = null;
let requiredWordCount = 10;
let isStartingBreak = false; // Track if we're in the process of starting a break (showing challenge)

// Snooze challenge state
let snoozeChallengeWords = [];
let snoozeVocabRevealedCount = 0;
let snoozeMathsAnswer = 0;
let snoozeRickrollTimer = null;
let isInSnoozeChallenge = false;
let lastCompletedSnoozeCount = -1; // Track which snooze count we've completed the challenge for

// Track removed vocab words for undo functionality
let removedVocabWords = new Map(); // index -> {word, translation, originalWord, originalTranslation}

// Load and display state
async function loadState() {
  try {
    console.log('[LANG-DEBUG] Step 6: loadState() called');
    // Check for runtime errors first
    if (chrome.runtime.lastError) {
      console.error('[LANG-DEBUG] ❌ Chrome runtime error before getState:', chrome.runtime.lastError);
      console.error('❌ Chrome runtime error:', chrome.runtime.lastError);
      const statusDiv = document.getElementById('status');
      if (statusDiv) {
        statusDiv.textContent = '❌ Extension error: ' + chrome.runtime.lastError.message;
      }
      return;
    }
    
    console.log('[LANG-DEBUG] Step 6.1: Sending getState message...');
    const response = await chrome.runtime.sendMessage({ action: 'getState' });
    console.log('[LANG-DEBUG] Step 6.2: Received getState response');
    
    // Check for runtime errors after message
    if (chrome.runtime.lastError) {
      console.error('[LANG-DEBUG] ❌ Chrome runtime error after getState:', chrome.runtime.lastError);
      console.error('❌ Chrome runtime error after message:', chrome.runtime.lastError);
      const statusDiv = document.getElementById('status');
      if (statusDiv) {
        statusDiv.textContent = '❌ Extension error: ' + chrome.runtime.lastError.message;
      }
      return;
    }
    
    if (!response) {
      console.error('[LANG-DEBUG] ❌ No response from background script');
      console.error('❌ No response from background script');
      const statusDiv = document.getElementById('status');
      if (statusDiv) {
        statusDiv.textContent = '❌ Error: No response from extension';
      }
      return;
    }
    if (!response.state) {
      console.error('[LANG-DEBUG] ❌ No state in response:', response);
      console.error('❌ No state in response:', response);
      const statusDiv = document.getElementById('status');
      if (statusDiv) {
        statusDiv.textContent = '❌ Error: Invalid state';
      }
      return;
    }
    console.log('[LANG-DEBUG] Step 6.3: State received. vocabLanguage:', response.state.vocabLanguage);
    console.log('[LANG-DEBUG] Step 6.4: Vocabulary count in state:', response.state.vocabulary?.length || 0);
    currentState = response.state;
    console.log('[LANG-DEBUG] Step 6.5: State assigned to currentState');
    console.log('✅ State loaded successfully');
    console.log('[LANG-DEBUG] Step 6.6: Calling updateUI()...');
    updateUI();
    console.log('[LANG-DEBUG] Step 6.7: updateUI() completed');
    // Site selector will be updated by updateUI -> updateBreakSiteSelector
  } catch (err) {
    console.error('[LANG-DEBUG] ❌ ERROR in loadState:', err);
    console.error('❌ Error loading state:', err);
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
      statusDiv.textContent = '❌ Error: ' + err.message;
    }
  }
}

// Update all UI elements
function updateUI() {
  if (!currentState) {
    console.log('⚠️ updateUI called but currentState is null');
    return;
  }
  
  console.log('🔄 Updating UI with state:', currentState);
  
  try {
    updateStatus();
    updateBreakButton();
    updateBreakWhitelistControls();
    updatePreviousGoals();
    updateGoalsList();
    updateTimeline();
    updateBlockStats();
    updateSitesList();
    updateWhitelistList();
    updateNoGoList();
    updateSettings();
  } catch (err) {
    console.error('❌ Error in updateUI:', err);
  }
}

// Update status display
function updateStatus() {
  const statusDiv = document.getElementById('status');
  const cooldownInfo = document.getElementById('cooldownInfo');
  
  // Safety check
  if (!statusDiv || !cooldownInfo) {
    console.error('❌ Missing status elements');
    return;
  }
  
  if (currentState.onBreak) {
    const totalDuration = currentState.currentBreakDuration || currentState.breakDuration;
    const startTime = currentState.breakStartTime || Date.now();
    const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
    // Ensure we don't show more than total (e.g. if slightly over time)
    const displayedElapsed = Math.min(elapsedMinutes, totalDuration);
    
    statusDiv.textContent = `🍜 Enjoying a break 🍣 (${displayedElapsed} / ${totalDuration} min)`;
    statusDiv.className = 'status on-break';
    cooldownInfo.textContent = '';
  } else if (currentState.cooldownEndTime && Date.now() < currentState.cooldownEndTime) {
    const cooldown = Math.ceil((currentState.cooldownEndTime - Date.now()) / 60000);
    statusDiv.textContent = '🥋 Focus first, distractions later 🥋';
    statusDiv.className = 'status blocked';
    cooldownInfo.textContent = `🍅 Cooldown: ${cooldown} minutes until next break ⏳`;
  } else {
    statusDiv.textContent = '🥋 Focus first, distractions later 🥋';
    statusDiv.className = 'status blocked';
    cooldownInfo.textContent = '';
  }
}

// Get judgmental emoji based on friction count (even-numbered extensions)
// Emoji progresses only at friction steps (2nd, 4th, 6th extensions)
function getJudgmentalEmoji(snoozeCount) {
  const emojis = ['🙊', '🙈', '🤨', '😧', '🙄', '😩', '😤', '😱', '😭', '🤬', '💔', '🤢', '🤮', '💩', '💀'];
  // Count how many friction steps have occurred (even-numbered extensions)
  // snoozeCount 0: 0 friction steps -> emoji 0
  // snoozeCount 1: 0 friction steps -> emoji 0
  // snoozeCount 2: 1 friction step -> emoji 1
  // snoozeCount 3: 1 friction step -> emoji 1
  // snoozeCount 4: 2 friction steps -> emoji 2
  // snoozeCount 5: 2 friction steps -> emoji 2
  const frictionCount = Math.floor(snoozeCount / 2);
  const index = Math.min(frictionCount, emojis.length - 1);
  return emojis[index];
}

// Get celebration emoji based on goal completion count (progressively more celebratory)
function getCelebrationEmoji(completionIndex) {
  const emojis = ['🥉', '🥈', '🥇', '🏆', '🎖️', '👑', '🚀', '♾️'];
  const index = Math.min(completionIndex, emojis.length - 1);
  return emojis[index];
}

// Format elapsed time (only hours and minutes, no seconds)
function formatElapsedTime(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  } else {
    return `${minutes}min`;
  }
}

// Update snooze buttons with judgmental emoji for hover effect
function updateSnoozeTitle() {
  if (currentState.onBreak) {
    const snoozeCount = currentState.snoozeCount || 0;
    const emoji = getJudgmentalEmoji(snoozeCount);
    
    // Calculate elapsed time
    const breakStartTime = currentState.breakStartTime || Date.now();
    const elapsed = Date.now() - breakStartTime;
    const elapsedText = formatElapsedTime(elapsed);
    
    // Update data-emoji attribute on all snooze buttons
    const snoozeButtons = document.querySelectorAll('.btn-snooze-header');
    snoozeButtons.forEach(button => {
      if (button) {
      button.setAttribute('data-emoji', emoji);
      }
    });
    
    // Show challenge bar when the NEXT extension will be even-numbered (2nd, 4th, 6th, etc.)
    // This means: show when snoozeCount is odd (1, 3, 5...) because next will be even (2nd, 4th, 6th...)
    // But only if we haven't already completed the challenge for this snooze count
    const nextExtensionWillBeEven = snoozeCount % 2 === 1; // Current count is odd, so next will be even
    const shouldShowChallengeBar = nextExtensionWillBeEven && lastCompletedSnoozeCount !== snoozeCount;
    const challengeBar = document.getElementById('snoozeChallengeBar');
    const challengeContainer = document.getElementById('snoozeChallengeContainer');
    const buttonsContainer = document.getElementById('snoozeButtonsContainer');
    
    // Don't update if we're currently in a challenge (prevent disappearing)
    if (isInSnoozeChallenge && challengeContainer && challengeContainer.style.display !== 'none') {
      return; // Keep challenge visible
    }
    
    if (shouldShowChallengeBar && !isInSnoozeChallenge) {
      // Show challenge bar for even extensions (before challenge)
      if (challengeBar) {
        challengeBar.style.display = 'block';
        const emoji1 = document.getElementById('snoozeChallengeBarEmoji');
        const emoji2 = document.getElementById('snoozeChallengeBarEmoji2');
        const buttonText = challengeBar.querySelector('span:nth-child(2)');
        if (emoji1) emoji1.textContent = emoji;
        if (emoji2) emoji2.textContent = emoji;
        if (buttonText) {
          buttonText.textContent = `Extend the break again. On break for ${elapsedText} already`;
        }
      }
      if (challengeContainer) challengeContainer.style.display = 'none';
      if (buttonsContainer) buttonsContainer.style.display = 'none';
    } else {
      // Show normal buttons (odd extensions or after challenge completed)
      if (challengeBar) challengeBar.style.display = 'none';
      if (challengeContainer) challengeContainer.style.display = 'none';
      if (buttonsContainer) buttonsContainer.style.display = 'block';
      
      // Update snooze title with elapsed time
      const snoozeTitle = document.getElementById('snoozeTitle');
      if (snoozeTitle) {
        snoozeTitle.textContent = `Extend break`;
      }
    }
  }
}

// Update break button
function updateBreakButton() {
  const takeBreakBtn = document.getElementById('takeBreakBtn');
  const endBreakBtn = document.getElementById('endBreakBtn');
  const snoozeButtons = document.getElementById('snoozeButtons');
  const breakRequirement = document.getElementById('breakRequirement');
  const resetCooldownSection = document.querySelector('.reset-cooldown');
  
  // Safety check: ensure all required elements exist
  if (!takeBreakBtn || !endBreakBtn || !snoozeButtons || !breakRequirement) {
    console.error('❌ Missing break button elements');
    return;
  }
  
  if (currentState.onBreak) {
    takeBreakBtn.style.display = 'none';
    endBreakBtn.style.display = 'block';
    snoozeButtons.style.display = 'block'; // Show snooze buttons during break
    updateSnoozeTitle(); // Update the emoji based on snooze count
    breakRequirement.style.display = 'none';
    if (resetCooldownSection) resetCooldownSection.style.display = 'none';
    
    // Show break whitelist controls
    const breakWhitelistControls = document.getElementById('breakWhitelistControls');
    if (breakWhitelistControls) breakWhitelistControls.style.display = 'block';
  } else {
    snoozeButtons.style.display = 'none'; // Hide snooze buttons when not on break
    // Only show button if we're not in the process of starting a break
    takeBreakBtn.style.display = isStartingBreak ? 'none' : 'block';
    endBreakBtn.style.display = 'none';
    
    // Hide break whitelist controls
    const breakWhitelistControls = document.getElementById('breakWhitelistControls');
    if (breakWhitelistControls) breakWhitelistControls.style.display = 'none';
    
    // Reset cache when break ends
    lastBreakWhitelistState = null;
    
    // Check if enough goals are set
    const hasEnoughGoals = currentState.dailyGoals && currentState.dailyGoals.length >= 3;
    
    // Check if in cooldown
    const inCooldown = currentState.cooldownEndTime && Date.now() < currentState.cooldownEndTime;
    
    // Update button text based on cooldown status
    if (inCooldown) {
      const cooldownMinutes = Math.ceil((currentState.cooldownEndTime - Date.now()) / 60000);
      takeBreakBtn.textContent = `⏳ Next break in ${cooldownMinutes} minute${cooldownMinutes !== 1 ? 's' : ''}`;
    } else {
      takeBreakBtn.textContent = '☕ Take a Break';
    }
    
    // Disable if not enough goals OR in cooldown
    takeBreakBtn.disabled = !hasEnoughGoals || inCooldown;
    
    // Show warning if not enough goals
    if (!hasEnoughGoals && !inCooldown) {
      breakRequirement.style.display = 'block';
      if (resetCooldownSection) resetCooldownSection.style.display = 'none';
    } else {
      breakRequirement.style.display = 'none';
      // Show reset cooldown option ONLY when in cooldown and has enough goals
      if (resetCooldownSection) {
        resetCooldownSection.style.display = (inCooldown && hasEnoughGoals) ? 'block' : 'none';
      }
    }
  }
}

// Update previous day's goals section
function updatePreviousGoals() {
  const section = document.getElementById('previousGoalsSection');
  const goalsList = document.getElementById('previousGoalsList');
  
  // Safety check
  if (!section || !goalsList) {
    console.error('❌ Missing previous goals elements');
    return;
  }
  
  // Show section only if there are previous goals to display
  if (currentState.showPreviousGoals && currentState.previousDayGoals && currentState.previousDayGoals.length > 0) {
    // Filter out goals that have already been re-added to today's goals
    const dailyGoalTexts = (currentState.dailyGoals || []).map(g => g.text.toLowerCase());
    const goalsToShow = currentState.previousDayGoals.filter(goal => 
      !dailyGoalTexts.includes(goal.text.toLowerCase())
    );
    
    // If no goals left to show after filtering, hide the section
    if (goalsToShow.length === 0) {
      section.style.display = 'none';
      return;
    }
    
    section.style.display = 'block';
    
    goalsList.innerHTML = goalsToShow.map(goal => `
      <div class="item previous-goal-item">
        <span class="goal-text">${goal.completed ? '✅' : '⬜'} ${escapeHtml(goal.text)}</span>
        <button class="btn btn-add" data-readd-goal-id="${goal.id}">Re-add</button>
      </div>
    `).join('');
    
    // Add click handlers for re-adding
    document.querySelectorAll('[data-readd-goal-id]').forEach(btn => {
      if (!btn || !btn.dataset) return;
      btn.addEventListener('click', async () => {
        if (!btn || !btn.dataset) return;
        const goalId = parseInt(btn.dataset.readdGoalId);
        if (!isNaN(goalId)) {
        await reAddPreviousGoal(goalId);
        }
      });
    });
  } else {
    section.style.display = 'none';
  }
}

// Update goals list
function updateGoalsList() {
  console.log('📋 Updating goals list');
  const goalsList = document.getElementById('goalsList');
  
  if (!goalsList) {
    console.error('❌ goalsList element not found!');
    return;
  }
  
  if (!currentState.dailyGoals || currentState.dailyGoals.length === 0) {
    console.log('ℹ️ No goals to display');
    goalsList.innerHTML = '<div class="empty-state">No goals set yet. Add your first goal!</div>';
    return;
  }
  
  console.log('✅ Displaying', currentState.dailyGoals.length, 'goals');
  goalsList.innerHTML = currentState.dailyGoals.map(goal => `
    <div class="item goal-item ${goal.completed ? 'completed' : ''}">
      <span class="goal-text" data-goal-id="${goal.id}">${goal.completed ? '✅' : '⬜'} ${escapeHtml(goal.text)}</span>
      <button class="btn-remove" data-remove-goal-id="${goal.id}">✕</button>
    </div>
  `).join('');
  
  // Add click handlers for toggling
  document.querySelectorAll('.goal-text').forEach(span => {
    if (!span || !span.dataset) return;
    span.addEventListener('click', () => {
      if (!span || !span.dataset) return;
      const goalId = parseInt(span.dataset.goalId);
      if (!isNaN(goalId)) {
      toggleGoal(goalId);
      }
    });
  });
  
  // Add click handlers for removing
  document.querySelectorAll('[data-remove-goal-id]').forEach(btn => {
    if (!btn || !btn.dataset) return;
    btn.addEventListener('click', (e) => {
      if (!btn || !btn.dataset) return;
      e.stopPropagation(); // Prevent triggering toggle
      const goalId = parseInt(btn.dataset.removeGoalId);
      if (!isNaN(goalId)) {
      removeGoal(goalId);
      }
    });
  });
}

// Update timeline
function updateTimeline() {
  console.log('📅 Updating timeline');
  const timeline = document.getElementById('timeline');
  
  if (!timeline) {
    console.error('❌ timeline element not found!');
    return;
  }
  
  if (!currentState.todayTimeline || currentState.todayTimeline.length === 0) {
    console.log('ℹ️ No timeline events to display');
    timeline.innerHTML = '<div class="timeline-empty">No activity yet today</div>';
    return;
  }
  
  // Calculate total break time today
  let totalBreakMinutes = 0;
  currentState.todayTimeline.forEach(item => {
    if (item.type === 'break') {
      if (item.endedEarly) {
        totalBreakMinutes += (item.actualDuration || 0);
      } else if (item.snoozeCount > 0) {
        totalBreakMinutes += (item.totalDuration || 0);
      } else {
        totalBreakMinutes += (item.totalDuration || item.plannedDuration || 0);
      }
    }
  });

  // Update header with total break time
  const timelineHeader = document.getElementById('timelineHeader');
  if (timelineHeader) {
    if (totalBreakMinutes > 0) {
      // Format: "Today's Timeline (45 min break)"
      // If over 60 mins, show hours: "1h 15m break"
      let timeStr = `${totalBreakMinutes} min`;
      if (totalBreakMinutes >= 60) {
        const hours = Math.floor(totalBreakMinutes / 60);
        const mins = totalBreakMinutes % 60;
        timeStr = `${hours}h ${mins}m`;
      }
      // Use nodeValue to preserve the icon or use innerHTML safely
      timelineHeader.innerHTML = `📆 Today's Timeline <span style="font-size:0.8em; font-weight:normal;">(Total: ${timeStr} break)</span>`;
    } else {
      timelineHeader.innerHTML = `📆 Today's Timeline`;
    }
  }
  
  console.log('✅ Displaying', currentState.todayTimeline.length, 'timeline events');
  
  // Sort by timestamp (oldest first)
  const sorted = [...currentState.todayTimeline].sort((a, b) => a.timestamp - b.timestamp);
  
  // Track goal completions for progressive celebration emojis
  let goalCompletionCount = 0;
  
  timeline.innerHTML = sorted.map(item => {
    const time = new Date(item.timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    if (item.type === 'break') {
      let description = '☕ Break';
      
      // Determine actual break duration
      let actualBreakDuration;
      if (item.endedEarly) {
        // Break was ended early
        actualBreakDuration = item.actualDuration;
        description += `: ended after ${item.actualDuration} min`;
      } else if (item.snoozeCount && item.snoozeCount > 0) {
        // Break with snoozes
        actualBreakDuration = item.totalDuration;
        description += `: Extended ${item.snoozeCount} time${item.snoozeCount > 1 ? 's' : ''}, total time ${item.totalDuration} min`;
      } else {
        // Normal break
        actualBreakDuration = item.totalDuration || item.plannedDuration;
        description += `: ${actualBreakDuration} min`;
      }
      
      // Determine color based on duration relative to default break duration
      const defaultDuration = currentState.breakDuration || 5;
      let colorClass = 'break-blue'; // Default
      
      if (actualBreakDuration >= defaultDuration * 3) {
        colorClass = 'break-red';
      } else if (actualBreakDuration >= defaultDuration * 2) {
        colorClass = 'break-orange';
      } else if (actualBreakDuration >= defaultDuration) {
        colorClass = 'break-yellow';
      }
      
      return `
        <div class="timeline-item ${colorClass}">
          <div class="timeline-time">${time}</div>
          <div class="timeline-description">${description}</div>
        </div>
      `;
    } else if (item.type === 'goal') {
      // Get progressively more celebratory emoji based on completion count
      const celebrationEmoji = getCelebrationEmoji(goalCompletionCount);
      goalCompletionCount++; // Increment for next goal
      
      return `
        <div class="timeline-item goal">
          <div class="timeline-time">${time}</div>
          <div class="timeline-description">${celebrationEmoji} Completed: ${escapeHtml(item.goalText)}</div>
        </div>
      `;
    } else if (item.type === 'goal_removed') {
      return `
        <div class="timeline-item goal-removed">
          <div class="timeline-time">${time}</div>
          <div class="timeline-description">🧹 Removed: ${escapeHtml(item.goalText)}</div>
        </div>
      `;
    }
    return '';
  }).join('');
}

// Cache for break whitelist to prevent unnecessary updates
let lastBreakWhitelistState = null;
let isProcessingBreakWhitelistChange = false;

// Cache for break site selector to prevent unnecessary updates
let lastBreakSiteSelectorState = null;

// Helper: Update break whitelist controls (checkboxes)
function updateBreakWhitelistControls(force = false) {
  const container = document.getElementById('breakWhitelistControls');
  if (!container || !currentState.onBreak) {
    if (container) container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  
  const checkboxList = document.getElementById('breakWhitelistCheckboxes');
  if (!checkboxList) return;
  
  // Don't update if we're currently processing a change (unless forced)
  if (!force && isProcessingBreakWhitelistChange) {
    return;
  }
  
  const breakWhitelist = (currentState.breakWhitelist || []).map(site => normalizeDomain(site));
  const blockedSites = (currentState.blockedSites || []).map(site => normalizeDomain(site));
  const siteCategories = currentState.siteCategories || {};
  
  // Check if state has actually changed to avoid unnecessary updates
  const currentStateKey = JSON.stringify({
    breakWhitelist: [...breakWhitelist].sort(),
    blockedSites: [...blockedSites].sort(),
    unlockAll: currentState.unlockAll
  });
  
  if (lastBreakWhitelistState === currentStateKey) {
    return; // State hasn't changed, skip update
  }
  
  lastBreakWhitelistState = currentStateKey;
  
  // Clear existing
  checkboxList.innerHTML = '';
  
  // Get categories and counts
  const categories = {};
  // Filter out duplicates
  const uniqueSites = [...new Set(blockedSites)];
  
  uniqueSites.forEach(site => {
    const cat = siteCategories[site] || 'Other';
    if (!categories[cat]) categories[cat] = 0;
    categories[cat]++;
  });
  
  const sortedCats = Object.keys(categories).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });
  
  if (sortedCats.length === 0) {
    checkboxList.innerHTML = '<div style="padding:10px; text-align:center; color:#666;">No categories available</div>';
    return;
  }
  
  sortedCats.forEach(cat => {
    // Determine if category is checked
    // Checked if ALL sites in this category are in breakWhitelist OR unlockAll is true
    let isChecked = false;
    
    if (currentState.unlockAll) {
      isChecked = true;
    } else {
      // Find all sites in this category
      const sitesInCat = uniqueSites.filter(site => (siteCategories[site] || 'Other') === cat);
      // Check if they are all in whitelist
      if (sitesInCat.length > 0) {
        isChecked = sitesInCat.every(site => breakWhitelist.includes(site));
      }
    }
    
    const count = categories[cat];
    const label = document.createElement('label');
    label.className = 'category-checkbox-label';
    label.innerHTML = `
      <input type="checkbox" value="${escapeHtml(cat)}" class="break-whitelist-checkbox" ${isChecked ? 'checked' : ''} />
      <span>${escapeHtml(cat)} (${count} sites)</span>
    `;
    
    // Add change listener
    const checkbox = label.querySelector('input');
    checkbox.addEventListener('change', async (e) => {
      isProcessingBreakWhitelistChange = true;
      const category = e.target.value;
      const isChecking = e.target.checked;
      
      try {
        if (isChecking) {
          await chrome.runtime.sendMessage({ 
            action: 'addCategoryToBreakWhitelist', 
            category: category 
          });
        } else {
          await chrome.runtime.sendMessage({ 
            action: 'removeCategoryFromBreakWhitelist', 
            category: category 
          });
        }
        // State update will trigger re-render via listener
        await loadState();
      } catch (error) {
        console.error('❌ Error updating break whitelist:', error);
      } finally {
        isProcessingBreakWhitelistChange = false;
      }
    });
    
    checkboxList.appendChild(label);
  });
}

// Update block statistics
function updateBlockStats() {
  console.log('📊 Updating block stats');
  const totalBlocksEl = document.getElementById('totalBlocksCount');
  const topBlockedListEl = document.getElementById('topBlockedList');
  
  if (!totalBlocksEl || !topBlockedListEl) {
    console.error('❌ Missing block stats elements');
    return;
  }
  
  // Get block stats from state
  const blockStats = currentState.blockStats || {
    totalBlocksToday: 0,
    blocksByDomain: {}
  };
  
  // Update total count with judgmental emoji
  const totalBlocks = blockStats.totalBlocksToday || 0;
  const judgmentalEmojis = ['🙊', '🙈', '🤨', '😧', '🙄', '😩', '😤', '😱', '😭', '🤬', '💔', '🤢', '🤮', '💩', '💀'];
  // Get the Nth emoji for the Nth block (0-indexed, so block 1 = emoji 0, block 2 = emoji 1, etc.)
  const emojiIndex = Math.min(totalBlocks - 1, judgmentalEmojis.length - 1);
  const emoji = totalBlocks > 0 ? judgmentalEmojis[Math.max(0, emojiIndex)] : '';
  totalBlocksEl.textContent = emoji ? `${emoji} ${totalBlocks}` : totalBlocks;
  
  // Get top 3 most blocked domains
  const domains = Object.entries(blockStats.blocksByDomain || {})
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  
  if (domains.length === 0) {
    topBlockedListEl.innerHTML = '<div class="top-blocked-empty">No blocks yet today</div>';
  } else {
    const medals = ['🥇', '🥈', '🥉'];
    topBlockedListEl.innerHTML = domains.map((item, index) => `
      <div class="top-blocked-item">
        <span class="top-blocked-rank">${medals[index]}👎</span>
        <span class="top-blocked-domain">${escapeHtml(item.domain)}</span>
        <span class="top-blocked-count">${item.count}x</span>
      </div>
    `).join('');
  }
}

// Global variable to track last state
let lastSitesListState = null;

// Update sites list
function updateSitesList() {
  console.log('🚫 Updating blocked sites list');
  const sitesList = document.getElementById('sitesList');
  
  if (!sitesList) {
    console.error('❌ sitesList element not found!');
    return;
  }

  // 1. Check for active interaction
  const activeElement = document.activeElement;
  if (activeElement && activeElement.classList.contains('category-change-dropdown')) {
    return; // User is using a dropdown, don't refresh
  }

  // 2. Check for state changes
  const newStateSignature = JSON.stringify({
    sites: currentState.blockedSites ? [...currentState.blockedSites].sort() : [],
    categories: currentState.siteCategories || {}
  });

  if (lastSitesListState === newStateSignature) {
    return; // No changes, skip DOM update
  }
  lastSitesListState = newStateSignature;
  
  if (!currentState.blockedSites || currentState.blockedSites.length === 0) {
    console.log('ℹ️ No blocked sites to display');
    sitesList.innerHTML = '<div class="empty-state">No sites blocked</div>';
    return;
  }
  
  // Normalize and deduplicate sites (mail.google.com -> gmail.com)
  const normalizedSites = currentState.blockedSites
    .map(site => normalizeDomain(site))
    .filter((site, idx, arr) => arr.indexOf(site) === idx); // Remove duplicates
  
  console.log('✅ Displaying', normalizedSites.length, 'blocked sites');
  
  // Group by category
  const categories = {};
  const siteCategories = currentState.siteCategories || {};
  
  normalizedSites.forEach(site => {
    const cat = siteCategories[site] || 'Other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(site);
  });
  
  // Build HTML
  let html = '';
  
  // Sort categories (Other last)
  const catKeys = Object.keys(categories).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });
  
  // Collect all available categories for the dropdown
  // Start with default categories
  const allCategories = new Set(['Other', 'Social', 'Video', 'News', 'Sports', 'Games', 'Shopping']);
  // Add any custom categories from siteCategories
  Object.values(siteCategories).forEach(cat => allCategories.add(cat));
  const sortedAllCategories = Array.from(allCategories).sort();

  catKeys.forEach(cat => {
    const sites = categories[cat].sort();
    // Static header (folder-looking but not collapsible)
    html += `
      <div class="category-header">
        <span class="category-icon">📁</span>
        <span class="category-name">${escapeHtml(cat)}</span>
        <span class="category-count">(${sites.length})</span>
      </div>
      <div class="category-sites-static">
        ${sites.map(site => `
          <div class="item">
            <span class="site-text">${escapeHtml(site)}</span>
            <select class="category-change-dropdown" data-site="${escapeHtml(site)}">
              ${sortedAllCategories.map(c => `<option value="${escapeHtml(c)}" ${c === cat ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
              <option value="CREATE_NEW_CATEGORY">+ New...</option>
            </select>
            <button class="btn-remove" data-site="${escapeHtml(site)}">Remove</button>
          </div>
        `).join('')}
      </div>
    `;
  });
  
  sitesList.innerHTML = html;
  
  // Add category change handlers
  document.querySelectorAll('.category-change-dropdown').forEach(select => {
    select.addEventListener('change', async (e) => {
      // Blur the element immediately to allow updateSitesList to proceed on next refresh
      e.target.blur();
      
      const site = e.target.dataset.site;
      let newCategory = e.target.value;
      
      console.log(`🔄 Attempting to change category for ${site} to ${newCategory}`);
      
      if (newCategory === 'CREATE_NEW_CATEGORY') {
        const customCategory = prompt('Enter new category name:');
        if (customCategory && customCategory.trim()) {
          newCategory = customCategory.trim();
        } else {
          // Revert selection if cancelled or empty
          e.target.value = currentState.siteCategories[normalizeDomain(site)] || 'Other';
          return;
        }
      }
      
      if (site && newCategory) {
        try {
          const response = await chrome.runtime.sendMessage({ 
            action: 'updateSiteCategory', 
            domain: site,
            category: newCategory
          });
          
          console.log('📨 Response from updateSiteCategory:', response);
          
          if (response && response.success) {
            await loadState();
          } else {
            console.error('❌ Failed to update category:', response);
          }
        } catch (error) {
          console.error('❌ Error updating category:', error);
        }
      }
    });
  });
  
  // Add click handlers
  document.querySelectorAll('.btn-remove').forEach(btn => {
    if (!btn || !btn.dataset) return;
    btn.addEventListener('click', async () => {
      if (!btn || !btn.dataset) return;
      const site = btn.dataset.site;
      if (!site) return;
      // Find all indices that normalize to this site
      const indices = currentState.blockedSites
        .map((s, idx) => normalizeDomain(s) === site ? idx : -1)
        .filter(idx => idx >= 0);
      // Remove all occurrences
      for (let i = indices.length - 1; i >= 0; i--) {
        await removeSite(indices[i]);
      }
    });
  });
}

// Update whitelist list
function updateWhitelistList() {
  console.log('✅ Updating whitelist');
  const whitelistList = document.getElementById('whitelistList');
  
  if (!whitelistList) {
    console.error('❌ whitelistList element not found!');
    return;
  }
  
  if (!currentState.whitelistedSites || currentState.whitelistedSites.length === 0) {
    console.log('ℹ️ No whitelisted sites to display');
    whitelistList.innerHTML = '<div class="empty-state">No whitelisted sites</div>';
    return;
  }
  
  console.log('✅ Displaying', currentState.whitelistedSites.length, 'whitelisted sites');
  
  // Group domains by base (e.g., "accounts.google")
  const grouped = {};
  const standalone = [];
  
  currentState.whitelistedSites.forEach((site, index) => {
    // Check if it's a country-specific domain (e.g., accounts.google.fr)
    const match = site.match(/^([^.]+\.[^.]+)\.(.+)$/);
    if (match) {
      const base = match[1]; // e.g., "accounts.google"
      const tld = match[2];  // e.g., "fr", "co.uk"
      
      if (!grouped[base]) {
        grouped[base] = [];
      }
      grouped[base].push({ tld, index });
    } else {
      standalone.push({ site, index });
    }
  });
  
  // Build HTML
  const html = [];
  
  // Show grouped domains first
  Object.keys(grouped).sort().forEach(base => {
    const variants = grouped[base];
    
    if (variants.length === 1) {
      // Only one variant, show normally
      const { tld, index } = variants[0];
      const fullDomain = `${base}.${tld}`;
      html.push(`
        <div class="item whitelist-item">
          <span class="site-text">✅ ${escapeHtml(fullDomain)}</span>
          <button class="btn-remove" data-whitelist-index="${index}">Remove</button>
        </div>
      `);
    } else {
      // Multiple variants, show consolidated
      // Find .com variant to show as primary
      const comVariant = variants.find(v => v.tld === 'com');
      const primaryTld = comVariant ? 'com' : variants[0].tld;
      const primaryIndex = comVariant ? comVariant.index : variants[0].index;
      
      // Get other TLDs (excluding primary)
      const otherTlds = variants
        .filter(v => v.tld !== primaryTld)
        .map(v => v.tld)
        .sort();
      
      // Show first 2 other TLDs
      const displayTlds = otherTlds.slice(0, 2);
      const remainingCount = otherTlds.length - displayTlds.length;
      
      let displayText = `${base}.${primaryTld}`;
      if (displayTlds.length > 0) {
        displayText += ` (and .${displayTlds.join(', .')}`;
        if (remainingCount > 0) {
          displayText += `, +${remainingCount} others`;
        }
        displayText += ')';
      }
      
      // Show group with "Remove All" button
      const allIndices = variants.map(v => v.index).join(',');
      html.push(`
        <div class="item whitelist-item whitelist-group">
          <span class="site-text">✅ ${escapeHtml(displayText)}</span>
          <button class="btn-remove" data-whitelist-group="${allIndices}">Remove All</button>
        </div>
      `);
    }
  });
  
  // Show standalone domains
  standalone.sort((a, b) => a.site.localeCompare(b.site)).forEach(({ site, index }) => {
    html.push(`
      <div class="item whitelist-item">
        <span class="site-text">✅ ${escapeHtml(site)}</span>
        <button class="btn-remove" data-whitelist-index="${index}">Remove</button>
      </div>
    `);
  });
  
  whitelistList.innerHTML = html.join('');
  
  // Add click handlers for single items
  document.querySelectorAll('[data-whitelist-index]').forEach(btn => {
    if (!btn || !btn.dataset) return;
    btn.addEventListener('click', () => {
      if (!btn || !btn.dataset) return;
      const index = parseInt(btn.dataset.whitelistIndex);
      if (!isNaN(index)) {
      removeWhitelistedSite(index);
      }
    });
  });
  
  // Add click handlers for groups
  document.querySelectorAll('[data-whitelist-group]').forEach(btn => {
    if (!btn || !btn.dataset) return;
    btn.addEventListener('click', () => {
      if (!btn || !btn.dataset) return;
      const indices = btn.dataset.whitelistGroup.split(',').map(i => parseInt(i)).filter(i => !isNaN(i));
      if (indices.length > 0) {
      removeWhitelistedSiteGroup(indices);
      }
    });
  });
}

// Update settings (only if not currently being edited)
function updateSettings() {
  const breakDurationInput = document.getElementById('breakDuration');
  const cooldownDurationInput = document.getElementById('cooldownDuration');
  const challengeTypeSelect = document.getElementById('challengeType');
  const vocabLanguageSelect = document.getElementById('vocabLanguage');
  const vocabLanguageRow = document.getElementById('vocabLanguageRow');
  const redirectGif = document.getElementById('redirectGif');
  const redirectDonation = document.getElementById('redirectDonation');
  
  // Safety check
  if (!breakDurationInput || !cooldownDurationInput || !challengeTypeSelect || !redirectGif || !redirectDonation) {
    console.error('❌ Missing settings elements');
    return;
  }
  
  // Only update if not focused (not being edited)
  if (document.activeElement !== breakDurationInput) {
    breakDurationInput.value = currentState.breakDuration;
  }
  if (document.activeElement !== cooldownDurationInput) {
    cooldownDurationInput.value = currentState.cooldownDuration;
  }
  if (document.activeElement !== challengeTypeSelect) {
    challengeTypeSelect.value = currentState.challengeType || 'vocabulary';
  }
  
  // Show/hide language selector based on challenge type
  const challengeType = currentState.challengeType || 'vocabulary';
  if (vocabLanguageRow) {
    vocabLanguageRow.style.display = challengeType === 'vocabulary' ? 'flex' : 'none';
  }
  
  // Update vocab language selector
  if (vocabLanguageSelect) {
    // Save current selection to restore it if needed
    const currentVal = currentState.vocabLanguage || 'en_fr';
    
    // Clear custom options first (keep defaults)
    // Actually simpler to rebuild options if we have custom ones
    if (currentState.customDictionaries && Object.keys(currentState.customDictionaries).length > 0) {
      // Check if custom options already exist to avoid duplication
      const existingCustom = vocabLanguageSelect.querySelector('optgroup[label="Custom Dictionaries"]');
      if (!existingCustom) {
        const optGroup = document.createElement('optgroup');
        optGroup.label = "Custom Dictionaries";
        
        Object.values(currentState.customDictionaries).forEach(dict => {
          const option = document.createElement('option');
          option.value = dict.id;
          option.textContent = `${dict.icon} ${dict.name}`;
          optGroup.appendChild(option);
        });
        
        vocabLanguageSelect.appendChild(optGroup);
      }
    }
    
    if (document.activeElement !== vocabLanguageSelect) {
      vocabLanguageSelect.value = currentVal;
    }
  }
  
  // Update radio buttons
  const redirectType = currentState.redirectType || 'gif';
  if (redirectType === 'gif') {
    redirectGif.checked = true;
  } else {
    redirectDonation.checked = true;
  }
  
  // Update Advanced Settings Stats
  updateAdvancedStats();
}

function updateAdvancedStats() {
  const totalWordsEl = document.getElementById('totalWordsCount');
  const manualAddEl = document.getElementById('manuallyAddedCount');
  const manualRemoveEl = document.getElementById('manuallyRemovedCount');
  const dictNameEl = document.getElementById('currentDictionaryName');
  
  if (totalWordsEl) totalWordsEl.textContent = currentState.vocabulary ? currentState.vocabulary.length : 0;
  if (manualAddEl) manualAddEl.textContent = currentState.vocabStats ? currentState.vocabStats.manuallyAdded : 0;
  if (manualRemoveEl) manualRemoveEl.textContent = currentState.vocabStats ? currentState.vocabStats.manuallyRemoved : 0;
  
    if (dictNameEl) {
      const langCode = currentState.vocabLanguage || 'en_fr';
      const langMap = {
        'en_fr': '🇫🇷 French',
        'en_de': '🇩🇪 German',
        'en_es': '🇪🇸 Spanish',
        'en_it': '🇮🇹 Italian',
        'en_ar': '🇸🇦 Arabic',
        'en_ko': '🇰🇷 Korean',
        'en_ja': '🇯🇵 Japanese',
        'en_uk': '🇺🇦 Ukrainian',
        'en_pt': '🇵🇹 Portuguese',
        'en_vi': '🇻🇳 Vietnamese',
        'fr_gr': '🇫🇷🇬🇷 French/Greek'
      };
      
      // Check for custom dictionary
      if (currentState.customDictionaries && currentState.customDictionaries[langCode]) {
        const dict = currentState.customDictionaries[langCode];
        dictNameEl.textContent = `${dict.icon} ${dict.name}`;
      } else {
        dictNameEl.textContent = langMap[langCode] || langCode;
      }
    }
  }

// Toggle Advanced Settings
const advancedSettingsToggle = document.getElementById('advancedSettingsToggle');
if (advancedSettingsToggle) {
  advancedSettingsToggle.addEventListener('click', () => {
    const content = document.getElementById('advancedSettingsContent');
    if (content) {
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';
      advancedSettingsToggle.textContent = isHidden ? '▼ Advanced Dictionary Settings' : '▶ Advanced Dictionary Settings';
    }
  });
}

// Add New Word Logic
const addWordBtn = document.getElementById('addWordBtn');
if (addWordBtn) {
  addWordBtn.addEventListener('click', async () => {
    const wordInput = document.getElementById('newWordInput');
    const transInput = document.getElementById('newTranslationInput');
    const transcriptionInput = document.getElementById('newTranscriptionInput');
    
    if (!wordInput || !transInput) return;
    
    const word = wordInput.value.trim();
    const translation = transInput.value.trim();
    const transcription = transcriptionInput ? transcriptionInput.value.trim() : '';
    
    if (!word || !translation) {
      alert('Please enter both a word and a translation.');
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'addVocabularyWord',
        word: word,
        translation: translation,
        transcription: transcription
      });
      
      if (response && response.success) {
        wordInput.value = '';
        transInput.value = '';
        if (transcriptionInput) transcriptionInput.value = '';
        alert(`Added: ${word} -> ${translation} ${transcription ? '(' + transcription + ')' : ''}`);
        await loadState(); // Refresh state and stats
      } else {
        alert(response?.error || 'Failed to add word.');
      }
    } catch (error) {
      console.error('Error adding word:', error);
      alert('Error adding word.');
    }
  });
}

// Create Dictionary Logic
const showCreateDictBtn = document.getElementById('showCreateDictBtn');
const createDictForm = document.getElementById('createDictForm');
const cancelNewDictBtn = document.getElementById('cancelNewDictBtn');
const saveNewDictBtn = document.getElementById('saveNewDictBtn');

if (showCreateDictBtn && createDictForm) {
  showCreateDictBtn.addEventListener('click', () => {
    createDictForm.style.display = 'block';
    showCreateDictBtn.style.display = 'none';
  });
}

if (cancelNewDictBtn && createDictForm) {
  cancelNewDictBtn.addEventListener('click', () => {
    createDictForm.style.display = 'none';
    showCreateDictBtn.style.display = 'block';
  });
}

if (saveNewDictBtn) {
  saveNewDictBtn.addEventListener('click', async () => {
    const nameInput = document.getElementById('newDictName');
    const iconInput = document.getElementById('newDictIcon');
    const wordsInput = document.getElementById('newDictWords');
    
    if (!nameInput) return;
    
    const name = nameInput.value.trim();
    const icon = iconInput ? iconInput.value.trim() || '📚' : '📚';
    const csvText = wordsInput ? wordsInput.value.trim() : '';
    
    if (!name) {
      alert('Please enter a dictionary name.');
      return;
    }
    
    // Parse CSV
    const vocabulary = [];
    if (csvText) {
      const lines = csvText.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        
        let parts = [];
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
        parts.push(current.trim());
        
        if (parts.length >= 2) {
          const word = parts[0].replace(/^"|"$/g, '');
          const translation = parts[1].replace(/^"|"$/g, '');
          const transcription = parts.length > 2 ? parts[2].replace(/^"|"$/g, '') : '';
          const similar = parts.length > 3 ? (parts[3].trim() === '1' || parts[3].trim() === 'true') : false;
          
          vocabulary.push({
            word,
            translation,
            transcription,
            similar,
            originalWord: word // Assume simple add for now
          });
        }
      }
    }
    
    if (vocabulary.length === 0 && !confirm('Create an empty dictionary?')) {
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'createCustomDictionary',
        name: name,
        icon: icon,
        vocabulary: vocabulary
      });
      
      if (response && response.success) {
        alert(`Dictionary "${name}" created!`);
        
        // Reset form
        nameInput.value = '';
        if (iconInput) iconInput.value = '';
        if (wordsInput) wordsInput.value = '';
        createDictForm.style.display = 'none';
        showCreateDictBtn.style.display = 'block';
        
        await loadState(); // This will also update the selector and switch to the new dict
      } else {
        alert('Failed to create dictionary.');
      }
    } catch (error) {
      console.error('Error creating dictionary:', error);
      alert('Error creating dictionary.');
    }
  });
}

// Bulk Import Logic
const bulkImportBtn = document.getElementById('bulkImportBtn');
if (bulkImportBtn) {
  bulkImportBtn.addEventListener('click', async () => {
    const input = document.getElementById('bulkImportInput');
    if (!input) return;
    
    const text = input.value.trim();
    if (!text) {
      alert('Please paste CSV content first.');
      return;
    }
    
    const lines = text.split('\n');
    let successCount = 0;
    let failCount = 0;
    
    // Process sequentially to avoid overwhelming message channel
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Simple CSV parsing (handles basic quotes)
      let parts = [];
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
      parts.push(current.trim());
      
      if (parts.length >= 2) {
        const word = parts[0].replace(/^"|"$/g, '');
        const translation = parts[1].replace(/^"|"$/g, '');
        const transcription = parts.length > 2 ? parts[2].replace(/^"|"$/g, '') : '';
        // Skip 'Similar' column (4th) for now, or use it
        
        try {
          const response = await chrome.runtime.sendMessage({
            action: 'addVocabularyWord',
            word: word,
            translation: translation,
            transcription: transcription
          });
          
          if (response && response.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (e) {
          failCount++;
        }
      } else {
        failCount++;
      }
    }
    
    alert(`Import complete!\nAdded: ${successCount}\nFailed/Skipped: ${failCount}`);
    input.value = ''; // Clear input
    await loadState(); // Refresh UI
  });
}

// Help Button Logic
const csvHelpBtn = document.getElementById('csvHelpBtn');
if (csvHelpBtn) {
  csvHelpBtn.addEventListener('click', () => {
    const content = document.getElementById('csvHelpContent');
    if (content) {
      content.style.display = content.style.display === 'none' ? 'block' : 'none';
    }
  });
}

// Export Dictionary Logic
const copyDictBtn = document.getElementById('copyDictionaryBtn');
if (copyDictBtn) {
  copyDictBtn.addEventListener('click', () => {
    if (!currentState.vocabulary || currentState.vocabulary.length === 0) {
      alert('Dictionary is empty.');
      return;
    }
    
    // Format as CSV
    const header = "Word,Translation,OriginalWord,Transcription\n";
    const rows = currentState.vocabulary.map(v => {
      // Escape quotes if needed, though simple replacement is usually enough for this context
      const w = v.word.includes(',') ? `"${v.word}"` : v.word;
      const t = v.translation.includes(',') ? `"${v.translation}"` : v.translation;
      const ow = v.originalWord ? (v.originalWord.includes(',') ? `"${v.originalWord}"` : v.originalWord) : "";
      const tr = v.transcription ? (v.transcription.includes(',') ? `"${v.transcription}"` : v.transcription) : "";
      return `${w},${t},${ow},${tr}`;
    }).join('\n');
    
    const csvContent = header + rows;
    
    navigator.clipboard.writeText(csvContent).then(() => {
      const feedback = document.getElementById('copyFeedback');
      if (feedback) {
        feedback.style.display = 'block';
        setTimeout(() => {
          feedback.style.display = 'none';
        }, 2000);
      }
    }).catch(err => {
      console.error('Failed to copy dictionary:', err);
      alert('Failed to copy to clipboard.');
    });
  });
}

// Take break - show challenge based on selected type
async function takeBreak() {
  // Set flag to prevent button from reappearing during challenge
  isStartingBreak = true;
  
  // Hide take break button
  const takeBreakBtn = document.getElementById('takeBreakBtn');
  if (takeBreakBtn) takeBreakBtn.style.display = 'none';
  
  // Show challenge based on setting
  const challengeMode = currentState.challengeType || 'vocabulary';
  
  if (challengeMode === 'vocabulary') {
    const vocabCount = 10;
    
    // Check if there are enough vocab words
    if (!currentState.vocabulary || currentState.vocabulary.length < vocabCount) {
      alert(`⚠️ Need at least ${vocabCount} vocabulary words in voc.csv!`);
      isStartingBreak = false; // Reset flag since we're aborting
      if (takeBreakBtn) takeBreakBtn.style.display = 'block';
      return;
    }
    
    challengeType = 'normal';
    requiredWordCount = 10;
    showVocabChallenge(vocabCount);
  } else if (challengeMode === 'maths') {
    showMathsChallenge();
  } else if (challengeMode === 'rickroll') {
    showRickrollChallenge();
  }
}

// Confirm duration after vocab challenge
async function confirmDuration() {
  const breakDurationSelector = document.getElementById('breakDurationSelector');
  if (!breakDurationSelector) {
    console.error('❌ breakDurationSelector not found');
    return;
  }
  const duration = parseInt(breakDurationSelector.value);
  
  if (!duration || duration < 1) {
    alert('Please enter a valid duration (at least 1 minute)');
    return;
  }
  
  // Get selected categories
  const checkboxes = document.querySelectorAll('.break-category-checkbox:checked');
  const selectedCategories = Array.from(checkboxes).map(cb => cb.value);
  
  // Check if "Select All" effectively (all checkboxes checked)
  const allCheckboxes = document.querySelectorAll('.break-category-checkbox');
  const isAllSelected = checkboxes.length > 0 && checkboxes.length === allCheckboxes.length;
  
  // Hide duration confirmation, start the break
  const breakDurationConfirm = document.getElementById('breakDurationConfirm');
  if (breakDurationConfirm) breakDurationConfirm.style.display = 'none';
  
  // Start break with selected duration and unlock mode
  try {
    const response = await chrome.runtime.sendMessage({ 
      action: 'startBreak',
      duration: duration,
      unlockCategories: selectedCategories, // List of categories to unlock
      unlockAll: isAllSelected // Flag for all allowed
    });
  
    if (response && response.success) {
      isStartingBreak = false; // Break started, clear flag
      await loadState();
    } else {
      console.error('❌ Failed to start break:', response);
      isStartingBreak = false; // Clear flag even on failure
    }
  } catch (error) {
    console.error('❌ Error starting break:', error);
    isStartingBreak = false; // Clear flag on error
  }
}

// Cancel duration confirmation
function cancelDuration() {
  const breakDurationConfirm = document.getElementById('breakDurationConfirm');
  if (breakDurationConfirm) breakDurationConfirm.style.display = 'none';
  isStartingBreak = false; // Reset flag since we're cancelling
  const takeBreakBtn = document.getElementById('takeBreakBtn');
  if (takeBreakBtn) takeBreakBtn.style.display = 'block';
  resetChallengeState();
}

// Reset cooldown - show challenge based on validation step setting (harder version)
async function resetCooldown() {
  // Hide the form
  const resetCooldownForm = document.getElementById('resetCooldownForm');
  if (resetCooldownForm) resetCooldownForm.style.display = 'none';
  
  // Show challenge based on setting (same as break, but harder)
  const challengeMode = currentState.challengeType || 'vocabulary';
  
  challengeType = 'reset';
  
  if (challengeMode === 'vocabulary') {
    const vocabCount = 30; // Harder: 30 words instead of 10
  
  // Check if there are enough vocab words
  if (!currentState.vocabulary || currentState.vocabulary.length < vocabCount) {
    alert(`⚠️ Need at least ${vocabCount} vocabulary words in voc.csv!`);
      if (resetCooldownForm) resetCooldownForm.style.display = 'flex';
    return;
  }
  
  requiredWordCount = 30;
  showVocabChallenge(vocabCount);
  } else if (challengeMode === 'maths') {
    showMathsChallenge(true); // Pass true for reset mode (harder)
  } else if (challengeMode === 'rickroll') {
    showRickrollChallenge(true); // Pass true for reset mode (longer)
  }
}

// Helper function to get language flag based on language code and whether it's the first or second language
function getLanguageFlag(langCode, isFirstLanguage) {
  const flagMap = {
    'en_fr': { first: '🇬🇧', second: '🇫🇷' },
    'en_de': { first: '🇬🇧', second: '🇩🇪' },
    'en_es': { first: '🇬🇧', second: '🇪🇸' },
    'en_it': { first: '🇬🇧', second: '🇮🇹' },
    'en_ar': { first: '🇬🇧', second: '🇸🇦' },
    'en_ko': { first: '🇬🇧', second: '🇰🇷' },
    'en_ja': { first: '🇬🇧', second: '🇯🇵' },
    'en_uk': { first: '🇬🇧', second: '🇺🇦' },
    'en_pt': { first: '🇬🇧', second: '🇵🇹' },
    'en_vi': { first: '🇬🇧', second: '🇻🇳' },
    'fr_gr': { first: '🇬🇷', second: '🇫🇷' }
  };
  
  const flags = flagMap[langCode] || { first: '🇬🇧', second: '🇬🇧' };
  return isFirstLanguage ? flags.first : flags.second;
}

// Show vocabulary challenge
function showVocabChallenge(vocabCount) {
  // Filter out words that are similar (similar=true)
  const vocab = [...currentState.vocabulary].filter(item => !item.similar);
  
  // Check if we have enough words after filtering
  if (vocab.length < vocabCount) {
    alert(`⚠️ Need at least ${vocabCount} vocabulary words (excluding similar words)!`);
    isStartingBreak = false;
    const takeBreakBtn = document.getElementById('takeBreakBtn');
    if (takeBreakBtn) takeBreakBtn.style.display = 'block';
    return;
  }
  
  // Pick random words
  const shuffled = vocab.sort(() => Math.random() - 0.5);
  const selectedWords = shuffled.slice(0, vocabCount);
  
  // Get current language code
  const langCode = currentState.vocabLanguage || 'en_fr';
  
  // Check if language has transcriptions (AR, JP, KR, UK)
  const hasTranscription = ['en_ar', 'en_ja', 'en_ko', 'en_uk'].includes(langCode);
  
  // Show/hide transcription checkbox based on language
  const transcriptionContainer = document.getElementById('showTranscriptionContainer');
  const transcriptionCheckbox = document.getElementById('showTranscriptionCheckbox');
  if (transcriptionContainer) {
    transcriptionContainer.style.display = hasTranscription ? 'block' : 'none';
  }
  
  // For each word, randomly decide whether to show word or translation first
  currentVocabWords = selectedWords.map(item => {
    const showWordFirst = Math.random() < 0.5;
    let displayedText = showWordFirst ? item.word : item.translation;
    let hiddenText = showWordFirst ? item.translation : item.word;
    
    // Store transcription separately
    const transcription = item.transcription || '';
    
    // Remove transcription from translation if it's already there (from old format)
    if (hiddenText.includes('(') && hiddenText.includes(')')) {
      const match = hiddenText.match(/^(.+?)\s*\((.+?)\)$/);
      if (match) {
        hiddenText = match[1].trim();
      }
    }
    // Also check displayed text
    if (displayedText.includes('(') && displayedText.includes(')')) {
      const match = displayedText.match(/^(.+?)\s*\((.+?)\)$/);
      if (match) {
        displayedText = match[1].trim();
      }
    }
    
    const displayedFlag = getLanguageFlag(langCode, showWordFirst);
    
    // Use originalWord if available (for English words with articles), otherwise use word
    const originalWordForRemoval = item.originalWord || item.word;
    
    return {
      displayed: displayedText,
      displayedWithFlag: `${displayedFlag} ${displayedText}`,
      hidden: hiddenText,
      transcription: transcription,
      showWordFirst: showWordFirst,
      originalWord: originalWordForRemoval, // Store original word for removal (without article)
      originalTranslation: item.translation // Store original translation for removal
    };
  });
  
  revealedCount = 0;
  
  // Update challenge title based on type
  const challengeTitle = document.querySelector('.vocab-challenge h3');
  if (challengeTitle) {
  if (challengeType === 'reset') {
    challengeTitle.textContent = '🔓 Reset Cooldown Challenge!';
  } else if (challengeType === 'special') {
    challengeTitle.textContent = '⭐ Special Break Challenge!';
  } else {
    challengeTitle.textContent = '📚 Vocabulary Challenge!';
    }
  }
  
  // Render words list
  const wordsList = document.getElementById('vocabWordsList');
  if (!wordsList) {
    console.error('❌ vocabWordsList element not found!');
    return;
  }
  // Get transcription checkbox state
  const showTranscription = transcriptionCheckbox ? transcriptionCheckbox.checked : true;
  
  wordsList.innerHTML = currentVocabWords.map((word, index) => {
    // For languages with transcriptions, add it next to the non-Latin script word
    // The non-Latin script is always the translation (for en_ar, en_ja, en_ko, en_uk)
    let displayedText = word.displayed;
    let hiddenText = word.hidden;
    let displayedWithFlag = word.displayedWithFlag;
    
    if (word.transcription && showTranscription && hasTranscription) {
      // Determine which text is the non-Latin one (translation)
      if (word.showWordFirst) {
        // English is displayed, translation (non-Latin) is hidden
        hiddenText = `${word.hidden} (${word.transcription})`;
      } else {
        // Translation (non-Latin) is displayed, English is hidden
        displayedText = `${word.displayed} (${word.transcription})`;
        displayedWithFlag = `${getLanguageFlag(langCode, false)} ${displayedText}`;
      }
    }
    
    // Create tooltip with hidden text to prevent cheating
    const fullText = "Reveal to see translation";
    return `
    <div class="vocab-challenge-item" data-index="${index}" title="${escapeHtml(fullText)}">
      <div class="vocab-word-content">
      <div class="vocab-word-text">${escapeHtml(displayedWithFlag)}</div>
      <div class="vocab-translation">→ ${escapeHtml(hiddenText)}</div>
    </div>
      <button class="vocab-remove-btn" data-index="${index}" style="display:none;" title="Remove from the learning list">×</button>
      <button class="vocab-undo-btn" data-index="${index}" style="display:none;" title="Bring it back to the list">♻️</button>
      <div class="vocab-feedback-message" data-index="${index}" style="display:none;"></div>
    </div>
    `;
  }).join('');
  
  // Add click handlers
  document.querySelectorAll('.vocab-challenge-item').forEach(item => {
    if (!item) return;
    item.addEventListener('click', (e) => {
      if (!e || !e.target) return;
      // Don't reveal if clicking the remove button
      if (e.target.classList && e.target.classList.contains('vocab-remove-btn')) {
        return;
      }
      revealWord(item);
    });
  });
  
  // Add remove button handlers
  document.querySelectorAll('.vocab-remove-btn').forEach(btn => {
    if (!btn || !btn.dataset) return;
    btn.addEventListener('click', async (e) => {
      if (!btn || !btn.dataset) return;
      e.stopPropagation(); // Prevent revealing the word
      const index = parseInt(btn.dataset.index);
      if (!isNaN(index)) {
        await removeVocabWord(index);
      }
    });
  });
  
  // Add undo button handlers
  document.querySelectorAll('.vocab-undo-btn').forEach(btn => {
    if (!btn || !btn.dataset) return;
    btn.addEventListener('click', async (e) => {
      if (!btn || !btn.dataset) return;
      e.stopPropagation(); // Prevent revealing the word
      const index = parseInt(btn.dataset.index);
      if (!isNaN(index)) {
        await undoRemoveVocabWord(index);
      }
    });
  });
  
  // Add event listener for transcription checkbox
  if (transcriptionCheckbox) {
    transcriptionCheckbox.addEventListener('change', () => {
      updateTranscriptionVisibility();
    });
  }
  
  // Update UI
  updateVocabProgress();
  const confirmBreakBtn = document.getElementById('confirmBreakBtn');
  if (confirmBreakBtn) confirmBreakBtn.disabled = true;
  
  // Hide break buttons, show challenge
  const takeBreakBtn = document.getElementById('takeBreakBtn');
  if (takeBreakBtn) takeBreakBtn.style.display = 'none';
  const resetSection = document.querySelector('.reset-cooldown');
  if (resetSection) resetSection.style.display = 'none';
  const vocabChallenge = document.getElementById('vocabChallenge');
  if (vocabChallenge) vocabChallenge.style.display = 'block';
}

// Update transcription visibility for all words
function updateTranscriptionVisibility() {
  const transcriptionCheckbox = document.getElementById('showTranscriptionCheckbox');
  const wordsList = document.getElementById('vocabWordsList');
  if (!wordsList || !transcriptionCheckbox) return;
  
  const showTranscription = transcriptionCheckbox.checked;
  const langCode = currentState?.vocabLanguage || 'en_fr';
  const hasTranscription = ['en_ar', 'en_ja', 'en_ko', 'en_uk'].includes(langCode);
  
  // Update each word's displayed and hidden text
  document.querySelectorAll('.vocab-challenge-item').forEach((item, index) => {
    const displayedEl = item.querySelector('.vocab-word-text');
    const translationEl = item.querySelector('.vocab-translation');
    if (!displayedEl || !translationEl || !currentVocabWords[index]) return;
    
    const word = currentVocabWords[index];
    let displayedText = word.displayed;
    let hiddenText = word.hidden;
    let displayedWithFlag = word.displayedWithFlag;
    
    if (word.transcription && showTranscription && hasTranscription) {
      // Add transcription next to the non-Latin script word (translation)
      if (word.showWordFirst) {
        // English is displayed, translation (non-Latin) is hidden
        hiddenText = `${word.hidden} (${word.transcription})`;
      } else {
        // Translation (non-Latin) is displayed, English is hidden
        displayedText = `${word.displayed} (${word.transcription})`;
        displayedWithFlag = `${getLanguageFlag(langCode, false)} ${displayedText}`;
      }
    }
    
    displayedEl.textContent = displayedWithFlag;
    translationEl.textContent = `→ ${hiddenText}`;
    
    // Update tooltip
    const fullText = item.classList.contains('revealed') ? `${displayedText} → ${hiddenText}` : "Reveal to see translation";
    item.setAttribute('title', fullText);
  });
}

// Reveal a word
function revealWord(item) {
  if (item.classList.contains('revealed')) return;
  
  item.classList.add('revealed');
  
  // Update tooltip to show full text now that it is revealed
  const index = parseInt(item.dataset.index);
  if (!isNaN(index) && currentVocabWords[index]) {
    const word = currentVocabWords[index];
    let displayedText = word.displayed;
    let hiddenText = word.hidden;
    
    // Check for transcription logic again if needed (simplified here)
    // Ideally reuse updateTranscriptionVisibility logic or just grab text content
    const displayedEl = item.querySelector('.vocab-word-text');
    const translationEl = item.querySelector('.vocab-translation');
    if (displayedEl && translationEl) {
       item.setAttribute('title', `${displayedEl.textContent} ${translationEl.textContent}`);
    }
  }

  revealedCount++;
  updateVocabProgress();
  
  // Show remove button when word is revealed
  const removeBtn = item.querySelector('.vocab-remove-btn');
  if (removeBtn) {
    removeBtn.style.display = 'block';
    // Ensure title attribute is set for tooltip
    if (!removeBtn.getAttribute('title')) {
      removeBtn.setAttribute('title', 'Remove from the learning list');
    }
  }
  
  // Enable confirm button when all revealed
  if (revealedCount === requiredWordCount) {
    const confirmBreakBtn = document.getElementById('confirmBreakBtn');
    if (confirmBreakBtn) confirmBreakBtn.disabled = false;
  }
}

// Remove a vocabulary word from the dictionary
async function removeVocabWord(index) {
  const wordData = currentVocabWords[index];
  if (!wordData) return;
  
  // Store word data for potential undo
  removedVocabWords.set(index, {
    word: wordData.originalWord,
    translation: wordData.originalTranslation,
    displayed: wordData.displayed,
    hidden: wordData.hidden
  });
  
  // Send message to background to remove the word
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'removeVocabularyWord',
      word: wordData.originalWord,
      translation: wordData.originalTranslation
    });
    
    if (response && response.success) {
      // Update UI to show removed state with undo button
      const item = document.querySelector(`.vocab-challenge-item[data-index="${index}"]`);
      if (item) {
        item.style.opacity = '0.5';
        item.style.textDecoration = 'line-through';
        const removeBtn = item.querySelector('.vocab-remove-btn');
        const undoBtn = item.querySelector('.vocab-undo-btn');
        const feedbackMsg = item.querySelector('.vocab-feedback-message');
        if (removeBtn) {
          removeBtn.style.display = 'none';
        }
        if (undoBtn) {
          undoBtn.style.display = 'block';
          // Ensure title attribute is set for tooltip
          if (!undoBtn.getAttribute('title')) {
            undoBtn.setAttribute('title', 'Bring it back to the list');
          }
        }
        // Show feedback message (stays until challenge ends)
        if (feedbackMsg) {
          feedbackMsg.textContent = 'You won\'t learn it anymore';
          feedbackMsg.style.display = 'block';
        }
        // Keep item clickable for undo
      }
      
      // Reload state to get updated vocabulary
      await loadState();
    } else {
      console.error('❌ Failed to remove vocabulary word:', response);
    }
  } catch (error) {
    console.error('❌ Error removing vocabulary word:', error);
  }
}

// Undo removal of a vocabulary word
async function undoRemoveVocabWord(index) {
  const removedData = removedVocabWords.get(index);
  if (!removedData) return;
  
  // Send message to background to add the word back
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'addVocabularyWord',
      word: removedData.word,
      translation: removedData.translation
    });
    
    if (response && response.success) {
      // Remove from undo tracking
      removedVocabWords.delete(index);
      
      // Update UI to restore word
      const item = document.querySelector(`.vocab-challenge-item[data-index="${index}"]`);
      if (item) {
        item.style.opacity = '1';
        item.style.textDecoration = 'none';
        const removeBtn = item.querySelector('.vocab-remove-btn');
        const undoBtn = item.querySelector('.vocab-undo-btn');
        const feedbackMsg = item.querySelector('.vocab-feedback-message');
        if (removeBtn) {
          removeBtn.style.display = 'block';
        }
        if (undoBtn) {
          undoBtn.style.display = 'none';
        }
        // Show feedback message (fades out after 3 seconds)
        if (feedbackMsg) {
          feedbackMsg.textContent = 'Brought back to the list';
          feedbackMsg.style.display = 'block';
          // Hide message after 3 seconds
          setTimeout(() => {
            if (feedbackMsg) {
              feedbackMsg.style.display = 'none';
            }
          }, 500);
        }
      }
      
      // Reload state to get updated vocabulary
      await loadState();
    } else {
      console.error('❌ Failed to add vocabulary word back:', response);
    }
  } catch (error) {
    console.error('❌ Error adding vocabulary word back:', error);
  }
}

// Update progress
function updateVocabProgress() {
  const vocabProgress = document.getElementById('vocabProgress');
  if (vocabProgress) {
    vocabProgress.textContent = `${revealedCount}/${requiredWordCount} revealed`;
  }
}

// Confirm break after all words revealed
async function confirmBreak() {
  const vocabChallenge = document.getElementById('vocabChallenge');
  if (vocabChallenge) vocabChallenge.style.display = 'none';
  
  if (challengeType === 'reset') {
    // Reset cooldown to 0
    try {
    const response = await chrome.runtime.sendMessage({ action: 'resetCooldown' });
      if (response && response.success) {
        await handleCooldownResetSuccess();
      } else {
        console.error('❌ Failed to reset cooldown:', response);
      }
    } catch (error) {
      console.error('❌ Error resetting cooldown:', error);
    }
    
    // Reset challenge state
    challengeType = null;
    requiredWordCount = 10;
  } else {
    // Show duration confirmation after vocab challenge
    showDurationConfirmation();
  }
}

// Cancel vocabulary challenge
function cancelVocabChallenge() {
  const vocabChallenge = document.getElementById('vocabChallenge');
  if (vocabChallenge) vocabChallenge.style.display = 'none';
  const breakDurationConfirm = document.getElementById('breakDurationConfirm');
  if (breakDurationConfirm) breakDurationConfirm.style.display = 'none';
  cancelChallengeCommon();
}

// === MATHS CHALLENGE ===
let currentMathsAnswer = 0;
let mathsAttempts = 0;
let mathsProblemsSolved = 0;
let isResetMode = false;

function showMathsChallenge(isReset = false) {
  isResetMode = isReset;
  mathsAttempts = 0;
  mathsProblemsSolved = 0;
  
  if (isReset) {
    // Harder: 2 problems instead of 1
    generateMathsProblem(1);
  } else {
    // Normal: 1 problem
    generateMathsProblem(1);
  }
  
  // Hide break buttons, show challenge
  const takeBreakBtn = document.getElementById('takeBreakBtn');
  if (takeBreakBtn) takeBreakBtn.style.display = 'none';
  const resetSection = document.querySelector('.reset-cooldown');
  if (resetSection) resetSection.style.display = 'none';
  const mathsChallenge = document.getElementById('mathsChallenge');
  if (mathsChallenge) mathsChallenge.style.display = 'block';
  
  // Focus on input
  setTimeout(() => {
    const mathsAnswer = document.getElementById('mathsAnswer');
    if (mathsAnswer) mathsAnswer.focus();
  }, 100);
}

function generateMathsProblem(problemNum) {
  let num1, num2;
  
  // For reset mode, use harder numbers (larger range)
  if (isResetMode) {
    num1 = Math.floor(Math.random() * 15) + 5; // 5-19
    num2 = Math.floor(Math.random() * 25) + 10; // 10-34
  } else {
    num1 = Math.floor(Math.random() * 9) + 1; // 1-9
    num2 = Math.floor(Math.random() * 20) + 1; // 1-20
  }
  
  currentMathsAnswer = num1 * num2;
  
  // Update UI
  const mathsQuestion = document.getElementById('mathsQuestion');
  if (mathsQuestion) {
    if (isResetMode) {
      mathsQuestion.textContent = problemNum === 1 
        ? `Problem 1 of 2: What is ${num1} × ${num2}?`
        : `Problem 2 of 2: What is ${num1} × ${num2}?`;
    } else {
      mathsQuestion.textContent = `What is ${num1} × ${num2}?`;
    }
  }
  
  const mathsAnswer = document.getElementById('mathsAnswer');
  if (mathsAnswer) mathsAnswer.value = '';
  const attemptInfo = document.getElementById('mathsAttemptInfo');
  if (attemptInfo) {
    attemptInfo.textContent = isResetMode 
      ? `Problem ${problemNum} of 2 - Attempt 1 of 2`
      : 'Attempt 1 of 2';
    attemptInfo.style.color = '#666';
  }
}

async function submitMathsAnswer() {
  const mathsAnswer = document.getElementById('mathsAnswer');
  if (!mathsAnswer) {
    console.error('❌ mathsAnswer element not found');
    return;
  }
  const userAnswer = parseInt(mathsAnswer.value);
  mathsAttempts++;
  
  if (userAnswer === currentMathsAnswer) {
    // Correct!
    mathsProblemsSolved++;
    
    if (isResetMode && mathsProblemsSolved < 2) {
      // Need to solve second problem
      mathsAttempts = 0;
      generateMathsProblem(2);
      const mathsAnswer = document.getElementById('mathsAnswer');
      if (mathsAnswer) {
        mathsAnswer.value = '';
        mathsAnswer.focus();
      }
    } else {
      // All problems solved (or normal mode with 1 problem)
      if (challengeType === 'reset') {
        // Reset cooldown
        try {
          const response = await chrome.runtime.sendMessage({ action: 'resetCooldown' });
          if (response && response.success) {
            const mathsChallenge = document.getElementById('mathsChallenge');
            if (mathsChallenge) mathsChallenge.style.display = 'none';
            await handleCooldownResetSuccess();
          } else {
            console.error('❌ Failed to reset cooldown:', response);
          }
        } catch (error) {
          console.error('❌ Error resetting cooldown:', error);
        }
      } else {
        // Proceed to duration selection
        const mathsChallenge = document.getElementById('mathsChallenge');
        if (mathsChallenge) mathsChallenge.style.display = 'none';
        showDurationConfirmation();
      }
    }
  } else if (mathsAttempts < 2) {
    // Wrong, but give another try
    const attemptInfo = document.getElementById('mathsAttemptInfo');
    if (attemptInfo) {
      if (isResetMode) {
        attemptInfo.textContent = `❌ Wrong! Try again - Problem ${mathsProblemsSolved + 1} of 2 (Attempt 2 of 2)`;
  } else {
        attemptInfo.textContent = '❌ Wrong! Try again (Attempt 2 of 2)';
      }
      attemptInfo.style.color = '#ff0000';
    }
    const mathsAnswer = document.getElementById('mathsAnswer');
    if (mathsAnswer) {
      mathsAnswer.value = '';
      mathsAnswer.focus();
    }
  } else {
    // Second attempt wrong, show answer and proceed anyway
    alert(`The answer was ${currentMathsAnswer}. Proceeding anyway! 😊`);
    
    if (challengeType === 'reset') {
      // Reset cooldown even if wrong
      try {
        const response = await chrome.runtime.sendMessage({ action: 'resetCooldown' });
        if (response && response.success) {
          const mathsChallenge = document.getElementById('mathsChallenge');
          if (mathsChallenge) mathsChallenge.style.display = 'none';
          await handleCooldownResetSuccess();
        } else {
          console.error('❌ Failed to reset cooldown:', response);
        }
      } catch (error) {
        console.error('❌ Error resetting cooldown:', error);
      }
    } else {
      const mathsChallenge = document.getElementById('mathsChallenge');
      if (mathsChallenge) mathsChallenge.style.display = 'none';
      showDurationConfirmation();
    }
  }
}

function cancelMathsChallenge() {
  const mathsChallenge = document.getElementById('mathsChallenge');
  if (mathsChallenge) mathsChallenge.style.display = 'none';
  const breakDurationConfirm = document.getElementById('breakDurationConfirm');
  if (breakDurationConfirm) breakDurationConfirm.style.display = 'none';
  isResetMode = false;
  cancelChallengeCommon();
}

// === RICKROLL CHALLENGE ===
let rickrollTimer = null;

function showRickrollChallenge(isReset = false) {
  // Harder for reset: 10 seconds instead of 5
  let timeLeft = isReset ? 10 : 5;
  const skipBtn = document.getElementById('skipRickrollBtn');
  
  if (!skipBtn) {
    console.error('❌ skipRickrollBtn element not found');
    return;
  }
  
  // Update UI
  skipBtn.textContent = `Continue in ${timeLeft}`;
  skipBtn.disabled = true;
  
  // Hide break buttons, show challenge
  const takeBreakBtn = document.getElementById('takeBreakBtn');
  if (takeBreakBtn) takeBreakBtn.style.display = 'none';
  const resetSection = document.querySelector('.reset-cooldown');
  if (resetSection) resetSection.style.display = 'none';
  const rickrollChallenge = document.getElementById('rickrollChallenge');
  if (rickrollChallenge) rickrollChallenge.style.display = 'block';
  
  // Start countdown
  rickrollTimer = setInterval(() => {
    timeLeft--;
    
    if (timeLeft > 0) {
      skipBtn.textContent = `Continue in ${timeLeft}`;
    } else {
      clearInterval(rickrollTimer);
      skipBtn.textContent = '⏭️ Continue';
      skipBtn.disabled = false;
    }
  }, 1000);
}

function skipRickroll() {
  clearInterval(rickrollTimer);
  const rickrollChallenge = document.getElementById('rickrollChallenge');
  if (rickrollChallenge) rickrollChallenge.style.display = 'none';
  
  if (challengeType === 'reset') {
    // Reset cooldown
    chrome.runtime.sendMessage({ action: 'resetCooldown' }).then(async (response) => {
      if (response && response.success) {
        await handleCooldownResetSuccess();
      } else {
        console.error('❌ Failed to reset cooldown:', response);
      }
    }).catch((error) => {
      console.error('❌ Error resetting cooldown:', error);
    });
  } else {
    // Proceed to duration selection
    showDurationConfirmation();
  }
}

function cancelRickrollChallenge() {
  clearInterval(rickrollTimer);
  const rickrollChallenge = document.getElementById('rickrollChallenge');
  if (rickrollChallenge) rickrollChallenge.style.display = 'none';
  const breakDurationConfirm = document.getElementById('breakDurationConfirm');
  if (breakDurationConfirm) breakDurationConfirm.style.display = 'none';
  cancelChallengeCommon();
}

// End break
async function endBreak() {
  try {
  const response = await chrome.runtime.sendMessage({ action: 'endBreak' });
    if (response && response.success) {
    await loadState();
    } else {
      console.error('❌ Failed to end break:', response);
    }
  } catch (error) {
    console.error('❌ Error ending break:', error);
  }
}

// Add goal
async function addGoal() {
  const input = document.getElementById('newGoalInput');
  const text = input.value.trim();
  
  if (!text) return;
  
  try {
  const response = await chrome.runtime.sendMessage({ 
    action: 'addGoal', 
    goalText: text 
  });
  
    if (response && response.success) {
    input.value = '';
    await loadState();
    } else {
      console.error('❌ Failed to add goal:', response);
    }
  } catch (error) {
    console.error('❌ Error adding goal:', error);
  }
}

// Toggle goal completion
async function toggleGoal(goalId) {
  try {
  const response = await chrome.runtime.sendMessage({ 
    action: 'toggleGoal', 
    goalId 
  });
  
    if (response && response.success) {
    await loadState();
    } else {
      console.error('❌ Failed to toggle goal:', response);
    }
  } catch (error) {
    console.error('❌ Error toggling goal:', error);
  }
}

// Remove goal
async function removeGoal(goalId) {
  try {
  const response = await chrome.runtime.sendMessage({ 
    action: 'removeGoal', 
    goalId 
  });
  
    if (response && response.success) {
    await loadState();
    } else {
      console.error('❌ Failed to remove goal:', response);
    }
  } catch (error) {
    console.error('❌ Error removing goal:', error);
  }
}

// Re-add previous goal
async function reAddPreviousGoal(goalId) {
  try {
  const response = await chrome.runtime.sendMessage({ 
    action: 're-addPreviousGoal', 
    goalId 
  });
  
    if (response && response.success) {
    await loadState();
    } else {
      console.error('❌ Failed to re-add previous goal:', response);
    }
  } catch (error) {
    console.error('❌ Error re-adding previous goal:', error);
  }
}

// Dismiss all previous goals
async function dismissPreviousGoals() {
  try {
  const response = await chrome.runtime.sendMessage({ 
    action: 'dismissPreviousGoals'
  });
  
    if (response && response.success) {
    await loadState();
    } else {
      console.error('❌ Failed to dismiss previous goals:', response);
    }
  } catch (error) {
    console.error('❌ Error dismissing previous goals:', error);
  }
}

// Add site
async function addSite() {
  const input = document.getElementById('newSiteInput');
  const categorySelect = document.getElementById('newSiteCategory');
  let site = input.value.trim().toLowerCase();
  
  if (!site) return;
  
  // Clean up input
  site = site.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  
  if (!site) {
    alert('Please enter a valid domain (e.g., reddit.com)');
    return;
  }
  
  let category = categorySelect ? categorySelect.value : 'Other';
  
  if (category === 'new') {
    const newCat = prompt('Enter new category name:');
    if (!newCat || !newCat.trim()) return; // Cancelled
    category = newCat.trim();
  }
  
  try {
    const response = await chrome.runtime.sendMessage({ 
      action: 'addBlockedSite', 
      pattern: site,
      category: category
    });
  
    if (response && response.success) {
      input.value = '';
      if (categorySelect) categorySelect.value = 'Other'; // Reset to default
      await loadState();
    } else {
      alert(response?.error || 'Failed to add site');
      console.error('❌ Failed to add blocked site:', response);
    }
  } catch (error) {
    console.error('❌ Error adding blocked site:', error);
    alert('Failed to add site');
  }
}

// Remove site
async function removeSite(index) {
  try {
  const response = await chrome.runtime.sendMessage({ 
    action: 'removeBlockedSite', 
    index 
  });
  
    if (response && response.success) {
    await loadState();
    } else {
      console.error('❌ Failed to remove blocked site:', response);
    }
  } catch (error) {
    console.error('❌ Error removing blocked site:', error);
  }
}

// Add whitelisted site
async function addWhitelistedSite() {
  const input = document.getElementById('newWhitelistInput');
  let site = input.value.trim().toLowerCase();
  
  if (!site) return;
  
  // Clean up input
  site = site.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  
  if (!site) {
    alert('Please enter a valid domain (e.g., music.youtube.com)');
    return;
  }
  
  try {
  const response = await chrome.runtime.sendMessage({ 
    action: 'addWhitelistedSite', 
    pattern: site 
  });
  
    if (response && response.success) {
    input.value = '';
    await loadState();
  } else {
      alert(response?.error || 'Failed to add whitelisted site');
      console.error('❌ Failed to add whitelisted site:', response);
    }
  } catch (error) {
    console.error('❌ Error adding whitelisted site:', error);
    alert('Failed to add whitelisted site');
  }
}

// Remove whitelisted site
async function removeWhitelistedSite(index) {
  try {
  const response = await chrome.runtime.sendMessage({ 
    action: 'removeWhitelistedSite', 
    index 
  });
  
    if (response && response.success) {
    await loadState();
    } else {
      console.error('❌ Failed to remove whitelisted site:', response);
    }
  } catch (error) {
    console.error('❌ Error removing whitelisted site:', error);
  }
}

// Remove multiple whitelisted sites (for groups)
async function removeWhitelistedSiteGroup(indices) {
  // Sort indices in descending order to remove from end first
  // This prevents index shifting issues
  const sortedIndices = indices.sort((a, b) => b - a);
  
  try {
  for (const index of sortedIndices) {
      const response = await chrome.runtime.sendMessage({ 
      action: 'removeWhitelistedSite', 
      index 
    });
      if (!response || !response.success) {
        console.error('❌ Failed to remove whitelisted site at index', index, ':', response);
      }
  }
  
  await loadState();
  } catch (error) {
    console.error('❌ Error removing whitelisted site group:', error);
  }
}

// Update nogo list
function updateNoGoList() {
  console.log('🔥 Updating nogo list');
  const nogoListList = document.getElementById('nogoListList');
  
  if (!nogoListList) {
    console.error('❌ nogoListList element not found!');
    return;
  }
  
  if (!currentState.nogoList || currentState.nogoList.length === 0) {
    console.log('ℹ️ No nogo list sites to display');
    nogoListList.innerHTML = '<div class="empty-state">No sites in nogo list</div>';
    return;
  }
  
  console.log('✅ Displaying', currentState.nogoList.length, 'nogo list sites');
  
  // Normalize and deduplicate
  const normalizedSites = currentState.nogoList
    .map(site => normalizeDomain(site))
    .filter((site, idx, arr) => arr.indexOf(site) === idx);
  
  const sortedSites = [...normalizedSites].sort();
  const removalTimers = currentState.nogoListRemovalTimers || {};
  
  nogoListList.innerHTML = sortedSites.map(site => {
    const timer = removalTimers[site];
    const now = Date.now();
    
    if (timer && timer.endTime > now) {
      // Timer is active - show countdown
      const remainingMs = timer.endTime - now;
      const remainingMinutes = Math.floor(remainingMs / 60000);
      const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
      const timeText = remainingMinutes > 0 ? `${remainingMinutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
      return `
        <div class="item nogo-list-item">
          <span class="site-text">🔥 ${escapeHtml(site)}</span>
          <div class="nogo-list-actions">
            <span class="nogo-list-timer">⏳ ${timeText}</span>
            <button class="btn-confirm-remove" data-site="${site}" style="display:none;">Confirm Remove</button>
            <button class="btn-cancel-remove" data-site="${site}">Cancel</button>
          </div>
        </div>
      `;
    } else if (timer && timer.endTime <= now) {
      // Timer expired - show confirm button
      return `
        <div class="item nogo-list-item">
          <span class="site-text">🔥 ${escapeHtml(site)}</span>
          <div class="nogo-list-actions">
            <button class="btn-confirm-remove" data-site="${site}">Confirm Remove</button>
            <button class="btn-cancel-remove" data-site="${site}">Cancel</button>
          </div>
        </div>
      `;
    } else {
      // No timer - show start removal button
      return `
        <div class="item nogo-list-item">
          <span class="site-text">🔥 ${escapeHtml(site)}</span>
          <button class="btn-start-remove" data-site="${site}">Remove (15min)</button>
        </div>
      `;
    }
  }).join('');
  
  // Add click handlers
  document.querySelectorAll('.btn-start-remove').forEach(btn => {
    if (!btn || !btn.dataset) return;
    btn.addEventListener('click', async () => {
      if (!btn || !btn.dataset) return;
      const site = btn.dataset.site;
      if (site) {
        await startRemoveNoGoListSite(site);
      }
    });
  });
  
  document.querySelectorAll('.btn-confirm-remove').forEach(btn => {
    if (!btn || !btn.dataset) return;
    btn.addEventListener('click', async () => {
      if (!btn || !btn.dataset) return;
      const site = btn.dataset.site;
      if (site) {
        await confirmRemoveNoGoListSite(site);
      }
    });
  });
  
  document.querySelectorAll('.btn-cancel-remove').forEach(btn => {
    if (!btn || !btn.dataset) return;
    btn.addEventListener('click', async () => {
      if (!btn || !btn.dataset) return;
      const site = btn.dataset.site;
      if (site) {
        await cancelRemoveNoGoListSite(site);
      }
    });
  });
}

// Add site to nogo list
async function addNoGoListSite() {
  const input = document.getElementById('newNoGoListInput');
  const domain = normalizeDomain(input.value.trim());
  
  if (!domain) {
    alert('Please enter a domain');
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'addNoGoListSite',
      pattern: domain
    });
    
    if (response && response.success) {
      input.value = '';
      await loadState();
    } else {
      alert(response?.error || 'Failed to add site to nogo list');
      console.error('❌ Failed to add nogo list site:', response);
    }
  } catch (error) {
    console.error('❌ Error adding nogo list site:', error);
    alert('Failed to add site to nogo list');
  }
}

// Start removal timer (15 minutes)
async function startRemoveNoGoListSite(domain) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'startRemoveNoGoListSite',
      domain: domain
    });
    
    if (response && response.success) {
      await loadState();
    } else {
      alert(response?.error || 'Failed to start removal timer');
      console.error('❌ Failed to start nogo list removal timer:', response);
    }
  } catch (error) {
    console.error('❌ Error starting nogo list removal timer:', error);
    alert('Failed to start removal timer');
  }
}

// Confirm removal after timer expires
async function confirmRemoveNoGoListSite(domain) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'confirmRemoveNoGoListSite',
      domain: domain
    });
    
    if (response && response.success) {
      await loadState();
      alert(`✅ ${domain} removed from nogo list and added to blacklist`);
    } else {
      alert(response?.error || 'Failed to remove site');
      console.error('❌ Failed to confirm nogo list removal:', response);
    }
  } catch (error) {
    console.error('❌ Error confirming nogo list removal:', error);
    alert('Failed to remove site');
  }
}

// Cancel removal timer
async function cancelRemoveNoGoListSite(domain) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'cancelRemoveNoGoListSite',
      domain: domain
    });
    
    if (response && response.success) {
      await loadState();
    } else {
      alert(response?.error || 'Failed to cancel removal timer');
      console.error('❌ Failed to cancel nogo list removal timer:', response);
    }
  } catch (error) {
    console.error('❌ Error canceling nogo list removal timer:', error);
    alert('Failed to cancel removal timer');
  }
}

// Save settings
async function saveSettings() {
  const breakDurationEl = document.getElementById('breakDuration');
  const cooldownDurationEl = document.getElementById('cooldownDuration');
  const challengeTypeEl = document.getElementById('challengeType');
  
  if (!breakDurationEl || !cooldownDurationEl || !challengeTypeEl) {
    console.error('❌ Missing settings elements');
    return;
  }
  
  const breakDuration = parseInt(breakDurationEl.value, 10);
  const cooldownDuration = parseInt(cooldownDurationEl.value, 10);
  const challengeType = challengeTypeEl.value;
  
  // Validate parsed values
  if (isNaN(breakDuration) || isNaN(cooldownDuration)) {
    alert('Please enter valid numbers for durations');
    return;
  }
  
  if (breakDuration < 1 || cooldownDuration < 1) {
    alert('Durations must be at least 1 minute');
    return;
  }
  
  // Only get vocabLanguage if challenge type is vocabulary
  let vocabLanguage = currentState?.vocabLanguage || 'en_fr';
  console.log('[LANG-DEBUG] Step 2.1: Initial vocabLanguage from state:', vocabLanguage);
  console.log('[LANG-DEBUG] Step 2.2: Challenge type:', challengeType);
  if (challengeType === 'vocabulary') {
    const vocabLanguageEl = document.getElementById('vocabLanguage');
    console.log('[LANG-DEBUG] Step 2.3: vocabLanguageEl found:', !!vocabLanguageEl);
    if (vocabLanguageEl && vocabLanguageEl.value) {
      vocabLanguage = vocabLanguageEl.value;
      console.log('[LANG-DEBUG] Step 2.4: Updated vocabLanguage from dropdown:', vocabLanguage);
    } else {
      console.log('[LANG-DEBUG] Step 2.4: vocabLanguageEl missing or empty, keeping:', vocabLanguage);
    }
  } else {
    console.log('[LANG-DEBUG] Step 2.3: Challenge type is not vocabulary, keeping state value:', vocabLanguage);
  }
  
  // Get redirect type from radio buttons
  let redirectType = 'gif'; // default
  const redirectDonationEl = document.getElementById('redirectDonation');
  if (redirectDonationEl && redirectDonationEl.checked) {
    redirectType = 'donation';
  }
  
  try {
    console.log('[LANG-DEBUG] Step 2.5: Sending updateSettings message with vocabLanguage:', vocabLanguage);
    console.log('[LANG-DEBUG] Step 2.5.1: Message payload:', {
      action: 'updateSettings',
      breakDuration,
      cooldownDuration,
      challengeType,
      vocabLanguage,
      redirectType
    });
    
    // ERROR CHECK POINT 1: Before sending message
    if (chrome.runtime.lastError) {
      console.error('[ERROR-001] ❌ chrome.runtime.lastError exists BEFORE sendMessage:', chrome.runtime.lastError);
      alert('ERROR-001: Extension error before sending message. Please try again.');
      return;
    }
    
    console.log('[LANG-DEBUG] Step 2.5.2: About to call chrome.runtime.sendMessage...');
    console.log('[LANG-DEBUG] Step 2.5.2.1: chrome.runtime exists?', typeof chrome.runtime !== 'undefined');
    console.log('[LANG-DEBUG] Step 2.5.2.2: chrome.runtime.sendMessage exists?', typeof chrome.runtime.sendMessage === 'function');
    console.log('[LANG-DEBUG] Step 2.5.2.3: chrome.runtime.id:', chrome.runtime.id);
    console.log('[LANG-DEBUG] Step 2.5.2.4: chrome.runtime.lastError before send:', chrome.runtime.lastError);
    
    const sendMessageStartTime = Date.now();
    console.log('[LANG-DEBUG] Step 2.5.2.5: Timestamp before sendMessage:', sendMessageStartTime);
    
    // Create a promise wrapper to track the exact moment response is received
    let responseReceived = false;
    let responseValue = undefined;
    let responseReceivedTime = null;
    
    const messagePromise = chrome.runtime.sendMessage({ 
      action: 'updateSettings', 
      breakDuration,
      cooldownDuration,
      challengeType,
      vocabLanguage,
      redirectType
    });
    
    console.log('[LANG-DEBUG] Step 2.5.2.6: sendMessage promise created, type:', typeof messagePromise);
    console.log('[LANG-DEBUG] Step 2.5.2.7: messagePromise is Promise?', messagePromise instanceof Promise);
    
    // Add a then handler to track when response arrives
    messagePromise.then((res) => {
      responseReceived = true;
      responseValue = res;
      responseReceivedTime = Date.now();
      console.log('[LANG-DEBUG] Step 2.5.2.8: Promise.then() callback fired!');
      console.log('[LANG-DEBUG] Step 2.5.2.9: Response received in then():', res);
      console.log('[LANG-DEBUG] Step 2.5.2.10: Response type in then():', typeof res);
      console.log('[LANG-DEBUG] Step 2.5.2.11: Time to receive response:', responseReceivedTime - sendMessageStartTime, 'ms');
    }).catch((err) => {
      console.error('[LANG-DEBUG] Step 2.5.2.12: Promise.catch() fired with error:', err);
    });
    
    const response = await messagePromise;
    
    const sendMessageEndTime = Date.now();
    console.log('[LANG-DEBUG] Step 2.5.3: sendMessage await completed in', sendMessageEndTime - sendMessageStartTime, 'ms');
    console.log('[LANG-DEBUG] Step 2.5.3.1: responseReceived flag:', responseReceived);
    console.log('[LANG-DEBUG] Step 2.5.3.2: responseValue from then():', responseValue);
    console.log('[LANG-DEBUG] Step 2.5.3.3: response from await:', response);
    console.log('[LANG-DEBUG] Step 2.5.3.4: Are they equal?', response === responseValue);
    
    console.log('[LANG-DEBUG] Step 2.6: Await completed. Response:', response);
    console.log('[LANG-DEBUG] Step 2.6.1: Response type:', typeof response);
    console.log('[LANG-DEBUG] Step 2.6.2: Response is null?', response === null);
    console.log('[LANG-DEBUG] Step 2.6.3: Response is undefined?', response === undefined);
    console.log('[LANG-DEBUG] Step 2.6.4: Response stringified:', JSON.stringify(response));
    
    // ERROR CHECK POINT 2: After sendMessage, check for runtime errors
    const lastErrorAfter = chrome.runtime.lastError;
    if (lastErrorAfter) {
      console.error('[ERROR-002] ❌ chrome.runtime.lastError AFTER sendMessage:', lastErrorAfter);
      console.error('[ERROR-002] ❌ Error message:', lastErrorAfter.message);
      alert('ERROR-002: Extension error after sending message: ' + lastErrorAfter.message);
      return;
    }
    console.log('[LANG-DEBUG] Step 2.6.5: No chrome.runtime.lastError after sendMessage');
    
    // ERROR CHECK POINT 3: Response is null
    if (response === null) {
      console.error('[ERROR-003] ❌ Response is explicitly null');
      console.error('[ERROR-003] ❌ chrome.runtime.lastError:', chrome.runtime.lastError);
      alert('ERROR-003: No response from extension (null). The background script may not be responding.');
      return;
    }
    
    // ERROR CHECK POINT 4: Response is undefined
    if (response === undefined) {
      console.error('[ERROR-004] ❌ Response is undefined');
      console.error('[ERROR-004] ❌ chrome.runtime.lastError:', chrome.runtime.lastError);
      console.error('[ERROR-004] ❌ This usually means the message channel closed before response was sent');
      alert('ERROR-004: No response from extension (undefined). The message channel may have closed.');
      return;
    }
    
    // ERROR CHECK POINT 5: Response is falsy (but not null/undefined)
    if (!response) {
      console.error('[ERROR-005] ❌ Response is falsy:', response);
      console.error('[ERROR-005] ❌ Response type:', typeof response);
      console.error('[ERROR-005] ❌ chrome.runtime.lastError:', chrome.runtime.lastError);
      alert('ERROR-005: Invalid response from extension: ' + String(response));
      return;
    }
    
    // ERROR CHECK POINT 6: Response is not an object
    if (typeof response !== 'object') {
      console.error('[ERROR-006] ❌ Response is not an object:', typeof response, response);
      alert('ERROR-006: Invalid response format. Expected object, got: ' + typeof response);
      return;
    }
    
    // ERROR CHECK POINT 7: Response doesn't have success property
    if (!('success' in response)) {
      console.error('[ERROR-007] ❌ Response missing "success" property');
      console.error('[ERROR-007] ❌ Response keys:', Object.keys(response));
      console.error('[ERROR-007] ❌ Full response:', response);
      alert('ERROR-007: Invalid response format. Missing "success" property.');
      return;
    }
    
    // ERROR CHECK POINT 8: Response.success is false
    if (response.success === false) {
      console.error('[ERROR-008] ❌ Response.success is false');
      console.error('[ERROR-008] ❌ Response.error:', response.error);
      console.error('[ERROR-008] ❌ Full response:', response);
      alert('ERROR-008: Failed to save settings: ' + (response.error || 'Unknown error'));
      return;
    }
    
    // ERROR CHECK POINT 9: Response.success is not true (edge case)
    if (response.success !== true) {
      console.error('[ERROR-009] ❌ Response.success is not true:', response.success);
      console.error('[ERROR-009] ❌ Response type:', typeof response.success);
      console.error('[ERROR-009] ❌ Full response:', response);
      alert('ERROR-009: Unexpected response.success value: ' + String(response.success));
      return;
    }
    
    // SUCCESS PATH
    console.log('[LANG-DEBUG] Step 2.7: Settings saved successfully, calling loadState()...');
    console.log('[LANG-DEBUG] Step 2.7.1: Response validated successfully:', response);
    
    // Settings auto-saved, no alert needed
    await loadState();
    console.log('[LANG-DEBUG] Step 2.8: loadState() completed');
    console.log('[LANG-DEBUG] ✅ SUCCESS: All settings saved and state reloaded');
    
  } catch (error) {
    // ERROR CHECK POINT 10: Exception thrown during sendMessage or processing
    console.error('[ERROR-010] ❌ Exception caught in saveSettings:', error);
    console.error('[ERROR-010] ❌ Error name:', error.name);
    console.error('[ERROR-010] ❌ Error message:', error.message);
    console.error('[ERROR-010] ❌ Error stack:', error.stack);
    console.error('[ERROR-010] ❌ chrome.runtime.lastError:', chrome.runtime.lastError);
    alert('ERROR-010: Exception while saving settings: ' + error.message);
  }
}

// Utility: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

// Helper: Show duration confirmation dialog
function showDurationConfirmation() {
  const breakDurationConfirm = document.getElementById('breakDurationConfirm');
  if (breakDurationConfirm) breakDurationConfirm.style.display = 'block';
  const breakDurationSelector = document.getElementById('breakDurationSelector');
  if (breakDurationSelector) breakDurationSelector.value = currentState.breakDuration;
  
  // Initialize category list
  updateBreakCategoryList();
}

// Helper: Reset challenge state
function resetChallengeState() {
  challengeType = null;
  specialBreakDuration = null;
  requiredWordCount = 10;
  currentVocabWords = [];
  revealedCount = 0;
}

// Helper: Cancel challenge (common cleanup)
function cancelChallengeCommon() {
  // Only reset flag if this was for starting a break (not resetting cooldown)
  if (challengeType !== 'reset') {
    isStartingBreak = false;
  }
  const takeBreakBtn = document.getElementById('takeBreakBtn');
  if (takeBreakBtn) takeBreakBtn.style.display = 'block';
  const resetLink = document.getElementById('resetCooldownLink');
  if (resetLink) resetLink.style.display = 'inline';
  const resetForm = document.getElementById('resetCooldownForm');
  if (resetForm && challengeType === 'reset') {
    resetForm.style.display = 'flex';
  }
  resetChallengeState();
  loadState();
}

// Helper: Handle successful cooldown reset
async function handleCooldownResetSuccess() {
  const resetLink = document.getElementById('resetCooldownLink');
  if (resetLink) resetLink.style.display = 'inline';
  alert('✅ Cooldown reset! You can now take a break immediately.');
  challengeType = null;
  isResetMode = false;
  await loadState();
}

// Event listeners
const takeBreakBtn = document.getElementById('takeBreakBtn');
if (takeBreakBtn) {
  takeBreakBtn.addEventListener('click', async () => {
    try {
      await takeBreak();
    } catch (error) {
      console.error('❌ Error taking break:', error);
    }
  });
}
const endBreakBtn = document.getElementById('endBreakBtn');
if (endBreakBtn) {
  endBreakBtn.addEventListener('click', () => {
    try {
      endBreak();
    } catch (error) {
      console.error('❌ Error ending break:', error);
    }
  });
}

// Show snooze vocabulary challenge (light: 5 words)
function showSnoozeVocabChallenge() {
  const vocabCount = 5;
  
  // Get current language code
  const langCode = currentState.vocabLanguage || 'en_fr';
  
  // Filter out words that are similar (similar=true)
  const vocab = [...currentState.vocabulary].filter(item => !item.similar);
  
  // Check if we have enough words after filtering
  if (!vocab || vocab.length < vocabCount) {
    alert(`⚠️ Need at least ${vocabCount} vocabulary words (excluding similar words)!`);
    isInSnoozeChallenge = false;
    // Don't call updateSnoozeTitle here as it might interfere
    return;
  }
  
  // Pick random words
  const shuffled = vocab.sort(() => Math.random() - 0.5);
  const selectedWords = shuffled.slice(0, vocabCount);
  
  // Check if language has transcriptions (AR, JP, KR, UK)
  const hasTranscription = ['en_ar', 'en_ja', 'en_ko', 'en_uk'].includes(langCode);
  
  // For each word, randomly decide whether to show word or translation first
  snoozeChallengeWords = selectedWords.map(item => {
    const showWordFirst = Math.random() < 0.5;
    let displayedText = showWordFirst ? item.word : item.translation;
    let hiddenText = showWordFirst ? item.translation : item.word;
    
    // Store transcription separately
    const transcription = item.transcription || '';
    
    // Remove transcription from translation if it's already there (from old format)
    if (hiddenText.includes('(') && hiddenText.includes(')')) {
      const match = hiddenText.match(/^(.+?)\s*\((.+?)\)$/);
      if (match) {
        hiddenText = match[1].trim();
      }
    }
    // Also check displayed text
    if (displayedText.includes('(') && displayedText.includes(')')) {
      const match = displayedText.match(/^(.+?)\s*\((.+?)\)$/);
      if (match) {
        displayedText = match[1].trim();
      }
    }
    
    const displayedFlag = getLanguageFlag(langCode, showWordFirst);
    
    // Use originalWord if available (for English words with articles), otherwise use word
    const originalWordForRemoval = item.originalWord || item.word;
    
    return {
      displayed: displayedText,
      displayedWithFlag: `${displayedFlag} ${displayedText}`,
      hidden: hiddenText,
      transcription: transcription,
      showWordFirst: showWordFirst,
      originalWord: originalWordForRemoval, // Store original word for removal (without article)
      originalTranslation: item.translation // Store original translation for removal
    };
  });
  
  snoozeVocabRevealedCount = 0;
  
  // Render words list
  const wordsList = document.getElementById('snoozeVocabWordsList');
  if (wordsList) {
    // For snooze, we'll always show transcriptions if available (no checkbox for simplicity)
    const showTranscription = hasTranscription;
    
    wordsList.innerHTML = snoozeChallengeWords.map((word, index) => {
      // For languages with transcriptions, add it next to the non-Latin script word
      let displayedText = word.displayed;
      let hiddenText = word.hidden;
      let displayedWithFlag = word.displayedWithFlag;
      
      if (word.transcription && showTranscription && hasTranscription) {
        // Add transcription next to the non-Latin script word (translation)
        if (word.showWordFirst) {
          // English is displayed, translation (non-Latin) is hidden
          hiddenText = `${word.hidden} (${word.transcription})`;
        } else {
          // Translation (non-Latin) is displayed, English is hidden
          displayedText = `${word.displayed} (${word.transcription})`;
          displayedWithFlag = `${getLanguageFlag(langCode, false)} ${displayedText}`;
        }
      }
      
      // Create tooltip with full text (both displayed and hidden)
      const fullText = `${displayedText} → ${hiddenText}`;
      return `
      <div class="vocab-challenge-item" data-index="${index}" title="${escapeHtml(fullText)}">
        <div class="vocab-word-content">
          <div class="vocab-word-text">${escapeHtml(displayedWithFlag)}</div>
          <div class="vocab-translation">→ ${escapeHtml(hiddenText)}</div>
        </div>
        <button class="vocab-remove-btn" data-index="${index}" data-snooze="true" style="display:none;" title="Remove from the learning list">×</button>
        <button class="vocab-undo-btn" data-index="${index}" data-snooze="true" style="display:none;" title="Bring it back to the list">♻️</button>
        <div class="vocab-feedback-message" data-index="${index}" style="display:none;"></div>
      </div>
      `;
    }).join('');
    
    // Add click handlers
    document.querySelectorAll('#snoozeVocabWordsList .vocab-challenge-item').forEach(item => {
      if (!item) return;
      item.addEventListener('click', (e) => {
        if (!e || !e.target) return;
        // Don't reveal if clicking the remove button
        if (e.target.classList && e.target.classList.contains('vocab-remove-btn')) {
          return;
        }
        revealSnoozeVocabWord(item);
      });
    });
    
    // Add remove button handlers
    document.querySelectorAll('#snoozeVocabWordsList .vocab-remove-btn').forEach(btn => {
      if (!btn || !btn.dataset) return;
      btn.addEventListener('click', async (e) => {
        if (!btn || !btn.dataset) return;
        e.stopPropagation(); // Prevent revealing the word
        const index = parseInt(btn.dataset.index);
        if (!isNaN(index)) {
          await removeSnoozeVocabWord(index);
        }
      });
    });
    
    // Add undo button handlers
    document.querySelectorAll('#snoozeVocabWordsList .vocab-undo-btn').forEach(btn => {
      if (!btn || !btn.dataset) return;
      btn.addEventListener('click', async (e) => {
        if (!btn || !btn.dataset) return;
        e.stopPropagation(); // Prevent revealing the word
        const index = parseInt(btn.dataset.index);
        if (!isNaN(index)) {
          await undoRemoveSnoozeVocabWord(index);
        }
      });
    });
  }
  
  // Update UI
  updateSnoozeVocabProgress();
  const confirmBtn = document.getElementById('snoozeVocabConfirmBtn');
  if (confirmBtn) confirmBtn.disabled = true;
  
  // Show challenge
  const snoozeVocabChallenge = document.getElementById('snoozeVocabChallenge');
  if (snoozeVocabChallenge) snoozeVocabChallenge.style.display = 'block';
  const snoozeMathsChallenge = document.getElementById('snoozeMathsChallenge');
  if (snoozeMathsChallenge) snoozeMathsChallenge.style.display = 'none';
  const snoozeRickrollChallenge = document.getElementById('snoozeRickrollChallenge');
  if (snoozeRickrollChallenge) snoozeRickrollChallenge.style.display = 'none';
}

// Reveal a word in snooze vocab challenge
function revealSnoozeVocabWord(item) {
  if (item.classList.contains('revealed')) return;
  
  item.classList.add('revealed');
  snoozeVocabRevealedCount++;
  updateSnoozeVocabProgress();
  
  // Show remove button when word is revealed
  const removeBtn = item.querySelector('.vocab-remove-btn');
  if (removeBtn) {
    removeBtn.style.display = 'block';
    // Ensure title attribute is set for tooltip
    if (!removeBtn.getAttribute('title')) {
      removeBtn.setAttribute('title', 'Remove from the learning list');
    }
  }
  
  // Enable confirm button when all revealed
  if (snoozeVocabRevealedCount === 5) {
    const confirmBtn = document.getElementById('snoozeVocabConfirmBtn');
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

// Remove a vocabulary word from the dictionary (snooze challenge)
async function removeSnoozeVocabWord(index) {
  const wordData = snoozeChallengeWords[index];
  if (!wordData) return;
  
  // Store word data for potential undo (use a different key to avoid conflicts)
  const snoozeKey = `snooze_${index}`;
  removedVocabWords.set(snoozeKey, {
    word: wordData.originalWord,
    translation: wordData.originalTranslation,
    displayed: wordData.displayed,
    hidden: wordData.hidden
  });
  
  // Send message to background to remove the word
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'removeVocabularyWord',
      word: wordData.originalWord,
      translation: wordData.originalTranslation
    });
    
    if (response && response.success) {
      // Update UI to show removed state with undo button
      const item = document.querySelector(`#snoozeVocabWordsList .vocab-challenge-item[data-index="${index}"]`);
      if (item) {
        item.style.opacity = '0.5';
        item.style.textDecoration = 'line-through';
        const removeBtn = item.querySelector('.vocab-remove-btn');
        const undoBtn = item.querySelector('.vocab-undo-btn');
        const feedbackMsg = item.querySelector('.vocab-feedback-message');
        if (removeBtn) {
          removeBtn.style.display = 'none';
        }
        if (undoBtn) {
          undoBtn.style.display = 'block';
          // Ensure title attribute is set for tooltip
          if (!undoBtn.getAttribute('title')) {
            undoBtn.setAttribute('title', 'Bring it back to the list');
          }
        }
        // Show feedback message (stays until challenge ends)
        if (feedbackMsg) {
          feedbackMsg.textContent = 'You won\'t learn it anymore';
          feedbackMsg.style.display = 'block';
        }
        // Keep item clickable for undo
      }
      
      // Reload state to get updated vocabulary
      await loadState();
    } else {
      console.error('❌ Failed to remove snooze vocabulary word:', response);
    }
  } catch (error) {
    console.error('❌ Error removing snooze vocabulary word:', error);
  }
}

// Undo removal of a vocabulary word (snooze challenge)
async function undoRemoveSnoozeVocabWord(index) {
  const snoozeKey = `snooze_${index}`;
  const removedData = removedVocabWords.get(snoozeKey);
  if (!removedData) return;
  
  // Send message to background to add the word back
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'addVocabularyWord',
      word: removedData.word,
      translation: removedData.translation
    });
    
    if (response && response.success) {
      // Remove from undo tracking
      removedVocabWords.delete(snoozeKey);
      
      // Update UI to restore word
      const item = document.querySelector(`#snoozeVocabWordsList .vocab-challenge-item[data-index="${index}"]`);
      if (item) {
        item.style.opacity = '1';
        item.style.textDecoration = 'none';
        const removeBtn = item.querySelector('.vocab-remove-btn');
        const undoBtn = item.querySelector('.vocab-undo-btn');
        const feedbackMsg = item.querySelector('.vocab-feedback-message');
        if (removeBtn) {
          removeBtn.style.display = 'block';
        }
        if (undoBtn) {
          undoBtn.style.display = 'none';
          // Ensure title attribute is set for tooltip
          if (!undoBtn.getAttribute('title')) {
            undoBtn.setAttribute('title', 'Bring it back to the list');
          }
        }
        // Show feedback message (fades out after 3 seconds)
        if (feedbackMsg) {
          feedbackMsg.textContent = 'Brought back to the list';
          feedbackMsg.style.display = 'block';
          // Hide message after 3 seconds
          setTimeout(() => {
            if (feedbackMsg) {
              feedbackMsg.style.display = 'none';
            }
          }, 3000);
        }
      }
      
      // Reload state to get updated vocabulary
      await loadState();
    } else {
      console.error('❌ Failed to add snooze vocabulary word back:', response);
    }
  } catch (error) {
    console.error('❌ Error adding snooze vocabulary word back:', error);
  }
}

// Update snooze vocab progress
function updateSnoozeVocabProgress() {
  const progressEl = document.getElementById('snoozeVocabProgress');
  if (progressEl) {
    progressEl.textContent = `${snoozeVocabRevealedCount}/5 revealed`;
  }
}

// Show snooze math challenge (light: 2-5 × 6-9)
function showSnoozeMathsChallenge() {
  const num1 = Math.floor(Math.random() * 4) + 2; // 2-5
  const num2 = Math.floor(Math.random() * 4) + 6; // 6-9
  snoozeMathsAnswer = num1 * num2;
  
  const questionEl = document.getElementById('snoozeMathsQuestion');
  if (questionEl) {
    questionEl.textContent = `What is ${num1} × ${num2}?`;
  }
  
  const answerEl = document.getElementById('snoozeMathsAnswer');
  if (answerEl) {
    answerEl.value = '';
    setTimeout(() => answerEl.focus(), 100);
  }
  
  const attemptInfoEl = document.getElementById('snoozeMathsAttemptInfo');
  if (attemptInfoEl) {
    attemptInfoEl.textContent = '';
    attemptInfoEl.style.color = '#666';
  }
  
  // Show challenge
  const snoozeVocabChallenge = document.getElementById('snoozeVocabChallenge');
  if (snoozeVocabChallenge) snoozeVocabChallenge.style.display = 'none';
  const snoozeMathsChallenge = document.getElementById('snoozeMathsChallenge');
  if (snoozeMathsChallenge) snoozeMathsChallenge.style.display = 'block';
  const snoozeRickrollChallenge = document.getElementById('snoozeRickrollChallenge');
  if (snoozeRickrollChallenge) snoozeRickrollChallenge.style.display = 'none';
}

// Show snooze rickroll challenge (light: 3 seconds)
function showSnoozeRickrollChallenge() {
  let timeLeft = 3;
  const skipBtn = document.getElementById('snoozeRickrollSkipBtn');
  
  if (skipBtn) {
    skipBtn.textContent = `Continue in ${timeLeft}`;
    skipBtn.disabled = true;
  }
  
  // Show challenge
  const snoozeVocabChallenge = document.getElementById('snoozeVocabChallenge');
  if (snoozeVocabChallenge) snoozeVocabChallenge.style.display = 'none';
  const snoozeMathsChallenge = document.getElementById('snoozeMathsChallenge');
  if (snoozeMathsChallenge) snoozeMathsChallenge.style.display = 'none';
  const snoozeRickrollChallenge = document.getElementById('snoozeRickrollChallenge');
  if (snoozeRickrollChallenge) snoozeRickrollChallenge.style.display = 'block';
  
  // Start countdown
  snoozeRickrollTimer = setInterval(() => {
    timeLeft--;
    
    if (timeLeft > 0 && skipBtn) {
      skipBtn.textContent = `Continue in ${timeLeft}`;
    } else {
      clearInterval(snoozeRickrollTimer);
      if (skipBtn) {
        skipBtn.textContent = '⏭️ Continue';
        skipBtn.disabled = false;
      }
    }
  }, 1000);
}

// Complete snooze challenge and show buttons
function completeSnoozeChallenge() {
  isInSnoozeChallenge = false;
  // Mark that we've completed the challenge for the current snooze count
  lastCompletedSnoozeCount = currentState?.snoozeCount || 0;
  const challengeContainer = document.getElementById('snoozeChallengeContainer');
  const buttonsContainer = document.getElementById('snoozeButtonsContainer');
  
  if (challengeContainer) challengeContainer.style.display = 'none';
  if (buttonsContainer) buttonsContainer.style.display = 'block';
  
  // Clear any timers
  if (snoozeRickrollTimer) {
    clearInterval(snoozeRickrollTimer);
    snoozeRickrollTimer = null;
  }
}

// Setup snooze challenge event listeners
function setupSnoozeChallengeListeners() {
  const challengeBarBtn = document.getElementById('snoozeChallengeBarBtn');
  const vocabConfirmBtn = document.getElementById('snoozeVocabConfirmBtn');
  const mathsSubmitBtn = document.getElementById('snoozeMathsSubmitBtn');
  const mathsAnswerInput = document.getElementById('snoozeMathsAnswer');
  const rickrollSkipBtn = document.getElementById('snoozeRickrollSkipBtn');
  
  if (challengeBarBtn) {
    challengeBarBtn.addEventListener('click', () => {
      const snoozeCount = currentState?.snoozeCount || 0;
      // Button appears when next extension will be even (snoozeCount is odd: 1, 3, 5...)
      if (snoozeCount % 2 === 1) {
        // Show light challenge based on challenge type
        isInSnoozeChallenge = true;
        const challengeMode = currentState?.challengeType || 'vocabulary';
        const challengeBar = document.getElementById('snoozeChallengeBar');
        const challengeContainer = document.getElementById('snoozeChallengeContainer');
        
        if (challengeBar) challengeBar.style.display = 'none';
        if (challengeContainer) challengeContainer.style.display = 'block';
        
        if (challengeMode === 'vocabulary') {
          showSnoozeVocabChallenge();
        } else if (challengeMode === 'maths') {
          showSnoozeMathsChallenge();
        } else if (challengeMode === 'rickroll') {
          showSnoozeRickrollChallenge();
        }
      }
    });
  }
  
  if (vocabConfirmBtn) {
    vocabConfirmBtn.addEventListener('click', () => {
      if (snoozeVocabRevealedCount === 5) {
        completeSnoozeChallenge();
      }
    });
  }
  
  if (mathsSubmitBtn) {
    mathsSubmitBtn.addEventListener('click', () => {
      const userAnswer = parseInt(document.getElementById('snoozeMathsAnswer')?.value);
      const attemptInfoEl = document.getElementById('snoozeMathsAttemptInfo');
      
      if (userAnswer === snoozeMathsAnswer) {
        // Correct!
        completeSnoozeChallenge();
      } else {
        // Wrong, but proceed anyway (light friction)
        if (attemptInfoEl) {
          attemptInfoEl.textContent = `The answer was ${snoozeMathsAnswer}. Proceeding anyway! 😊`;
          attemptInfoEl.style.color = '#ff0000';
        }
        setTimeout(() => {
          completeSnoozeChallenge();
        }, 1000);
      }
    });
  }
  
  if (mathsAnswerInput) {
    mathsAnswerInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('snoozeMathsSubmitBtn')?.click();
      }
    });
  }
  
  if (rickrollSkipBtn) {
    rickrollSkipBtn.addEventListener('click', () => {
      if (snoozeRickrollTimer) {
        clearInterval(snoozeRickrollTimer);
        snoozeRickrollTimer = null;
      }
      completeSnoozeChallenge();
    });
  }
}

// Snooze buttons
document.querySelectorAll('.btn-snooze-header').forEach(btn => {
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!btn || !btn.dataset) return;
    const duration = parseInt(btn.dataset.snooze);
    if (isNaN(duration)) {
      console.error('❌ Invalid snooze duration');
      return;
    }
    try {
    const response = await chrome.runtime.sendMessage({ 
      action: 'snoozeBreak', 
      duration 
    });
      if (response && response.success) {
        isInSnoozeChallenge = false; // Reset challenge state
        // Reset completed snooze count when we actually extend (snooze count will increment)
        lastCompletedSnoozeCount = -1;
      await loadState();
      } else {
        console.error('❌ Failed to snooze break:', response);
      }
    } catch (error) {
      console.error('❌ Error snoozing break:', error);
    }
  });
});

// Select All Categories button
const selectAllCategoriesBtn = document.getElementById('selectAllCategoriesBtn');
if (selectAllCategoriesBtn) {
  selectAllCategoriesBtn.addEventListener('click', () => {
    try {
      toggleSelectAllCategories();
    } catch (error) {
      console.error('❌ Error toggling select all categories:', error);
    }
  });
}

// Helper: Update break category list (checkboxes)
function updateBreakCategoryList() {
  const container = document.getElementById('breakCategoryList');
  if (!container) return;
  
  // Clear existing
  container.innerHTML = '';
  
  // Get categories and counts
  const categories = {};
  const siteCategories = currentState.siteCategories || {};
  const blockedSites = currentState.blockedSites || [];
  
  // Filter out duplicates
  const uniqueSites = [...new Set(blockedSites.map(site => normalizeDomain(site)))];
  
  uniqueSites.forEach(site => {
    const cat = siteCategories[site] || 'Other';
    if (!categories[cat]) categories[cat] = 0;
    categories[cat]++;
  });
  
  const sortedCats = Object.keys(categories).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });
  
  if (sortedCats.length === 0) {
    container.innerHTML = '<div style="padding:10px; text-align:center; color:#666;">No categories found</div>';
    return;
  }
  
  sortedCats.forEach(cat => {
    const count = categories[cat];
    const label = document.createElement('label');
    label.className = 'category-checkbox-label';
    label.innerHTML = `
      <input type="checkbox" value="${escapeHtml(cat)}" class="break-category-checkbox" />
      <span>${escapeHtml(cat)} (${count} sites)</span>
    `;
    container.appendChild(label);
  });
  
  // Update "Select All" button text
  const btn = document.getElementById('selectAllCategoriesBtn');
  if (btn) {
    btn.textContent = 'Select All Categories';
  }
}

// Helper: Toggle select all categories
function toggleSelectAllCategories() {
  const checkboxes = document.querySelectorAll('.break-category-checkbox');
  if (checkboxes.length === 0) return;
  
  // Check if all are currently checked
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  
  // Toggle: if all checked, uncheck all. Otherwise, check all.
  const newState = !allChecked;
  
  checkboxes.forEach(cb => {
    cb.checked = newState;
  });
  
  // Update button text
  const btn = document.getElementById('selectAllCategoriesBtn');
  if (btn) {
    btn.textContent = newState ? 'Unselect All Categories' : 'Select All Categories';
  }
}

const addCategoryToBreakWhitelist = document.getElementById('addCategoryToBreakWhitelist');
if (addCategoryToBreakWhitelist) {
  addCategoryToBreakWhitelist.addEventListener('change', async function() {
    const category = this.value;
    if (!category) return;
    
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'addCategoryToBreakWhitelist', 
        category: category 
      });
      
      if (response && response.success) {
        // Reset selection
        this.value = '';
        await loadState();
      } else {
        console.error('❌ Failed to add category to break whitelist:', response);
      }
    } catch (error) {
      console.error('❌ Error adding category to break whitelist:', error);
    }
  });
}

const removeCategoryFromBreakWhitelist = document.getElementById('removeCategoryFromBreakWhitelist');
if (removeCategoryFromBreakWhitelist) {
  removeCategoryFromBreakWhitelist.addEventListener('change', async function() {
    const category = this.value;
    if (!category) return;
    
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'removeCategoryFromBreakWhitelist', 
        category: category 
      });
      
      if (response && response.success) {
        // Reset selection
        this.value = '';
        await loadState();
      } else {
        console.error('❌ Failed to remove category from break whitelist:', response);
      }
    } catch (error) {
      console.error('❌ Error removing category from break whitelist:', error);
    }
  });
}


// Duration confirmation
const confirmDurationBtn = document.getElementById('confirmDurationBtn');
if (confirmDurationBtn) {
  confirmDurationBtn.addEventListener('click', () => {
    try {
      confirmDuration();
    } catch (error) {
      console.error('❌ Error confirming duration:', error);
    }
  });
}
const cancelDurationBtn = document.getElementById('cancelDurationBtn');
if (cancelDurationBtn) {
  cancelDurationBtn.addEventListener('click', () => {
    try {
      cancelDuration();
    } catch (error) {
      console.error('❌ Error cancelling duration:', error);
    }
  });
}

// Vocabulary challenge
const confirmBreakBtn = document.getElementById('confirmBreakBtn');
if (confirmBreakBtn) {
  confirmBreakBtn.addEventListener('click', () => {
    try {
      confirmBreak();
    } catch (error) {
      console.error('❌ Error confirming break:', error);
    }
  });
}
const cancelVocabBtn = document.getElementById('cancelVocabBtn');
if (cancelVocabBtn) {
  cancelVocabBtn.addEventListener('click', () => {
    try {
      cancelVocabChallenge();
    } catch (error) {
      console.error('❌ Error cancelling vocab challenge:', error);
    }
  });
}

// Maths challenge event listeners
const submitMathsBtn = document.getElementById('submitMathsBtn');
if (submitMathsBtn) {
  submitMathsBtn.addEventListener('click', () => {
    try {
    submitMathsAnswer();
    } catch (error) {
      console.error('❌ Error submitting maths answer:', error);
    }
  });
}
const cancelMathsBtn = document.getElementById('cancelMathsBtn');
if (cancelMathsBtn) {
  cancelMathsBtn.addEventListener('click', () => {
    try {
      cancelMathsChallenge();
    } catch (error) {
      console.error('❌ Error cancelling maths challenge:', error);
    }
  });
}
const mathsAnswerEl = document.getElementById('mathsAnswer');
if (mathsAnswerEl) {
  mathsAnswerEl.addEventListener('keypress', (e) => {
    try {
      if (e && e.key === 'Enter') {
        submitMathsAnswer();
      }
    } catch (error) {
      console.error('❌ Error submitting maths answer:', error);
    }
  });
}

// Rickroll challenge event listeners
const skipRickrollBtn = document.getElementById('skipRickrollBtn');
if (skipRickrollBtn) {
  skipRickrollBtn.addEventListener('click', () => {
    try {
      skipRickroll();
    } catch (error) {
      console.error('❌ Error skipping rickroll:', error);
    }
  });
}
const cancelRickrollBtn = document.getElementById('cancelRickrollBtn');
if (cancelRickrollBtn) {
  cancelRickrollBtn.addEventListener('click', () => {
    try {
      cancelRickrollChallenge();
    } catch (error) {
      console.error('❌ Error cancelling rickroll challenge:', error);
    }
  });
}

// Reset cooldown
const resetCooldownLink = document.getElementById('resetCooldownLink');
if (resetCooldownLink) {
  resetCooldownLink.addEventListener('click', (e) => {
    try {
      if (e) e.preventDefault();
      if (resetCooldownLink) resetCooldownLink.style.display = 'none';
      const form = document.getElementById('resetCooldownForm');
      if (form) form.style.display = 'flex';
    } catch (error) {
      console.error('❌ Error showing reset cooldown form:', error);
    }
  });
}

const cancelResetBtn = document.getElementById('cancelResetBtn');
if (cancelResetBtn) {
  cancelResetBtn.addEventListener('click', (e) => {
    try {
      if (e) e.preventDefault();
      const form = document.getElementById('resetCooldownForm');
      if (form) form.style.display = 'none';
      const link = document.getElementById('resetCooldownLink');
      if (link) link.style.display = 'inline';
    } catch (error) {
      console.error('❌ Error cancelling reset cooldown:', error);
    }
  });
}

const resetCooldownBtn = document.getElementById('resetCooldownBtn');
if (resetCooldownBtn) {
  resetCooldownBtn.addEventListener('click', async () => {
    try {
      await resetCooldown();
    } catch (error) {
      console.error('❌ Error resetting cooldown:', error);
    }
  });
}

// Goals
const addGoalBtn = document.getElementById('addGoalBtn');
if (addGoalBtn) {
  addGoalBtn.addEventListener('click', () => {
    try {
      addGoal();
    } catch (error) {
      console.error('❌ Error adding goal:', error);
    }
  });
}
const newGoalInput = document.getElementById('newGoalInput');
if (newGoalInput) {
  newGoalInput.addEventListener('keypress', (e) => {
    try {
      if (e && e.key === 'Enter') addGoal();
    } catch (error) {
      console.error('❌ Error adding goal:', error);
    }
  });
}

// Previous goals
const dismissPreviousGoalsBtn = document.getElementById('dismissPreviousGoalsBtn');
if (dismissPreviousGoalsBtn) {
  dismissPreviousGoalsBtn.addEventListener('click', async () => {
    try {
      await dismissPreviousGoals();
    } catch (error) {
      console.error('❌ Error dismissing previous goals:', error);
    }
  });
}

// Sites (Blocked)
const addSiteBtn = document.getElementById('addSiteBtn');
if (addSiteBtn) {
  addSiteBtn.addEventListener('click', () => {
    try {
      addSite();
    } catch (error) {
      console.error('❌ Error adding site:', error);
    }
  });
}
const newSiteInput = document.getElementById('newSiteInput');
if (newSiteInput) {
  newSiteInput.addEventListener('keypress', (e) => {
    try {
      if (e && e.key === 'Enter') addSite();
    } catch (error) {
      console.error('❌ Error adding site:', error);
    }
  });
}

// Sites (Whitelisted)
const addWhitelistBtn = document.getElementById('addWhitelistBtn');
if (addWhitelistBtn) {
  addWhitelistBtn.addEventListener('click', () => {
    try {
      addWhitelistedSite();
    } catch (error) {
      console.error('❌ Error adding whitelisted site:', error);
    }
  });
}

// NoGo list
const addNoGoListBtn = document.getElementById('addNoGoListBtn');
if (addNoGoListBtn) {
  addNoGoListBtn.addEventListener('click', () => {
    try {
      addNoGoListSite();
    } catch (error) {
      console.error('❌ Error adding nogo list site:', error);
    }
  });
}
const newNoGoListInput = document.getElementById('newNoGoListInput');
if (newNoGoListInput) {
  newNoGoListInput.addEventListener('keypress', (e) => {
    try {
      if (e && e.key === 'Enter') {
        addNoGoListSite();
      }
    } catch (error) {
      console.error('❌ Error adding nogo list site:', error);
    }
  });
}

const newWhitelistInput = document.getElementById('newWhitelistInput');
if (newWhitelistInput) {
  newWhitelistInput.addEventListener('keypress', (e) => {
    try {
      if (e && e.key === 'Enter') addWhitelistedSite();
    } catch (error) {
      console.error('❌ Error adding whitelisted site:', error);
    }
  });
}

// Settings - auto-save on change
const breakDurationEl = document.getElementById('breakDuration');
if (breakDurationEl) {
  breakDurationEl.addEventListener('change', async () => {
    try {
      await saveSettings();
    } catch (error) {
      console.error('❌ Error saving settings:', error);
    }
  });
}
const cooldownDurationEl = document.getElementById('cooldownDuration');
if (cooldownDurationEl) {
  cooldownDurationEl.addEventListener('change', async () => {
    try {
      await saveSettings();
    } catch (error) {
      console.error('❌ Error saving settings:', error);
    }
  });
}
const challengeTypeEl = document.getElementById('challengeType');
if (challengeTypeEl) {
  challengeTypeEl.addEventListener('change', async () => {
    try {
      // Show/hide language selector
      const vocabLanguageRow = document.getElementById('vocabLanguageRow');
      if (challengeTypeEl && challengeTypeEl.value !== undefined) {
        const challengeType = challengeTypeEl.value;
        if (vocabLanguageRow) {
          vocabLanguageRow.style.display = challengeType === 'vocabulary' ? 'flex' : 'none';
        }
        await saveSettings();
      }
    } catch (error) {
      console.error('❌ Error updating challenge type:', error);
    }
  });
}
const vocabLanguageEl = document.getElementById('vocabLanguage');
if (vocabLanguageEl) {
  vocabLanguageEl.addEventListener('change', async () => {
    try {
      console.log('[LANG-DEBUG] Step 1: Language dropdown changed');
      const selectedLanguage = vocabLanguageEl.value;
      console.log('[LANG-DEBUG] Step 1.1: Selected language:', selectedLanguage);
      console.log('[LANG-DEBUG] Step 1.2: Current state vocabLanguage:', currentState?.vocabLanguage);
      console.log('[LANG-DEBUG] Step 1.3: Challenge type:', document.getElementById('challengeType')?.value);
      
      // saveSettings() already handles vocabulary reload via updateSettings
      // when vocabLanguage changes, so we just need to save and reload state
      console.log('[LANG-DEBUG] Step 2: Calling saveSettings()...');
      await saveSettings();
      console.log('[LANG-DEBUG] Step 3: saveSettings() completed successfully');
      // loadState() is already called in saveSettings() after successful save,
      // so we don't need to call it again here
    } catch (error) {
      console.error('[LANG-DEBUG] ❌ ERROR in language change handler:', error);
      console.error('❌ Error saving vocabulary language:', error);
      alert('Failed to save language setting. Please try again.');
    }
  });
}
const redirectGifEl = document.getElementById('redirectGif');
if (redirectGifEl) {
  redirectGifEl.addEventListener('change', async () => {
    try {
      await saveSettings();
    } catch (error) {
      console.error('❌ Error saving settings:', error);
    }
  });
}
const redirectDonationEl = document.getElementById('redirectDonation');
if (redirectDonationEl) {
  redirectDonationEl.addEventListener('change', async () => {
    try {
      await saveSettings();
    } catch (error) {
      console.error('❌ Error saving settings:', error);
    }
  });
}

// Collapsible sections
function setupCollapsible(headerId, contentId) {
  const header = document.getElementById(headerId);
  const content = document.getElementById(contentId);
  
  if (!header || !content) {
    console.error(`❌ Missing elements for collapsible: ${headerId} or ${contentId}`);
    return;
  }
  
  const icon = header.querySelector('.collapse-icon');
  
  header.addEventListener('click', () => {
    try {
      if (!content) return;
      
    const isExpanded = content.style.display !== 'none';
    
    if (isExpanded) {
        if (content) content.style.display = 'none';
        if (icon && icon.classList) icon.classList.remove('expanded');
    } else {
        if (content) content.style.display = 'block';
        if (icon && icon.classList) icon.classList.add('expanded');
      }
    } catch (error) {
      console.error('❌ Error toggling collapsible:', error);
    }
  });
}

setupCollapsible('blockedSitesHeader', 'blockedSitesContent');
setupCollapsible('whitelistHeader', 'whitelistContent');
setupCollapsible('nogoListHeader', 'nogoListContent');

// Break whitelist controls event listeners
const removeFromBreakWhitelistEl = document.getElementById('removeFromBreakWhitelist');
const addToBreakWhitelistEl = document.getElementById('addToBreakWhitelist');

if (removeFromBreakWhitelistEl) {
  removeFromBreakWhitelistEl.addEventListener('change', async function(e) {
    if (!this) return;
    const domain = this.value;
    if (!domain) return;
    
    console.log('🔄 Removing from break whitelist:', domain);
    
    // Set flag to prevent updates during processing
    isProcessingBreakWhitelistChange = true;
    
    try {
      // Invalidate cache to force update after change
      lastBreakWhitelistState = null;
      
      // Prevent default and stop propagation
      if (e && e.stopPropagation) e.stopPropagation();
      
      const response = await chrome.runtime.sendMessage({
        action: 'removeFromBreakWhitelist',
        domain: domain
      });
      
      // Check for runtime errors after message
      if (chrome.runtime.lastError) {
        console.error('❌ Chrome runtime error after message:', chrome.runtime.lastError);
        alert('Failed to communicate with extension. Please try again.');
        return;
      }
      
      console.log('📨 Response:', response);
      
      if (response && response.success) {
        // Force update by invalidating cache and reloading state
        lastBreakWhitelistState = null;
        try {
          await loadState();
          // Immediately update the dropdowns to show the change (force update)
          updateBreakWhitelistControls(true);
          // Reset selection to placeholder after update
          if (this) {
            this.value = '';
            // Ensure placeholder is selected
            if (this.options && this.options.length > 0 && this.options[0].value === '') {
              this.options[0].selected = true;
            }
          }
        } catch (loadError) {
          console.error('❌ Error loading state after whitelist change:', loadError);
        }
      } else {
        console.error('❌ Failed to remove from break whitelist:', response);
        alert(response?.error || 'Failed to remove site from break whitelist');
      }
    } catch (error) {
      console.error('❌ Error removing from break whitelist:', error);
      alert('Failed to remove site from break whitelist');
    } finally {
      // Clear flag after a short delay to allow UI to update
      setTimeout(() => {
        isProcessingBreakWhitelistChange = false;
      }, 500);
    }
  });
}

if (addToBreakWhitelistEl) {
  addToBreakWhitelistEl.addEventListener('change', async function(e) {
    if (!this) return;
    const domain = this.value;
    if (!domain) return;
    
    console.log('🔄 Adding to break whitelist:', domain);
    
    // Set flag to prevent updates during processing
    isProcessingBreakWhitelistChange = true;
    
    try {
      // Invalidate cache to force update after change
      lastBreakWhitelistState = null;
      
      // Prevent default and stop propagation
      if (e && e.stopPropagation) e.stopPropagation();
      
      const response = await chrome.runtime.sendMessage({
        action: 'addToBreakWhitelist',
        domain: domain
      });
      
      // Check for runtime errors after message
      if (chrome.runtime.lastError) {
        console.error('❌ Chrome runtime error after message:', chrome.runtime.lastError);
        alert('Failed to communicate with extension. Please try again.');
        return;
      }
      
      console.log('📨 Response:', response);
      
      if (response && response.success) {
        // Force update by invalidating cache and reloading state
        lastBreakWhitelistState = null;
        try {
          await loadState();
          // Immediately update the dropdowns to show the change (force update)
          updateBreakWhitelistControls(true);
          // Reset selection to placeholder after update
          if (this) {
            this.value = '';
            // Ensure placeholder is selected
            if (this.options && this.options.length > 0 && this.options[0].value === '') {
              this.options[0].selected = true;
            }
          }
        } catch (loadError) {
          console.error('❌ Error loading state after whitelist change:', loadError);
        }
      } else {
        console.error('❌ Failed to add to break whitelist:', response);
        alert(response?.error || 'Failed to add site to break whitelist');
      }
    } catch (error) {
      console.error('❌ Error adding to break whitelist:', error);
      alert('Failed to add site to break whitelist');
    } finally {
      // Clear flag after a short delay to allow UI to update
      setTimeout(() => {
        isProcessingBreakWhitelistChange = false;
      }, 500);
    }
  });
}

// Setup event listeners
try {
  setupSnoozeChallengeListeners();
} catch (error) {
  console.error('❌ Error setting up snooze challenge listeners:', error);
}

// Initial load
loadState().catch(error => {
  console.error('❌ Error in initial load:', error);
});

// Auto-refresh every second
setInterval(() => {
  loadState().catch(error => {
    console.error('❌ Error in auto-refresh:', error);
  });
}, 1000);

// Update nogo list timers more frequently (every second) to show accurate countdown
setInterval(() => {
  try {
    if (currentState?.nogoListRemovalTimers) {
      const hasActiveTimers = Object.values(currentState.nogoListRemovalTimers).some(timer => 
        timer.endTime > Date.now()
      );
      if (hasActiveTimers) {
        updateNoGoList(); // Update display to show countdown
      }
    }
  } catch (error) {
    console.error('❌ Error updating nogo list timers:', error);
  }
}, 1000); // Every second for accurate countdown

