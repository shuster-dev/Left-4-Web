# Hobile Outbreak — Third Person Recovery V5.5

This build is a surgical recovery from the V5.4 iPhone recording.

## What the recording proved
- The left joystick visually moved, so touch input was arriving.
- The camera/world did not move with it, so the player was being blocked by generated environment collision boxes.
- HP dropped and the special-infected card was active, so enemies existed and were simulating even though their imported actor visuals were not reliably visible.

## V5.5 fixes
- Replaced the problematic survivor GLB with the metre-scale Forest Outpost Survivor Scavenger (CC0, known ground origin).
- Removed V5.4's destructive X/Z recentering and aggressive runtime character normalization.
- Animation mixers now bind directly to the imported actor model.
- Environment collision generation is conservative and the spawn area is explicitly kept clear.
- Automatic collision-grace recovery guarantees that a held movement stick cannot leave the player hard-locked by a bad collider.
- Initial infected are spawned directly in front of/around the camera so visibility is immediately testable.
- Broad camera collision AABBs are disabled; exact mesh raycasting handles camera obstruction instead.
- Character materials are lifted slightly for night readability.
- Service-worker cache key was changed to force Safari off the old V5.4 scripts.

## Scope
This is still a gameplay/third-person stability build, not the final campaign. Once movement, camera, visible infected and shooting are stable on the iPhone, the next milestone is the route-based campaign map and co-op room stack.
