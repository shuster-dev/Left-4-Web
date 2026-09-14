# Hobile: Outbreak — iPhone Fix V5.2

Focused repair pass from the 11:15 iPhone recording. This is still the single-player combat gate before multiplayer is reattached.

## Fixes made from the recording

- Darkened/tinted the Stalker materials to remove the blown-out white silhouette visible on iPhone.
- Closer over-the-shoulder camera composition.
- Faster camera collision pull-in and precise mesh collision for thin fences/poles.
- More responsive mobile look stick and tighter movement acceleration/deceleration.
- Smaller dead zone to remove the delayed/slippery feeling at the start of a swipe.
- Exact mesh raycast for bullets, so thin environment geometry can block shots.
- Two-stage camera-to-target then muzzle-to-target hitscan remains in place for crosshair consistency.
- Muzzle origin moved to agree better with the shoulder camera.
- Reduced mobile recoil shake while preserving weapon kick.
- Stronger infected separation and fewer common infected allowed to occupy attack slots simultaneously.
- Longer player hurt cooldown to prevent overlapping infected from deleting HP instantly.
- Better enemy locomotion clip priority.
- iOS pointer safety: global pointer-up/cancel/blur resets FIRE and both sticks to prevent stuck movement/firing.
- Per-weapon magazine/reserve persistence remains fixed from V5.1.
- Floating procedural gun remains hidden when the character model has no valid right-hand socket.
- Service-worker cache bumped so Vercel does not keep the previous combat build.

## Important

This pass targets control, camera, hit registration and combat stability. The current CC0 environment and character pack is still low-poly; code tuning cannot turn those assets into Left 4 Dead 2 visual fidelity. A higher-fidelity art/animation pipeline is a separate milestone after the combat gate is stable.

## iPhone

For the cleanest fullscreen presentation, add the deployed site to the iPhone Home Screen and launch it there. Normal Safari tabs keep browser chrome visible.

## Tests
Run `npm test`.


## V5.3 iPhone recording fixes
- Reverted the over-aggressive V5.2 camera collapse that could hide the survivor.
- 3.55 m shoulder camera with a 1.58 m hard minimum distance.
- Foreground meshes between camera and survivor fade temporarily instead of swallowing the player model.
- Spawn selection prefers open clearance instead of the first barely-valid collision point.
- Survivor and infected silhouettes are larger/brighter for mobile readability.
- Added a soft player fill light so the back/shoulders remain readable in the dark scene.
- Slightly slower look response and less abrupt locomotion acceleration for a heavier co-op-shooter feel.
- Debug HUD now reports actual camera distance to make iPhone recordings actionable.
