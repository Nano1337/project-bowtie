# Bowtie Dubbing Lab — MVP PRD

## Summary
Build a single-screen web app that unlocks behind a shared password. Once authenticated, the user sees a large Detective Conan-inspired voice-changing bowtie in the center. Clicking the bowtie records a short voice snippet, sends it to ElevenLabs dubbing, then plays back the translated audio.

## Current Status
- Local dev server runs via Bun (`bun dev`).
- Environment variables are required in `.env.local`.
- Conan-themed UI (playful palette, fonts, and bowtie art) implemented.
- Custom login screen with Conan artwork and passphrase gate.
- Dubbing flow supports WAV uploads for ElevenLabs compatibility.
- Session history with playback and clear option.

## Goals
- Deliver a delightful, single-click voice capture → dubbing → playback loop.
- Provide clear visual states: listening, processing (gears spin), speaking.
- Keep authentication dead-simple to avoid bots while still easy for invited users.

## Non-goals (for MVP)
- User accounts, profiles, or persistence.
- Audio history or project saving.
- Multi-speaker diarization or manual speaker mapping.

## Primary User Flow
1. User lands on the page and is prompted for Basic Auth.
2. The bowtie UI loads in the center.
3. User clicks the bowtie → listening state.
4. Recording stops automatically after ~5s or on second click.
5. Gears spin while ElevenLabs processes.
6. Bowtie speaks back dubbed translation.

## Functional Requirements
- **Auth:** HTTP Basic Auth with a single shared password from `APP_PASSWORD`.
- **Login screen:** Custom Conan-themed login page that accepts the shared password.
- **Recording:** Use browser microphone permission + MediaRecorder.
- **Audio upload:** `POST /api/dub` with `audio` blob + `target_lang`.
- **Playback:** Immediately play back returned dubbed audio.
- **Language selector:** Simple dropdown for target language.
- **Error handling:** Clear error message when mic blocked or API fails.
- **History:** In-session history with input/output replay and clear option.

## Visual & Motion Requirements
- Central bowtie graphic with bold, playful styling.
- Listening: glow/pulse around bowtie.
- Processing: gear rings rotate.
- Speaking: core throb/pulse.

## API Contract (MVP)
`POST /api/dub`
- FormData:
  - `audio`: recorded audio blob
  - `target_lang`: language code (e.g., `ja`)
- Returns: dubbed audio stream (audio/mpeg)

## Metrics (Optional)
- Button taps → dubbing success rate.
- Avg dubbing processing time.

## Risks
- ElevenLabs dubbing latency could exceed serverless timeouts.
- MediaRecorder codec compatibility across browsers.
- Target language mismatch if ElevenLabs expects different codes.

## Open Questions (Clarifying)
1. Which default target language should we set for MVP?
2. Do we want a manual “stop recording” button or rely only on re-click?
3. Is a 5-second capture window enough for typical use?
4. Should we show transcript text as confirmation?
5. Do we want to watermark ElevenLabs output or keep it clean?
6. Are we fine with Basic Auth prompts in-browser, or do we want a custom password screen later?
