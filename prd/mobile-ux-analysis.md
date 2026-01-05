# Mobile-First UX Analysis: Bowtie Dubbing Lab

## Core User Journey

1. **Record** → Tap bowtie, speak
2. **Wait** → See processing feedback
3. **Learn** → Hear dubbed audio, read transcript with highlighting
4. **Practice** → Tap words to repeat, replay sections
5. **Review** → Access previous recordings

**Key insight:** Step 3 (transcript + audio sync) is the PRIMARY value. Everything else supports this moment.

---

## Device Constraints

### Mobile (320px - 480px)
- Single column only
- Thumb zone at bottom (easy reach)
- Top corners hard to reach one-handed
- Vertical scroll is natural
- Horizontal scroll is awkward
- Touch targets need 44px+ minimum
- Screen keyboard can obscure content

### Tablet (768px+)
- Can split into 2 columns
- More breathing room
- Still touch-first

### Desktop (1024px+)
- Mouse precision allows smaller targets
- Multi-column layouts work
- Hover states available

---

## Analysis: Option A (Minimal Recorder)

### Mobile Experience
```
┌──────────────────┐
│                  │
│    🎀 BOWTIE     │
│    (80% screen)  │
│                  │
│  [Tap to start]  │
└──────────────────┘
     ↓ after dub
┌──────────────────┐
│ ┌──────────────┐ │
│ │  TRANSCRIPT  │ │  ← overlay covers bowtie
│ │  (modal)     │ │
│ └──────────────┘ │
└──────────────────┘
```

**Pros:**
- Extremely simple idle state
- Large tap target
- Fast to start recording
- Minimal cognitive load

**Cons:**
- Transcript overlay BLOCKS bowtie during playback
- Can't see bowtie animation while reading transcript
- History on separate page = context switch, friction
- Settings hidden = discoverability problem
- Overlay modal feels interruptive, not integrated
- "Back" to dismiss transcript is confusing

**Mobile Score: 5/10** - Simple but doesn't serve learning use case

---

## Analysis: Option B (Split Panel)

### Mobile Experience
```
DESKTOP (works great):          MOBILE (forced stack):
┌────────┬────────┐            ┌──────────────────┐
│ BOWTIE │TRANSCR │            │    🎀 BOWTIE     │
│        │        │            │    (squished)    │
│        │        │     →      ├──────────────────┤
│        │        │            │   TRANSCRIPT     │
└────────┴────────┘            │   (squished)     │
                               └──────────────────┘
```

**Pros:**
- Excellent on desktop/tablet
- Clear information hierarchy
- Both elements always visible

**Cons:**
- On mobile, columns MUST stack vertically
- When stacked: both elements get ~50% height = both feel cramped
- Bowtie at 50% height loses impact
- Transcript at 50% height = only ~3-4 lines visible
- Essentially becomes current layout but worse
- Doesn't adapt to user's current task

**Mobile Score: 4/10** - Desktop-first thinking doesn't translate

---

## Analysis: Option C (Timeline View)

### Mobile Experience
```
┌──────────────────┐
│   🎀 (small)     │
├──────────────────┤
│ ▼ Recording 1    │
│   "Hello..." →   │
│   "こんにちは"    │
│   [▶] [▶] [🗑]   │
├──────────────────┤
│ ▶ Recording 2    │
│   (collapsed)    │
├──────────────────┤
│ ▶ Recording 3    │
└──────────────────┘
```

**Pros:**
- Natural vertical scroll
- History integrated (not hidden)
- Expandable cards work well on touch
- Can see multiple recordings
- Good for session review

**Cons:**
- Bowtie becomes SECONDARY (small, top)
- New recording competes with history for attention
- "Current" vs "past" distinction unclear
- Expanding card takes user away from recording action
- Feels more like "history browser" than "recorder"
- Conan bowtie theme gets diminished

**Mobile Score: 6/10** - Good for review, bad for primary action

---

## Analysis: Option D (Card Flow)

### Mobile Experience
```
┌──────────────────┐
│                  │
│  ┌────────────┐  │
│  │            │  │
│  │  🎀 CARD   │  │  ← swipe left/right
│  │            │  │     between cards
│  └────────────┘  │
│                  │
│    ● ○ ○ ○ ○     │  ← pagination dots
└──────────────────┘
```

**Pros:**
- Very mobile-native feel
- Single focus at a time
- Swipe gestures feel natural on mobile
- Can have large tap targets
- App-like experience

**Cons:**
- Swipe can conflict with iOS back gesture
- Can't see transcript WHILE bowtie animates
- History requires swiping through N cards (slow if many)
- No overview of all recordings
- Learning curve for navigation
- Card flip animation may feel gimmicky
- Complex to implement well

**Mobile Score: 6/10** - Native feel but sacrifices simultaneous view

---

## The Real Problem

All 4 options treat the layout as STATIC. But the user's needs CHANGE by phase:

| Phase | User Needs | Ideal UI |
|-------|------------|----------|
| **Idle** | Clear CTA, easy to start | Big bowtie, minimal chrome |
| **Recording** | Feedback that it's working | Bowtie + waveform + timer |
| **Processing** | Patience, progress indicator | Bowtie animating |
| **Playback** | READ transcript, hear audio | TRANSCRIPT DOMINATES |
| **Post-play** | Replay, try again, or review | Controls + transcript |

**Key insight:** During PLAYBACK, the transcript should get MAXIMUM space because that's when learning happens. The bowtie can shrink—it's done its job.

---

## New Proposal: Phase-Adaptive Layout

### Concept
The UI TRANSFORMS based on current phase. Not a modal or overlay—a genuine layout shift that feels intentional.

### Idle State (Mobile)
```
┌──────────────────────┐
│ [≡]            [⚙]  │  ← hamburger + settings (corners)
│                      │
│                      │
│      🎀 BOWTIE       │  ← LARGE, hero element
│      (70% width)     │
│                      │
│   ┌──────────────┐   │
│   │ Tap to start │   │  ← speech bubble prompt
│   └──────────────┘   │
│                      │
│   [🇯🇵 Japanese ▾]   │  ← language always visible
│                      │
└──────────────────────┘
```
- Bowtie is HERO
- Minimal UI, invites interaction
- Language selector visible (frequent setting)
- Speed hidden in settings (infrequent)

### Recording State (Mobile)
```
┌──────────────────────┐
│ [≡]            [⚙]  │
│                      │
│      🎀 BOWTIE       │  ← pulsing animation
│      (still large)   │
│                      │
│   ▁▃▅▇▅▃▁▂▄▆▄▂      │  ← waveform below
│                      │
│   ╭──────────────╮   │
│   │ Listening... │   │
│   │    3.2s      │   │
│   ╰──────────────╯   │
│   ━━━━━━━●━━━━━━━━   │  ← progress bar (5s)
│                      │
│   [Tap to stop]      │
└──────────────────────┘
```
- Bowtie stays prominent (it's the "mic")
- Clear recording feedback
- Progress toward auto-stop visible

### Processing State (Mobile)
```
┌──────────────────────┐
│ [≡]            [⚙]  │
│                      │
│      🎀 BOWTIE       │  ← processing glow animation
│                      │
│   ╭──────────────╮   │
│   │ Translating  │   │
│   │   ●●●        │   │  ← animated dots
│   ╰──────────────╯   │
│                      │
│                      │
└──────────────────────┘
```
- Simple, patient
- User waits

### Playback State (Mobile) ⭐ THE KEY STATE
```
┌──────────────────────┐
│ [≡]  🎀  Speaking [⚙]│  ← bowtie SHRINKS to header
├──────────────────────┤
│                      │
│  TRANSCRIPT          │  ← DOMINATES the screen
│                      │
│  "Hello, how are     │
│   you today?"        │
│                      │
│  ━━━━━━━━━━━━━━━━━  │  ← subtle divider
│                      │
│  「こんにちは、       │
│    [今日は]          │  ← current word highlighted
│    お元気ですか?」   │
│                      │
│                      │
├──────────────────────┤
│ ▶ ━━━━●━━━━━ 0:03   │  ← playback scrubber
│                      │
│ [🔄 Replay] [🎤 New] │  ← action buttons
└──────────────────────┘
```

**Why this works:**
- Transcript gets ~70% of screen
- Large, readable text
- Words are tappable for seeking
- Bowtie still visible (brand presence) but not competing
- Playback controls in thumb zone (bottom)
- Clear actions: replay or record new

### Post-Playback State (Mobile)
```
┌──────────────────────┐
│ [≡]  🎀  Done   [⚙] │
├──────────────────────┤
│                      │
│  TRANSCRIPT          │  ← stays visible for review
│  (same as above)     │
│                      │
├──────────────────────┤
│ [▶ Input] [▶ Output] │  ← can replay either
│                      │
│ [🎤 New Recording]   │  ← primary CTA
│                      │
│ [💾 Save to History] │  ← if not auto-saved
└──────────────────────┘
```

### History Sidebar (Mobile)
```
┌──────────────────────┐
│ HISTORY         [✕] │  ← slides in from left
├──────────────────────┤
│                      │
│ ┌──────────────────┐ │
│ │ 🇯🇵 Today 2:34 PM │ │
│ │ "Hello" →        │ │
│ │ "こんにちは"      │ │  ← mini transcript preview
│ │ [▶ In] [▶ Out]   │ │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ 🇪🇸 Today 2:30 PM │ │
│ │ "Thank you" →    │ │
│ │ "Gracias"        │ │
│ │ [▶ In] [▶ Out]   │ │
│ └──────────────────┘ │
│                      │
│ [Clear All]          │
└──────────────────────┘
```

When tapping a history item's play button:
- Sidebar closes
- That recording's transcript loads
- Enters Playback State with historical data

---

## Desktop/Tablet Enhancement

On screens ≥768px, we DON'T transform—we show both:

```
┌─────────────────────────────────────────────────────┐
│ [≡ History]        Detective Conan           [⚙]  │
├────────────────────────┬────────────────────────────┤
│                        │                            │
│      🎀 BOWTIE         │     TRANSCRIPT             │
│                        │                            │
│   ▁▃▅▇▅▃▁ (waveform)  │  "Hello, how are you?"    │
│                        │                            │
│   [🇯🇵 Japanese ▾]     │  「こんにちは、            │
│   Speed: ━━●━ 1.0x     │    [お元気]ですか?」       │
│                        │                            │
│   "Listening..."       │                            │
│                        │                            │
├────────────────────────┴────────────────────────────┤
│  [▶ Play Input]  [▶ Play Output]  [💾 Download]    │
└─────────────────────────────────────────────────────┘
```

- Side-by-side layout
- Both visible simultaneously
- No transformation needed
- History as slide-in sidebar (same as mobile)

---

## Comparison Summary

| Criteria | A: Minimal | B: Split | C: Timeline | D: Cards | **NEW: Adaptive** |
|----------|------------|----------|-------------|----------|-------------------|
| Mobile idle UX | ★★★★★ | ★★☆☆☆ | ★★★☆☆ | ★★★★☆ | ★★★★★ |
| Mobile playback UX | ★★☆☆☆ | ★★☆☆☆ | ★★★☆☆ | ★★★☆☆ | ★★★★★ |
| Transcript visibility | ★★☆☆☆ | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | ★★★★★ |
| Bowtie prominence | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★★☆ | ★★★★☆ |
| History access | ★☆☆☆☆ | ★★★☆☆ | ★★★★★ | ★★☆☆☆ | ★★★★☆ |
| Implementation complexity | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ |
| Desktop scaling | ★★★☆☆ | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★★★ |
| Learning UX | ★★☆☆☆ | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | ★★★★★ |

---

## Final Recommendation: Phase-Adaptive Layout

**Why this wins:**

1. **Respects mobile constraints** - Single column, thumb-friendly controls
2. **Prioritizes the learning moment** - Transcript gets maximum space during playback
3. **Keeps bowtie as hero** - Large and prominent in idle state
4. **Graceful transformation** - UI adapts to what user needs NOW
5. **Scales to desktop** - Becomes split-panel on larger screens
6. **History is accessible** - Sidebar pattern works on all devices
7. **Reduces cognitive load** - Show only relevant UI per phase
8. **Maintains Conan theme** - Bowtie always visible, just repositions

**Trade-offs accepted:**
- More complex state management (worth it)
- Animation work for transitions (worth it)
- Bowtie is smaller during playback (acceptable—transcript is the star then)
