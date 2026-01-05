# Bowtie Dubbing Lab — TODO

## Critical Bugs (Must Fix)

### Transcript Not Displaying Words
- [ ] Debug: Check browser console for `[bowtie] Transcript fetched` log
- [ ] Debug: Verify ElevenLabs STT API response structure
- [ ] Fix: Add `model: "scribe_v1"` parameter to transcribe API call
- [ ] Fix: Ensure audio blob content-type matches actual format
- [ ] Fix: Surface transcript errors to UI instead of silent failure

### History → Transcript Disconnect
- [ ] When replaying from history, load that entry's transcript into `currentTranscript`
- [ ] Show visual indicator of which history entry is currently playing
- [ ] Prevent clearing history while audio is playing

---

## UX Redesign (Choose One Path)

### Option A: Minimal Recorder
- [ ] Make bowtie 80%+ of viewport
- [ ] Transcript as temporary overlay during playback
- [ ] Move history to separate `/history` page
- [ ] Settings in icon menu

### Option B: Split Panel Layout (Recommended)
- [ ] Two-column layout: Bowtie left, Transcript right
- [ ] History as slide-in sidebar from left
- [ ] Consolidate controls below bowtie
- [ ] Add action bar at bottom (play input/output, download, delete)
- [ ] Settings in gear icon top-right

### Option C: Timeline View
- [ ] Smaller bowtie at top
- [ ] Vertical timeline of recordings below
- [ ] Each recording expandable with inline transcript
- [ ] Current recording animates into timeline

### Option D: Card-Based Flow
- [ ] Single centered card with bowtie
- [ ] Card flips/transitions to transcript after dubbing
- [ ] Swipe gestures for navigation
- [ ] Minimal persistent UI

---

## Specific Improvements (After Layout Decision)

### Transcript Panel
- [ ] Always visible (not conditional on phase)
- [ ] Show both source text and translated text
- [ ] Auto-scroll to current word
- [ ] Larger, more readable text
- [ ] Copy transcript button

### History Panel
- [ ] Persistent sidebar vs. dropdown
- [ ] Show mini-transcript preview for each entry
- [ ] Visual indicator for currently playing entry
- [ ] Swipe-to-delete on mobile
- [ ] Download individual recordings

### Controls
- [ ] Consolidate language + speed into compact control bar
- [ ] Move to bottom or sidebar
- [ ] Larger touch targets on mobile

### Visual Polish
- [ ] Reduce number of visual elements
- [ ] Clear primary/secondary/tertiary hierarchy
- [ ] Consistent spacing and alignment
- [ ] Mobile-responsive breakpoints

---

## Completed (Phase 1)

- [x] Transcript API endpoint (`/api/transcribe`)
- [x] Transcript UI with word highlighting
- [x] Playback sync and click-to-seek
- [x] Recording waveform visualization
- [x] Recording progress ring
- [x] Celebration sparkles animation
- [x] Comic speech bubble for status
- [x] Refined Conan color palette
- [x] Idle floating animation
- [x] Migrate middleware.ts → proxy.ts

---

## Technical Debt

- [ ] Extract transcript logic into custom hook
- [ ] Extract audio recording logic into custom hook
- [ ] Add error boundary component
- [ ] Add loading skeletons
- [ ] Performance profiling for long sessions
- [ ] Unit tests for audio conversion
