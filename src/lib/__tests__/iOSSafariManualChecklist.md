# iOS Safari Manual Testing Checklist
## Story System Compatibility and Performance

This manual checklist ensures the authentic voice stories feature works correctly on iOS Safari with proper gesture unlock and single preload behavior as required by task 11.

**Requirements:** 8.1, 8.2, 8.4, 7.1, 7.2

---

## Pre-Test Setup

### Device Requirements
- [ ] iOS device (iPhone/iPad) running iOS 14.5+ 
- [ ] Safari browser (latest version recommended)
- [ ] Stable internet connection (WiFi preferred for consistent testing)
- [ ] Device volume at 50% for audio testing

### Test Environment Setup
- [ ] Clear Safari cache and cookies
- [ ] Disable Low Power Mode
- [ ] Ensure device has sufficient storage (>1GB free)
- [ ] Close other apps to minimize memory pressure
- [ ] Test in both portrait and landscape orientations

---

## 1. Audio Context Gesture Unlock Testing

### 1.1 Initial Page Load (No Gesture)
- [ ] **Test:** Load story-enabled avatar page without any user interaction
- [ ] **Expected:** No audio preloading occurs, AudioContext remains suspended
- [ ] **Verify:** Check browser console for "AudioContext suspended" messages
- [ ] **Pass Criteria:** No network requests for story audio files

### 1.2 First User Gesture (Unlock AudioContext)
- [ ] **Test:** Tap anywhere on screen or press any button
- [ ] **Expected:** AudioContext unlocks, story preloading becomes available
- [ ] **Verify:** Console shows "AudioContext running" state
- [ ] **Pass Criteria:** AudioContext.state === 'running'

### 1.3 Story Preloading After Gesture
- [ ] **Test:** Trigger conversation that should match a story
- [ ] **Expected:** Story audio begins preloading only after gesture unlock
- [ ] **Verify:** Network tab shows story audio download
- [ ] **Pass Criteria:** Preloading starts within 100ms of trigger match

---

## 2. Single Preload Behavior Testing

### 2.1 Conservative Memory Management
- [ ] **Test:** Trigger multiple story matches in sequence
- [ ] **Expected:** Only one story preloads at a time (not concurrent)
- [ ] **Verify:** Network tab shows sequential, not parallel downloads
- [ ] **Pass Criteria:** Maximum 1 story loading simultaneously

### 2.2 Memory Limit Compliance
- [ ] **Test:** Load several stories over time
- [ ] **Expected:** Total audio cache stays under 15MB limit
- [ ] **Verify:** Use Safari Web Inspector to monitor memory usage
- [ ] **Pass Criteria:** Audio buffer memory < 15MB total

### 2.3 Preload Cancellation
- [ ] **Test:** Start story preload, then trigger different story
- [ ] **Expected:** First preload cancels, second story begins loading
- [ ] **Verify:** Network requests show cancelled/aborted first request
- [ ] **Pass Criteria:** No memory leaks from cancelled preloads

---

## 3. Performance Requirements Testing

### 3.1 Trigger Matching Speed
- [ ] **Test:** Send message that should trigger story match
- [ ] **Expected:** Trigger matching completes within 100ms
- [ ] **Measure:** Use Safari Timeline profiler
- [ ] **Pass Criteria:** Trigger matching ≤ 100ms p95

### 3.2 Story Loading Speed
- [ ] **Test:** Measure time from trigger to audio ready
- [ ] **Expected:** Story loading completes within 2 seconds
- [ ] **Measure:** Console.time() around preload operations
- [ ] **Pass Criteria:** Story loading ≤ 2000ms p95

### 3.3 TTS Fallback Speed
- [ ] **Test:** Trigger story that fails to load (simulate network error)
- [ ] **Expected:** TTS fallback starts within 150ms of failure
- [ ] **Measure:** Time gap between story failure and TTS start
- [ ] **Pass Criteria:** Fallback gap ≤ 150ms

---

## 4. Audio Playback Testing

### 4.1 Story Audio Quality
- [ ] **Test:** Play story audio through to completion
- [ ] **Expected:** Clear audio without distortion or dropouts
- [ ] **Verify:** Listen for audio artifacts, volume consistency
- [ ] **Pass Criteria:** Audio plays smoothly without interruption

### 4.2 Volume Level Consistency
- [ ] **Test:** Compare story volume to TTS volume
- [ ] **Expected:** Similar perceived loudness levels
- [ ] **Verify:** Use device volume controls during playback
- [ ] **Pass Criteria:** No jarring volume differences

### 4.3 Audio Interruption Handling
- [ ] **Test:** Receive phone call or notification during story
- [ ] **Expected:** Story pauses, resumes after interruption ends
- [ ] **Verify:** iOS audio session management works correctly
- [ ] **Pass Criteria:** Graceful pause/resume behavior

---

## 5. Network Condition Testing

### 5.1 Slow Network Performance
- [ ] **Test:** Enable Safari "Slow 3G" simulation
- [ ] **Expected:** Story loading times out after 2s, falls back to TTS
- [ ] **Verify:** No indefinite loading, smooth TTS continuation
- [ ] **Pass Criteria:** Timeout behavior works as designed

### 5.2 Network Interruption
- [ ] **Test:** Disable WiFi during story loading
- [ ] **Expected:** Loading fails gracefully, TTS fallback activates
- [ ] **Verify:** No app crashes or frozen states
- [ ] **Pass Criteria:** Robust error handling

### 5.3 Cellular Data Constraints
- [ ] **Test:** Switch to cellular data, test story loading
- [ ] **Expected:** Stories load but may be slower
- [ ] **Verify:** Respect user's data usage preferences
- [ ] **Pass Criteria:** Functional on cellular with reasonable performance

---

## 6. Memory Pressure Testing

### 6.1 Background App Pressure
- [ ] **Test:** Open multiple Safari tabs, return to story app
- [ ] **Expected:** Story system continues working, may reload gracefully
- [ ] **Verify:** No crashes or broken audio state
- [ ] **Pass Criteria:** Resilient to memory pressure

### 6.2 Low Memory Warnings
- [ ] **Test:** Simulate low memory (open many apps)
- [ ] **Expected:** Story preloading may be disabled, TTS continues
- [ ] **Verify:** App remains functional under memory constraints
- [ ] **Pass Criteria:** Graceful degradation, no crashes

### 6.3 Audio Buffer Cleanup
- [ ] **Test:** Load multiple stories, check memory cleanup
- [ ] **Expected:** Old audio buffers are garbage collected
- [ ] **Verify:** Memory usage doesn't continuously increase
- [ ] **Pass Criteria:** Memory usage stabilizes over time

---

## 7. User Experience Testing

### 7.1 Story Trigger Responsiveness
- [ ] **Test:** Type messages that should trigger stories
- [ ] **Expected:** Stories trigger naturally in conversation flow
- [ ] **Verify:** No noticeable delays or awkward pauses
- [ ] **Pass Criteria:** Seamless conversation experience

### 7.2 Visual Feedback
- [ ] **Test:** Observe loading indicators during story preload
- [ ] **Expected:** Appropriate loading states shown to user
- [ ] **Verify:** User understands what's happening
- [ ] **Pass Criteria:** Clear, non-intrusive feedback

### 7.3 Error State Handling
- [ ] **Test:** Trigger various error conditions
- [ ] **Expected:** User-friendly error messages, no technical jargon
- [ ] **Verify:** App continues working after errors
- [ ] **Pass Criteria:** Graceful error presentation

---

## 8. Accessibility Testing

### 8.1 VoiceOver Compatibility
- [ ] **Test:** Enable VoiceOver, navigate story interface
- [ ] **Expected:** All story controls are accessible
- [ ] **Verify:** Screen reader announces story states correctly
- [ ] **Pass Criteria:** Full VoiceOver compatibility

### 8.2 Reduced Motion Support
- [ ] **Test:** Enable "Reduce Motion" accessibility setting
- [ ] **Expected:** Story animations respect user preference
- [ ] **Verify:** No motion-based feedback when disabled
- [ ] **Pass Criteria:** Respects accessibility preferences

### 8.3 High Contrast Support
- [ ] **Test:** Enable high contrast mode
- [ ] **Expected:** Story UI remains visible and usable
- [ ] **Verify:** Sufficient color contrast maintained
- [ ] **Pass Criteria:** Accessible in high contrast mode

---

## 9. Edge Case Testing

### 9.1 Rapid Story Triggers
- [ ] **Test:** Send multiple trigger messages quickly
- [ ] **Expected:** System handles rapid triggers gracefully
- [ ] **Verify:** No race conditions or duplicate playback
- [ ] **Pass Criteria:** Stable behavior under rapid input

### 9.2 Long Story Playback
- [ ] **Test:** Play maximum length story (5 minutes)
- [ ] **Expected:** Story plays completely without issues
- [ ] **Verify:** No memory leaks or performance degradation
- [ ] **Pass Criteria:** Stable long-duration playback

### 9.3 App Backgrounding During Story
- [ ] **Test:** Background app while story is playing
- [ ] **Expected:** Story pauses, resumes when app returns to foreground
- [ ] **Verify:** iOS background audio policies respected
- [ ] **Pass Criteria:** Proper background/foreground handling

---

## 10. Performance Regression Testing

### 10.1 Baseline TTS Performance
- [ ] **Test:** Measure TTS response time without stories enabled
- [ ] **Expected:** Establish baseline performance metrics
- [ ] **Measure:** Time from message send to first audio
- [ ] **Pass Criteria:** Document baseline for comparison

### 10.2 Story System Impact
- [ ] **Test:** Measure TTS response time with stories enabled (no matches)
- [ ] **Expected:** Minimal impact on TTS performance
- [ ] **Measure:** Compare to baseline measurements
- [ ] **Pass Criteria:** <10% performance regression

### 10.3 Battery Usage Impact
- [ ] **Test:** Monitor battery usage during extended story testing
- [ ] **Expected:** Reasonable battery consumption
- [ ] **Measure:** iOS battery usage statistics
- [ ] **Pass Criteria:** No excessive battery drain

---

## Test Results Documentation

### Test Environment
- **Device:** ________________
- **iOS Version:** ____________
- **Safari Version:** __________
- **Test Date:** ______________
- **Tester:** _________________

### Overall Results
- [ ] **All Critical Tests Passed** (Sections 1-3)
- [ ] **All Performance Tests Passed** (Sections 3, 10)
- [ ] **All User Experience Tests Passed** (Section 7)
- [ ] **All Accessibility Tests Passed** (Section 8)

### Issues Found
| Test Section | Issue Description | Severity | Status |
|-------------|-------------------|----------|--------|
|             |                   |          |        |
|             |                   |          |        |
|             |                   |          |        |

### Performance Measurements
| Metric | Measured Value | Requirement | Pass/Fail |
|--------|---------------|-------------|-----------|
| Trigger Matching P95 | _____ ms | ≤ 100ms | _____ |
| Story Loading P95 | _____ ms | ≤ 2000ms | _____ |
| TTS Fallback Gap | _____ ms | ≤ 150ms | _____ |
| Memory Usage Peak | _____ MB | ≤ 15MB | _____ |

### Recommendations
1. ________________________________
2. ________________________________
3. ________________________________

### Sign-off
- **Tester Signature:** ________________
- **Date:** ___________________________
- **Overall Status:** PASS / FAIL / CONDITIONAL PASS