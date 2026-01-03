# Bowtie Dubbing Lab

Detective Conan-inspired bowtie that records your voice, sends it to ElevenLabs for dubbing, and plays back the translated result.

## Getting Started

Install dependencies and run the development server:

```bash
bun dev
```

## Environment Variables

Create `.env.local` and add:

```bash
APP_PASSWORD=your_shared_password
ELEVENLABS_API_KEY=your_elevenlabs_key
```

The app uses HTTP Basic Auth. Enter any username, plus the shared password from `APP_PASSWORD`.

## ElevenLabs Dubbing Flow

`POST /api/dub` accepts a recorded audio blob (`audio`) and `target_lang`, then:

1. Creates a dubbing project with ElevenLabs.
2. Polls until ready.
3. Streams back the dubbed audio.

## Deployment

Deploy to Vercel and set the same environment variables there. Ensure the project uses the Bun runtime if you want parity with local dev.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
