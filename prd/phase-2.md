# Bowtie Dubbing Lab — Phase 2 PRD (Layered Features)

## Summary
Extend the MVP with richer feedback and personalization to improve pronunciation practice, translation confidence, and shareability.

## Proposed Feature Layers
- **Pronunciation coach:** show phonetic hints and pitch contours.
- **Transcript view:** show source + translated transcript after each clip.
- **Voice presets:** switch between character voices or accents.
- **Session history:** list recent clips with replay + download.
- **Shareable demos:** generate public links with time-limited access.

## UX Enhancements
- Progress ring for recording duration.
- Live waveform visualization while listening.
- Celebration animation when dubbing completes.

## Technical Requirements
- Store clip metadata (language, duration, timestamps).
- Add structured error logging for API failures.
- Consider caching dubbed audio for replay.

## Open Questions (Clarifying)
1. Which layer has the highest user value after MVP?
2. Should transcripts be opt-in for privacy reasons?
3. Do we want multiple bowtie “skins” or keep one iconic design?
4. Are we comfortable storing audio clips, or should everything stay ephemeral?
5. What is the desired cap on clip length for cost control?
