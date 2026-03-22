# Chrome Web Store Privacy Practices - Justifications

## Single Purpose Description

Gōrudo is a productivity extension that helps users stay focused by blocking distracting websites during work sessions. It allows users to set daily goals, take intentional breaks with accountability challenges, and track their productivity through a visual timeline. The extension enforces focus time and break cooldowns while providing statistics on blocked sites.

---

## Permission Justifications

### 1. Alarms (`chrome.alarms`)

**Justification:**
Gōrudo uses alarms to manage break timers and cooldown periods. When a user starts a break, an alarm is set to automatically end the break after the specified duration. Alarms are also used to track cooldown periods between breaks, ensuring users maintain focus time before taking another break. This is essential for the core functionality of enforcing break durations and cooldown periods.

**Data Usage:**
- Alarms are created and managed locally
- No alarm data is transmitted externally
- Alarms are cleared when breaks end or the extension is disabled

---

### 2. Host Permissions (`<all_urls>`)

**Justification:**
Gōrudo requires host permissions to:
1. **Block websites**: Check if a user is attempting to visit a blocked site and redirect them
2. **Load vocabulary files**: Access CSV vocabulary files stored in the extension's web_accessible_resources
3. **Display redirect content**: Show GIF images or donation pages when sites are blocked

The extension only accesses URLs to determine if they should be blocked based on the user's configured site lists. It does not read page content, extract data, or interact with website functionality beyond blocking/redirecting.

**Data Usage:**
- Only domain names are extracted from URLs for blocking decisions
- No page content, cookies, or personal data is accessed
- All blocking logic runs locally in the extension

---

### 3. Notifications (`chrome.notifications`)

**Justification:**
Gōrudo uses notifications to inform users when a site has been blocked. The notification includes:
- The blocked URL/domain
- An option to add the site to the whitelist (or break whitelist during breaks)

This provides immediate feedback when blocking occurs and allows users to quickly adjust their site lists without opening the extension popup. Notifications are essential for user awareness and control.

**Data Usage:**
- Notification content is generated locally from the blocked URL
- No notification data is transmitted externally
- Users can interact with notifications to modify site lists

---

### 4. Remote Code Use

**Justification:**
Gōrudo does not execute remote code. All code runs locally within the extension. The extension loads vocabulary CSV files from its own web_accessible_resources, but these are static data files, not executable code. No JavaScript or other executable code is fetched from or executed from remote sources.

**Data Usage:**
- No remote code execution occurs
- Only static CSV vocabulary files are loaded from extension resources
- All JavaScript executes from the extension's own files

---

### 5. Storage (`chrome.storage`)

**Justification:**
Gōrudo uses `chrome.storage.local` to persist user data locally in the browser, including:
- Daily goals and completion status
- Blocked and whitelisted sites
- No Go Zone sites
- Break history and timeline
- User settings (break duration, cooldown, challenge type, language preference)
- Block statistics
- Vocabulary word removals

This storage is essential for maintaining user preferences and progress across browser sessions. Without storage, users would lose their goals, site lists, and progress every time they close the browser.

**Data Usage:**
- All data is stored locally using `chrome.storage.local`
- No data is transmitted to external servers
- Data persists across browser sessions
- Users can clear all data by uninstalling the extension

---

### 6. Tabs (`chrome.tabs`)

**Justification:**
Gōrudo uses tab permissions to:
1. **Block navigation**: Redirect users away from blocked sites by updating tab URLs
2. **Monitor tab updates**: Detect when users navigate to blocked sites
3. **Provide break functionality**: Allow access to sites during breaks

The extension monitors tab URL changes to enforce blocking rules and redirect users when they attempt to visit blocked sites. This is essential for the core blocking functionality.

**Data Usage:**
- Only tab URLs are accessed to determine blocking decisions
- Tab content, cookies, or other tab data is not accessed
- URLs are processed locally and not transmitted externally

---

### 7. WebNavigation (`chrome.webNavigation`)

**Justification:**
Gōrudo uses webNavigation to:
1. **Detect navigation events**: Monitor when users navigate to new pages
2. **Enforce blocking**: Intercept navigation to blocked sites before pages load
3. **Track navigation patterns**: Update block statistics when sites are accessed

This permission is essential for detecting and blocking site access in real-time, providing immediate feedback when users attempt to visit distracting sites.

**Data Usage:**
- Only navigation URLs are accessed for blocking decisions
- Navigation data is processed locally to update block statistics
- No navigation data is transmitted externally

---

## Data Handling Summary

**Data Collection:**
- User-configured goals, site lists, and settings
- Block statistics (counts per domain)
- Break history and timeline
- Vocabulary word preferences

**Data Storage:**
- All data stored locally using `chrome.storage.local`
- No external servers or cloud storage
- Data persists only in the user's browser

**Data Transmission:**
- No data is transmitted to external servers
- No analytics or tracking services
- No user data is shared with third parties

**Data Access:**
- Only the extension itself accesses stored data
- No external services or APIs are called
- All processing happens locally in the browser

---

## Compliance Statement

Gōrudo complies with Chrome Web Store Developer Program Policies:
- All data is stored and processed locally
- No user data is collected, transmitted, or shared
- No external servers or APIs are used
- All functionality operates within the browser
- Users have full control over their data through the extension interface

