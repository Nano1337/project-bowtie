# Bowtie Dubbing Lab — MVP PRD

## Summary
A single-screen web app inspired by Detective Conan's iconic voice-changing bowtie. Users authenticate with a shared password, then click the central bowtie to record voice snippets that get dubbed into another language via ElevenLabs and played back.

## Current Status: MVP COMPLETE
- [x] Local dev server runs via Bun (`bun dev`)
- [x] Environment variables configured in `.env.local`
- [x] Conan-themed UI with playful palette, fonts, and bowtie art
- [x] Custom login screen with Conan artwork and passphrase gate
- [x] Dubbing flow with WAV conversion for ElevenLabs compatibility
- [x] Session history with input/output playback and clear option
- [x] Language selector with 8 supported languages
- [x] Playback speed control (0.75x - 1.25x)
- [x] Vercel deployment config (Bun runtime) ready
- [ ] Vercel environment variables need to be set for production deploy

## Goals (Achieved)
- [x] Deliver a delightful, single-click voice capture → dubbing → playback loop
- [x] Provide clear visual states: listening (glow), processing (color shift), speaking (throb)
- [x] Keep authentication dead-simple with shared password

## Non-goals (for MVP)
- User accounts, profiles, or persistence
- Audio history beyond session (ephemeral only)
- Multi-speaker diarization or manual speaker mapping

## Primary User Flow
1. User lands on `/login` and enters shared password
2. Cookie-based auth redirects to main bowtie UI
3. User clicks bowtie → listening state (yellow glow pulse)
4. Recording auto-stops after ~5s or on second click
5. Processing state (blue/yellow glow shift) while ElevenLabs dubs
6. Speaking state (scale throb) as dubbed audio plays back

## Functional Requirements (Implemented)
- **Auth:** Cookie-based with SHA-256 hash validation from `APP_PASSWORD`
- **Login screen:** Custom Conan-themed page at `/login`
- **Recording:** MediaRecorder with auto-codec detection + WAV conversion
- **Audio upload:** `POST /api/dub` with FormData (audio + target_lang)
- **Polling:** 202 status triggers client-side polling via `/api/dub/status`
- **Playback:** Immediate playback with configurable speed
- **Language selector:** 8 languages (EN, JA, ES, ZH, PT, DE, KO, FR)
- **Error handling:** User-facing messages for mic denial and API failures
- **History:** In-session with replay buttons and memory cleanup

## Visual & Motion (Implemented)
- Central bowtie graphic (360px or 72vw max)
- Listening: yellow glow pulse animation (1.2s loop)
- Processing: blue/yellow glow shift animation (1.3s loop)
- Speaking: scale throb animation (1.1s loop)
- Respects `prefers-reduced-motion` for accessibility

## API Contract
`POST /api/dub`
- FormData: `audio` (WAV blob), `target_lang` (language code)
- Returns: 200 with audio stream, or 202 with `dubbing_id` for polling

`GET /api/dub/status`
- Query: `dubbing_id`, `target_lang`
- Returns: 200 with audio stream, 202 if still processing, 500 if failed

## Risks (Mitigated)
- ElevenLabs latency: Handled with polling + 60s serverless timeout
- MediaRecorder codecs: Auto-detect + WAV conversion fallback
- Language codes: Verified against ElevenLabs supported list

## Open Questions (Resolved)
1. Default target language: Japanese (ja)
2. Stop recording: Re-click bowtie or 5s auto-stop
3. 5-second window: Sufficient for typical use cases
4. Transcript display: Planned for Phase 2
5. Watermark: Not applied, clean output
6. Auth: Custom password screen implemented (not browser Basic Auth)
