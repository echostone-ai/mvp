# Mobile Story Optimization Manual Testing Checklist - Task 12

This checklist covers manual testing requirements for mobile optimization and resource management features implemented in Task 12.

## Requirements Coverage
- **Requirement 7.1**: Mobile device compatibility (iOS/Android audio context requirements)
- **Requirement 7.2**: Browser consistency (iOS Safari, Android Chrome)
- **Requirement 8.7**: Mobile resource constraints (CPU overhead ≤ 3% p95, cache ≤ 30MB)

## Test Environment Setup

### iOS Safari Testing
- **Device**: iPhone (iOS 15+ recommended)
- **Browser**: Safari (latest version)
- **Network**: Both WiFi and cellular (test different conditions)

### Android Chrome Testing
- **Device**: Android phone (Android 8+ recommended)
- **Browser**: Chrome (latest version)
- **Network**: Both WiFi and cellular

## Pre-Test Setup

1. **Clear Browser Cache**
   ```
   iOS Safari: Settings > Safari > Clear History and Website Data
   Android Chrome: Settings > Privacy > Clear browsing data
   ```

2. **Enable Developer Tools** (if available)
   ```
   iOS Safari: Settings > Safari > Advanced > Web Inspector
   Android Chrome: chrome://inspect/#devices
   ```

3. **Monitor Memory Usage**
   ```
   iOS: Settings > General > iPhone Storage
   Android: Settings > Device care > Memory
   ```

## Test Cases

### TC1: User Gesture Requirement (iOS Safari)
**Requirement**: 7.1 - Only preload on user gesture unlocked AudioContext

**Steps**:
1. Open story-enabled avatar page in iOS Safari
2. **Before any user interaction**, trigger a story
3. Observe behavior
4. **After tapping screen**, trigger the same story
5. Observe behavior

**Expected Results**:
- Before gesture: Story should be queued, TTS fallback used
- After gesture: Story should preload and play successfully
- No audio errors in console
- Smooth fallback to TTS when gesture not available

**Pass/Fail**: ___

**Notes**: ___

---

### TC2: Conservative Preloading (iOS Safari)
**Requirement**: 8.7 - Max 1 decoded story on iOS

**Steps**:
1. Navigate to avatar with multiple stories
2. Trigger first story and verify it plays
3. Immediately trigger second story
4. Check developer console for preload messages
5. Monitor memory usage

**Expected Results**:
- Only 1 story decoded at a time on iOS
- Second story queued or uses fallback
- Memory usage stays within reasonable bounds
- Console shows "iOS decoded story limit reached" messages

**Pass/Fail**: ___

**Notes**: ___

---

### TC3: Memory Management (Both Platforms)
**Requirement**: 8.7 - 15MB cache limit, memory pressure detection

**Steps**:
1. Upload 5 stories (each ~3-5MB)
2. Trigger stories in sequence
3. Monitor cache size in developer tools
4. Continue triggering stories beyond cache limit
5. Check for cache eviction messages

**Expected Results**:
- Cache size never exceeds 15MB
- Oldest entries evicted when limit approached
- Console shows memory pressure warnings
- No browser crashes or freezes

**Pass/Fail**: ___

**Memory Usage**: ___ MB (peak)

---

### TC4: TTS Buffering Respect
**Requirement**: 8.7 - Don't preload during TTS buffering

**Steps**:
1. Start a long TTS response (type long message)
2. While TTS is speaking, trigger a story
3. Observe preload behavior in console
4. Wait for TTS to finish, then trigger story again

**Expected Results**:
- Story preload deferred while TTS active
- Console shows "TTS is currently buffering" message
- Story preloads after TTS completes
- No audio conflicts or overlaps

**Pass/Fail**: ___

**Notes**: ___

---

### TC5: Audio Context State Management (iOS Safari)
**Requirement**: 7.1 - Handle iOS Safari audio context suspension/resumption

**Steps**:
1. Start story playback
2. Switch to another app (background the browser)
3. Wait 30+ seconds
4. Return to browser
5. Trigger another story

**Expected Results**:
- Audio context suspended when backgrounded
- Audio context resumes when foregrounded
- Story playback works after returning
- No audio context errors

**Pass/Fail**: ___

**Notes**: ___

---

### TC6: Network Condition Handling
**Requirement**: 7.2 - Progressive loading for larger files

**Steps**:
1. Switch to slow network (3G simulation or poor WiFi)
2. Trigger story with large audio file (4-5MB)
3. Monitor loading behavior
4. Test timeout handling (should fallback after 2s)

**Expected Results**:
- Progressive loading indicators shown
- Fallback to TTS after 2-second timeout
- No hanging or frozen interface
- Graceful error messages

**Pass/Fail**: ___

**Load Time**: ___ seconds

---

### TC7: Concurrent Audio Handling (Both Platforms)
**Requirement**: 7.2 - Consistent audio quality and timing

**Steps**:
1. Start story playback
2. Trigger expression overlay during story
3. Test story + TTS interaction
4. Verify audio doesn't overlap incorrectly

**Expected Results**:
- Clean audio transitions
- No audio artifacts or distortion
- Proper audio level management
- Mobile Safari playsInline works correctly

**Pass/Fail**: ___

**Notes**: ___

---

### TC8: Memory Pressure Response (Both Platforms)
**Requirement**: 8.7 - CPU overhead ≤ 3% p95

**Steps**:
1. Open multiple browser tabs
2. Run memory-intensive operations
3. Trigger story system under memory pressure
4. Monitor CPU usage and responsiveness

**Expected Results**:
- System responds to memory pressure
- Cache cleared when memory low
- CPU usage stays reasonable
- No browser crashes

**Pass/Fail**: ___

**CPU Usage**: ___% (observed peak)

---

### TC9: Cross-Browser Consistency
**Requirement**: 7.2 - Consistent behavior across browsers

**Steps**:
1. Test same story sequence on iOS Safari
2. Test same story sequence on Android Chrome
3. Compare loading times and behavior
4. Verify feature parity

**Expected Results**:
- Similar loading performance
- Consistent audio quality
- Same fallback behavior
- Feature parity maintained

**iOS Safari Results**: ___
**Android Chrome Results**: ___
**Consistency**: Pass/Fail ___

---

### TC10: Resource Cleanup
**Requirement**: General - Proper resource management

**Steps**:
1. Navigate between multiple avatar pages
2. Trigger stories on different avatars
3. Return to previous pages
4. Monitor memory usage over time

**Expected Results**:
- Memory usage doesn't continuously grow
- Resources cleaned up when leaving pages
- No memory leaks detected
- Stable performance over time

**Pass/Fail**: ___

**Memory Growth**: ___ MB over ___ minutes

---

## Performance Benchmarks

### Loading Performance
- **Story preload time**: Target < 2s, Actual: ___ s
- **TTS fallback time**: Target < 150ms gap, Actual: ___ ms
- **Cache lookup time**: Target < 50ms, Actual: ___ ms

### Memory Usage
- **Peak cache size**: Target < 15MB, Actual: ___ MB
- **iOS decoded stories**: Target ≤ 1, Actual: ___
- **Memory pressure response**: Target < 5s, Actual: ___ s

### CPU Usage
- **Story system overhead**: Target ≤ 3% p95, Actual: ___% p95
- **Background CPU usage**: Target minimal, Actual: ___%

## Browser-Specific Issues

### iOS Safari Issues Found
1. ___
2. ___
3. ___

### Android Chrome Issues Found
1. ___
2. ___
3. ___

## Recommendations

### Performance Optimizations
1. ___
2. ___
3. ___

### Mobile UX Improvements
1. ___
2. ___
3. ___

## Test Summary

**Total Test Cases**: 10
**Passed**: ___
**Failed**: ___
**Blocked**: ___

**Overall Assessment**: Pass/Fail ___

**Critical Issues**: ___

**Minor Issues**: ___

**Recommendations for Production**: ___

---

## Tester Information

**Tester Name**: ___
**Test Date**: ___
**iOS Device**: ___ (iOS version: ___)
**Android Device**: ___ (Android version: ___)
**Network Conditions**: ___
**Additional Notes**: ___