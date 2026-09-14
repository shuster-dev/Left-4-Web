# Hobile: Outbreak — Combat Polish V5

This build is a focused third-person gameplay repair pass based on the iPhone screen recording from V4.
It is intentionally **not** the multiplayer/campaign build yet. The goal is to make the basic mobile shooter loop stable before reconnecting rooms and four-player co-op.

## V5 fixes

- New rigged third-person survivor with actual idle / walk / run clips.
- Acceleration/deceleration instead of instant sliding.
- Camera-relative movement with analogue dead-zone and response curve.
- Correct vertical look direction on the right stick.
- Stable over-the-shoulder camera with geometry collision and smooth pull-in / pull-out.
- Environment-derived movement colliders so the survivor cannot freely walk through scenery.
- Enemy movement uses the same collision layer and cannot damage through blocked line-of-sight.
- Enemy attack wind-up and short player hurt cooldown prevent instant HP deletion when a horde overlaps.
- Center-screen 3D hitscan shooting replaces the old flat X/Z cone test.
- World occlusion: bullets stop at cover instead of passing through fences/walls/props.
- Head/body hit volumes, headshot multiplier, hit/kill markers, moving spread and recoil recovery.
- Light mobile aim assist only when the target is visible.
- Shotgun pellet simulation through the same camera ray model.
- Enemy separation is stronger to reduce one-model piles.
- Lower GPU cost: fewer rain particles, no dynamic shadows for infected, 512 shadow map, lower DPR cap, infected population cap.
- Automatic PERFORMANCE mode when sustained FPS is too low.
- Fullscreen request on Play where supported.
- PWA manifest + Add to Home Screen support for a cleaner iPhone fullscreen experience.

## Controls

- Left stick: camera-relative movement
- Right stick: camera look / aim
- FIRE: hold for automatic weapons
- R: reload
- +: medkit
- ↔: weapon switch

## Important limitation

V5 is designed to move the **feel** closer to a polished co-op third-person shooter, but it is not Valve's Left 4 Dead 2 engine and does not use Valve assets or maps. The environment and infected are original CC0 development assets. Online rooms stay disabled until this gameplay layer is stable on the target iPhone.

## Deployment

Upload the entire ZIP/folder to Vercel. The `/api/asset` function proxies the GLB files and the browser also has direct CDN fallback.
