# Live Theatre device test

Theatre now has a host console and two room modes:

- **Hosted Showbox**: a separate shared-screen link plays narration and displays clues. Players use their devices for their own private character and current-act instructions; player devices stay silent.
- **Fully live**: every admitted player follows the current scene with recorded narration on their device after enabling sound. The host retains all scene, play/pause, stop, seek and restart controls.

Players request admission with a name. The host assigns each to an available character. Player state contains only the current scene and that seat's secret and current-act tasks. It never includes the complete mystery, future audio, solution object, other seats' secrets or host credentials. The shared screen has no character secrets. Removing a player revokes the invitation. End session stops all access.

## First real-device test on one network

1. On the host computer, install Node 22 or later, open this repository, and run `npm start`.
2. Open `http://localhost:3000/modules/theatre/` on the host. Load a mystery or use **First test · recorded sample**. The recorded sample has one cast seat; the mystery sample has two seats and expects uploaded narration for voiced play.
3. In Live connection, use the host computer's network address, for example `http://192.168.1.25:3000`. Open the host page using that same address, so the host and devices share the same origin. All devices must reach that computer; the computer's firewall must allow this port on the test network.
4. Select Hosted Showbox or Fully live and start the session. Share the player invitation. Open the separate shared-screen link on the TV/projector browser.
5. Admit players and assign characters. In Fully live, each player presses **Enable device sound** once. On the shared screen, enable sound once. Browsers require this gesture.
6. Check Play/Pause, seek, stop, clue/pause waits, character instructions and returning after a connection interruption. Test removal and End session. The host must keep their page open.

## Public deployment

GitHub Pages serves only the static interface. It cannot run `/api/live`. Public device play is **not enabled until a live server is hosted**. Deploy this Node server as one long-running instance behind HTTPS, then enter its HTTPS origin in Theatre's Live connection. Players receive that address in their invitation automatically. An HTTPS page cannot use a plain HTTP internet relay.

The relay is a first-test implementation with in-memory rooms, a six-hour room lifetime, up to ten active rooms and forty connections per room, and a 32 MiB room request limit. Server restarts end sessions. It is not an account service or durable production backend. Polling follows host commands roughly once per second; this is scene and narration coordination, not sample-accurate multi-speaker audio. A host absence pauses the room after eight seconds. No live microphone, camera, chat or payments are involved.

Environment configuration:

- `PORT`: server port, default 3000.
- `LIVE_ALLOWED_ORIGINS`: comma-separated permitted UI origins. Default permits `https://dorejamesdt4-lang.github.io`; the server's own origin is also accepted.
- `LIVE_CREATE_KEY`: optional host connection key required to create rooms. Enter it on the host screen only. It is not sent to players or saved in storage.

The static site can stay on GitHub Pages while the relay runs elsewhere. Multiple relay replicas need shared room storage before use. Fully live browser audio and mobile reconnect behaviour still need real-phone rehearsal on the chosen hosted relay.
