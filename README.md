# Hobile: Outbreak — Alpha 1.1

This is a clean mobile-first co-op zombie campaign foundation built for iPhone Safari and Vercel.
It uses original Hobile names, maps, art direction and code. No Left 4 Dead / Valve assets, maps,
characters, sounds, dialogue or code are included.

## What is implemented
- Original 2.5D side-view co-op shooter presentation with depth movement
- Touch move stick + aim stick + Fire / Reload / Use / Med / Swap
- Three selectable maps: Ashwood Road, Riverside Depot, Blackout Highway
- Normal / Hard / Nightmare difficulty presets
- Outbreak Director pacing: RELIEF → BUILD → PEAK → RECOVERY
- Common infected + Rusher + Corroder + Screecher + Brute finale enemy
- Ripper SMG, Breach-8 shotgun, Warden AR
- Ammo, medkits, weapon pickups
- Downed / bleedout / teammate revive
- 4-survivor squad; empty online slots become AI bots
- Final holdout and shelter completion
- iPhone-friendly debug HUD and Copy Debug Report

## Real online room flow
The Supabase project URL and browser-safe publishable key are already configured in `core.js`.
- Create Online Server generates an 8-character room code
- Share Invite Link opens the iPhone share sheet
- Friends open `?room=XXXXXXXX`
- Supabase Presence supplies the lobby roster and host election
- WebRTC DataChannels are attempted for fast gameplay traffic
- If direct P2P does not connect, the game falls back to lower-rate Supabase Broadcast
- The host phone is authoritative for infected AI, Director, damage, pickups, revive and objectives
- Host snapshots synchronize the world to clients

## Deploy from iPhone
Upload this whole folder/ZIP to a Vercel project. No build command is required.
Open the Vercel URL in Safari, rotate to landscape, then use Create Online Server.

## Important free-tier limitation
This architecture is designed for friend-group play with free tiers. Direct WebRTC can fail on some
mobile/carrier networks when NAT requires a TURN relay. In that case Hobile automatically uses the
Supabase Broadcast fallback. This is playable at lower network update rates, but it is not an unlimited
free dedicated game server.
