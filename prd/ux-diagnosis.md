# UX Diagnosis: Bowtie Dubbing Lab

## Critical Bugs

### 1. Transcript Words Not Displaying
**Symptom:** Transcript panel shows but no words appear inside it.

**Likely Causes:**
- ElevenLabs Speech-to-Text API may require `model` parameter (e.g., `scribe_v1`)
- Audio blob being sent as `audio/mpeg` but may actually be different format from dubbing response
- API might be returning `words: []` or failing silently (we log but don't surface errors)
- Need to verify actual API response in browser console

**Diagnosis needed:** Check browser console for `[bowtie] Transcript fetched. { wordCount: X }` log

---

## UX/Layout Problems

### 2. History Panel is Poorly Positioned
**Current:** Dropdown menu in top-right corner, toggles open/closed.

**Problems:**
- Requires explicit click to access - not discoverable
- Positioned away from main content (bowtie + transcript)
- Dropdown closes when clicking elsewhere, easy to lose context
- When replaying from history, no transcript is shown
- Small touch target on mobile
- Competes with main action flow

### 3. Transcript Panel Appears/Disappears Unpredictably
**Current:** Shows during `transcribing`/`speaking` phases OR if `currentTranscript.length > 0`.

**Problems:**
- Appears below the fold on many screens
- No visual connection to the audio being played
- When phase returns to `idle`, transcript persists but feels orphaned
- No way to replay audio from transcript view
- History entries store transcript but don't display it when replayed

### 4. Information Hierarchy is Unclear
**Current layout (top to bottom):**
1. Nav bar (logo left, history button right)
2. Title + subtitle
3. Bowtie (main CTA)
4. Status speech bubble
5. Language selector
6. Playback speed control
7. Error message
8. Transcript panel
9. Footer hint

**Problems:**
- Too many elements competing for attention
- Controls (language, speed) are sandwiched awkwardly
- 9+ distinct sections = cognitive overload
- Transcript (key learning feature) is buried at bottom
- No clear primary/secondary/tertiary hierarchy

### 5. State Doesn't Flow Between Components
**Problems:**
- `currentTranscript` is separate from `history[].transcript`
- Playing from history doesn't load that entry's transcript
- No visual indicator of which history entry is currently playing
- Clearing history while audio plays causes undefined behavior

### 6. Mobile Experience Issues
- Bowtie at 72vw may be too large on small screens
- Waveform bars positioned absolutely may overflow
- History dropdown is cramped at 320px
- Transcript text may be too small

---

## Root Cause: No Clear UX Model

The current design tries to do too much on one screen without a clear mental model:

1. **Is this a "recorder"?** Then the bowtie should be primary with minimal chrome.
2. **Is this a "language learning tool"?** Then transcript should be co-primary with playback controls.
3. **Is this a "history browser"?** Then history should be persistent, not hidden.

Currently it's all three, conflicting with each other.

---

## Proposed Solutions

### Option A: Minimal Recorder (Focus on Bowtie)
- Bowtie dominates the screen
- Transcript appears as temporary overlay during playback
- History moves to separate page/tab
- Settings (language, speed) in a gear icon menu
- **Best for:** Demo/toy experience

### Option B: Split Panel (Recorder + Transcript)
- Left side: Bowtie + controls
- Right side: Persistent transcript panel
- History as sidebar or bottom drawer
- Transcript stays visible, scrolls with audio
- **Best for:** Language learning use case

### Option C: Timeline View (History-Centric)
- Bowtie at top, smaller
- Below: Timeline of recordings with inline transcripts
- Each recording expands to show transcript + playback
- Current recording animates into timeline when done
- **Best for:** Session review, practicing pronunciation

### Option D: Card-Based Flow
- Single card in center with bowtie
- After dubbing: Card flips/transitions to show transcript
- Swipe left for next recording, right for history
- Minimal persistent UI, maximum focus on current task
- **Best for:** Mobile-first, gamified experience

---

## Recommended Path: Option B (Split Panel)

**Why:**
- Transcript is a core feature you requested - deserves persistent visibility
- Keeps bowtie as hero element
- Clear separation of concerns
- Works well on desktop and tablet
- History can be a collapsible sidebar

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  [≡ History]           Detective Conan            [⚙]  │
├────────────────────────────┬────────────────────────────┤
│                            │                            │
│         🎀 BOWTIE          │       TRANSCRIPT           │
│        (tap to record)     │                            │
│                            │  "Hello, how are you?"     │
│      ● ● ● ● (waveform)    │   こんにちは、元気ですか?    │
│                            │                            │
│     [🇯🇵 Japanese ▾]       │   (words highlight as      │
│     Speed: [━━━●━] 1.0x    │    audio plays, click      │
│                            │    to seek)                │
│      "Listening..."        │                            │
│                            │                            │
├────────────────────────────┴────────────────────────────┤
│  [▶ Play Input] [▶ Play Output]  [↓ Download]  [🗑]    │
└─────────────────────────────────────────────────────────┘
```

**Key Changes:**
1. History becomes hamburger sidebar (slides in from left)
2. Transcript is always visible on right side
3. Controls consolidated below bowtie
4. Action bar at bottom for current recording
5. Settings (speed, etc.) in gear menu top-right
