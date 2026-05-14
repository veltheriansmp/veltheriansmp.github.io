# velthriansmp.github.io
website for our new smp!

## Environment Variables

- `DISCORD_APPEAL_WEBHOOK` — Discord webhook URL for website ban appeals.
- `DISCORD_CHAT_WEBHOOK` — Discord webhook URL for website chat forwarding.
- `BRIDGE_SECRET` — shared secret used by Discord / Minecraft bridges to post messages into the portal chat via `/api/chat`.

Example bridge request headers:
- `x-bridge-secret: <BRIDGE_SECRET>`
- or `Authorization: Bearer <BRIDGE_SECRET>`
