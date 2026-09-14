# Hobile: Outbreak — Visual Gate V3

This build deliberately replaces the old flat Canvas prototype with a **3D-rendered 2.5D mobile combat slice**.

## What this build proves
- Real GLB environment and character art instead of circles/rectangles or generated flat sprites.
- Fixed cinematic 3/4 camera: mobile 2.5D controls without FPS free-look.
- Real-time shadows, fog, wet/dark grading, floodlight/fire lighting, rain, flashlight, muzzle flashes, tracers, blood particles/decals, camera shake and film/vignette treatment.
- Original Hobile survivor plus three gameplay archetypes: Runner, Stalker and Bloated.
- Warden AR, Ripper SMG and Breach-8 gameplay stats.
- Pressure Director: RELIEF → BUILD → PEAK → RECOVERY.
- Hordes, special infected, healing, reload, weapon swap and extraction finale.
- Landscape iPhone touch controls: move stick, aim stick, fire, reload, heal and weapon swap.
- High / Performance render mode.

## Deployment
Upload the entire folder/ZIP to Vercel. `api/asset.js` is a same-origin cacheable proxy for the CC0 GLB pack; the browser also tries the public 3DAssets.dev CDN directly if the proxy fails.

The only runtime library dependency is Three.js from jsDelivr. The art GLBs are from 3DAssets.dev and are CC0 1.0 Universal.

## Deliberate scope
This is the **visual gate**, not the multiplayer build. Networking is intentionally absent until this look/combat direction is accepted. The next milestone reconnects the 4-player room flow (Supabase signalling/presence + WebRTC gameplay transport).

## iPhone acceptance test
1. Open in landscape.
2. Let all 5 GLBs load and tap ENTER EXTRACTION.
3. Move and aim at the same time for 2 minutes.
4. Hold FIRE through a horde, reload, swap all three weapons and use the medkit.
5. Survive until extraction opens (~62 seconds), clear nearby infected and enter the green beacon.
6. Repeat in PERFORMANCE mode if framerate is poor.

If assets fail, the build shows an explicit error instead of silently falling back to cheap placeholder graphics.
