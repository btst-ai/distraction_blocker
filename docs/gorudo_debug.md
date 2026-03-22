# Gōrudo Debug Log - Language Change Error (ERROR-004)

## Issue
When changing the vocabulary language, the popup receives `undefined` as the response, triggering ERROR-004: "No response from extension (undefined). The message channel may have closed."

## Symptoms
- Background script logs show: "Response sent successfully"
- `sendResponse()` is called and appears to execute
- Popup receives `undefined` instead of `{ success: true }`
- Language change actually works (state is updated), but the UI shows an error

## Root Cause Analysis

### 1. Handler Declaration Issue
**Problem:** The message handler is declared as `async`:
```javascript
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
```

**Impact:** When you `return true` from an `async` function, it returns `Promise<true>`, not the boolean `true`.

**Chrome Behavior:** Chrome's message listener expects a synchronous `return true` to keep the message channel open. When it receives `Promise<true>`, it may not recognize this as a signal to keep the channel open, causing the channel to close prematurely.

### 2. sendResponse() Return Value
**Assumption:** `sendResponse()` returns `true` on success, `false` if channel closed.

**Reality:** `sendResponse()` returns `undefined` in most cases. Channel closure is detected via:
- Exceptions thrown by `sendResponse()`
- `chrome.runtime.lastError` after calling `sendResponse()`

**Evidence from logs:**
```
[LANG-DEBUG] Step 4.0.10: responseCallback returned: undefined
[LANG-DEBUG] Step 4.0.10.1: Return type: undefined
```

### 3. Timing Issue
**Sequence of events:**
1. Handler receives message (async)
2. `return true` happens synchronously (but returns `Promise<true>`)
3. Chrome may close channel because it doesn't recognize the Promise
4. Async IIFE starts vocabulary loading (takes time)
5. `sendResponse()` is called after async work completes
6. Channel is already closed → response is lost
7. Popup receives `undefined`

**Timeline from logs:**
- Step 4.4.1: Returning true (synchronously)
- Step 5.4-5.9: Vocabulary loading (async, takes time)
- Step 4.0.9: sendResponse() called (too late, channel closed)

## Solution

### Fix: Remove `async` from Handler
Make the handler synchronous and use IIFEs for async work:

```javascript
// BEFORE (broken):
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  // async work
  return true; // Returns Promise<true>, Chrome doesn't recognize it
});

// AFTER (fixed):
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Capture sendResponse immediately
  const responseCallback = sendResponse;
  
  // Do async work in IIFE
  (async () => {
    await someAsyncWork();
    responseCallback({ success: true });
  })();
  
  return true; // Returns actual boolean true, Chrome keeps channel open
});
```

### Why This Works
1. Handler is synchronous → `return true` returns actual `boolean true`
2. Chrome recognizes `true` → keeps message channel open
3. Async work happens in IIFE → doesn't block the return
4. `sendResponse()` called when ready → channel is still open
5. Popup receives response correctly

## Testing Checklist
- [ ] Change language from dropdown
- [ ] Verify no ERROR-004 alert appears
- [ ] Verify language actually changes in vocabulary challenges
- [ ] Check service worker logs for successful response
- [ ] Check popup console for received response object

## Related Files
- `background-final.js` - Message handler (line 710)
- `popup-full.js` - saveSettings() function (line ~2003)
- Error tracking: ERROR-001 through ERROR-010 in popup-full.js

## Date
2025-11-21

## Fix Applied
**Date:** 2025-11-21 12:37

**Change:** Removed `async` keyword from message handler declaration

**Before:**
```javascript
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
```

**After:**
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
```

**Why:** 
- `async` handler returns `Promise<true>` instead of `boolean true`
- Chrome doesn't recognize `Promise<true>` as a signal to keep channel open
- Removing `async` makes `return true` return actual `boolean true`
- Chrome recognizes this and keeps the message channel open
- Async work continues in IIFEs without blocking the return

**Additional Fix:**
- Added `chrome.runtime.lastError` check after `sendResponse()` to detect channel closure
- This provides better error detection if channel closes unexpectedly

