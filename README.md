# Hobile: Outbreak — 2.5D Co-op Zombie Campaign

A clean restart of the project around a mobile-first 2.5D co-op structure.

## What is playable in V1
- Original side-view / 2.5D chibi survivor presentation
- Chapter 1: Ashwood Road
- Route progression and safehouse objective
- Dynamic AI Director that alternates pressure and recovery
- Common infected + Rusher + Leaper + Corroder + Caller + Brute
- Dynamic hordes and a final holdout
- Ripper SMG, Breach-8 shotgun and Warden AR
- Ammo, medkits, temporary-health stim, weapon pickups
- Persistent Scrap + Armory weapon upgrades in localStorage
- Incapacitation/downed state and co-op revive interaction
- Mobile joystick, Fire, Jump, Reload, Use and Swap
- Local synthesized SFX, particles, recoil/screen shake and parallax environment
- Online 2-player co-op rooms using Supabase Realtime Presence + Broadcast
- Host simulation for infected/world snapshots
- Shareable room link

## Technical rules
- Static hosting on Vercel
- No paid game server
- No database tables required for the room
- No external image/model asset packs
- One external browser library: Supabase JS, used only for online networking
- The entire renderer/gameplay engine is plain HTML Canvas + JavaScript

## IP rule
This project does NOT copy Left 4 Dead or MapleStory assets, characters, maps, names,
UI, music, dialogue or code. It takes inspiration from the broad co-op campaign
structure (team traversal, hordes, special infected, revives and dynamic pacing)
and expresses it with original Hobile mechanics, names and artwork.
