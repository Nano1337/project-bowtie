# Phase 3: UX Improvements PRD

## Completed (Phase 1 Critical)
- [x] Pause control during playback (tap header bowtie)
- [x] Play button disabled while playing
- [x] History status indicators (processing/ready/error)
- [x] Transcript error visibility

## Completed (Phase 2 High Priority)
- [x] Recording countdown timer ("0s / 5s" display)
- [x] Visual warning at 2s remaining (red + pulse)
- [x] "Tap to stop" hint during recording (in status bubble)
- [x] 2-minute client-side polling timeout
- [x] "Taking longer than expected..." message after 30s

## Completed (Phase 3 Polish)
- [x] Clear All confirmation modal
- [x] Stop playing audio before clearing
- [x] Reset transcript view on clear
- [x] Extract `seekToWord()` reusable function (DRY)

## Future Considerations
- Persistent storage (localStorage/IndexedDB)
- Extend recording limit (10-15s option)
- Audio feedback (beeps for start/stop)
- Playback progress bar with time display
- Waveform visualization during playback

