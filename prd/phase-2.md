# Bowtie Dubbing Lab — Phase 2 PRD (Playful UX + Transcript)

## Summary
Enhance the MVP with a more playful Detective Conan-inspired experience, improved UX polish, and a transcript feature with synchronized word highlighting during playback.

---

## Design Philosophy: Detective Conan Theming

### Visual Identity (from Conan canon)
- **Primary colors:** Blue (Conan's jacket/eyes), Red (bowtie), White (shirt)
- **Accent colors:** Yellow/gold (dial, highlights), Black (hair, outlines)
- **Gadget aesthetic:** The bowtie has a dial on the back for voice presets
- **Style evolution:** Original anime used bold primary colors; newer seasons trend pastel

### Key Elements to Incorporate
- The bowtie remains the central interactive hero element
- Dial/knob metaphor for controls (language, speed)
- Glasses motif for secondary UI elements
- Comic/manga-inspired visual flourishes
- Detective/mystery atmosphere with playful energy

---

## Feature 1: Synchronized Transcript Display

### Overview
Display the transcript of dubbed audio with real-time word highlighting that follows playback position. This helps users learn pronunciation and follow along.

### Technical Approach (ElevenLabs APIs)

**Option A: Speech-to-Text (Scribe) API** (Recommended)
- Endpoint: `POST /v1/speech-to-text`
- After dubbing completes, send the dubbed audio to Scribe
- Request word-level timestamps: `timestamps_granularity: "word"`
- Returns transcript with `words[]` array containing `{text, start, end}` for each word

**Option B: Forced Alignment API**
- Endpoint: `POST /v1/forced-alignment`
- Requires both audio AND text transcript
- Would need to first transcribe, then align
- More accurate but adds latency

### Implementation Plan
1. After dubbed audio is received, call Speech-to-Text API
2. Store transcript with word timestamps in history entry
3. During playback, track `audio.currentTime` via `timeupdate` event
4. Highlight current word based on timestamp range
5. Auto-scroll transcript to keep current word visible

### UI Design
- Transcript panel below bowtie (collapsible)
- Words displayed as inline spans with distinct hover states
- Current word: highlighted background (yellow/gold)
- Past words: slightly dimmed
- Click any word to seek audio to that position

### Data Structure
```typescript
type TranscriptWord = {
  text: string;
  start: number;  // seconds
  end: number;    // seconds
};

type HistoryEntry = {
  // ...existing fields
  transcript?: TranscriptWord[];
};
```

---

## Feature 2: Playful UX Enhancements

### A. Recording Waveform Visualization
- Live audio level bars or waveform while recording
- Positioned around or below the bowtie
- Uses Web Audio API AnalyserNode for real-time frequency data
- Conan-inspired color scheme (blue/red accents)

### B. Recording Progress Ring
- Circular progress indicator around bowtie showing time remaining
- 5-second countdown visualization
- Smooth animation with Conan color palette

### C. Enhanced State Animations
- **Idle:** Subtle floating/breathing animation
- **Listening:** Sound wave ripples emanating from bowtie
- **Processing:** Gear/dial rotation overlay (reference to bowtie dial)
- **Speaking:** Audio wave visualization synced to playback
- **Success:** Confetti or sparkle burst on completion

### D. Dial-Style Controls
- Replace dropdown/slider with dial UI for language selection
- Inspired by the bowtie's back dial mechanism
- Rotate to select language (preset numbers like in the show)
- Visual feedback on selection change

### E. Micro-interactions
- Button press feedback (scale + shadow)
- Hover states with subtle glow
- Smooth transitions between all states
- Sound effects (optional, toggle-able)

### F. History Panel Redesign
- Card-based layout with playful borders
- Language flags or icons
- Waveform preview thumbnails
- Swipe-to-delete on mobile

---

## Feature 3: Visual Polish

### Background Enhancements
- Animated floating orbs (more dynamic)
- Subtle parallax effect on scroll/mouse move
- Optional: nighttime/daytime theme toggle

### Typography
- Keep Luckiest Guy for headings (playful, bold)
- Improve text hierarchy and spacing
- Add comic-style speech bubbles for status messages

### Color Refinements
- Deeper Conan blue: `#1a3a6e` (jacket color)
- Brighter bowtie red: `#e63946`
- Gold accents: `#f4d35e`
- Clean whites and soft shadows

---

## Technical Requirements

### New API Endpoint
`POST /api/transcribe`
- Input: audio blob (from dubbed output)
- Calls ElevenLabs Speech-to-Text API
- Returns: `{ words: TranscriptWord[] }`

### Frontend State Additions
```typescript
type Phase = "idle" | "listening" | "processing" | "transcribing" | "speaking" | "error";

// New state for transcript
const [transcript, setTranscript] = useState<TranscriptWord[]>([]);
const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
```

### Performance Considerations
- Debounce `timeupdate` handler (60fps not needed)
- Virtualize long transcripts
- Lazy-load transcript on panel expand
- Cache transcripts in history entries

---

## Open Questions

1. Should transcript be opt-in (button) or automatic?
2. Display source language transcript alongside translation?
3. Add copy-to-clipboard for transcript text?
4. Support transcript editing/correction?
5. How prominent should the dial UI be vs. current dropdowns?

---

## Success Metrics

- User engagement: clicks on transcript words to seek
- Completion rate: users who play full dubbed audio
- Return visits: session frequency
- Qualitative: user feedback on playfulness

---

## Priority Order

1. **High:** Transcript with word highlighting (core learning feature)
2. **High:** Recording waveform visualization (immediate feedback)
3. **Medium:** Progress ring during recording
4. **Medium:** Enhanced state animations
5. **Low:** Dial-style controls (significant UI change)
6. **Low:** Sound effects
