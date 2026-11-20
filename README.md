# Beep Beep Jam 🚗

A gentle, **ad-free** "drive the cars out of the parking lot" puzzle for toddlers and
little kids. It's an installable PWA that works **fully offline**, with no tracking, no
accounts and no purchases. Everything (art, sounds, music, levels) is made in code, so the
whole app is under 500 KB.

## How to play

Every vehicle has a face and looks the way it will drive. **Tap a vehicle** and it drives
that way.
- If the road ahead is clear, it zooms out of the lot (vroom, honk, sparkles).
- If something is in the way, it bumps gently and rolls back. You can't lose and there are
  no timers.
- Clear the whole lot to win stars and confetti.

The first levels have a helping hand that shows what to tap. Later on, the hand shows up
again after a pause (grown-ups can change or turn off this delay).

## What's inside

- **120 hand-tuned campaign levels in 6 worlds**, then endless **Bonus Lots**:
  - ☀️ **Sunny Town:** first steps, small lots.
  - 🚚 **Truck Stop:** long 3-cell trucks.
  - 🌲 **Forest Park:** trees and bushes that never move.
  - 🐥 **Farm Friends:** ducks, piglets, chicks and puppies sit in the way. Tap them and they
    hop off with a quack, oink or woof.
  - ❄️ **Snowy Hills:** snowmen, penguins and falling snow.
  - 🌙 **Night City:** glowing headlights and the biggest lots.
- **Difficulty that ramps up slowly:** lots get bigger, more vehicles appear, and longer
  "this one first, then that one" chains build up. Every 5th level is a breather, and every
  10th is a bigger "boss" lot.
- **Every level can be solved.** The generator builds each lot so it can be cleared, and
  the build script checks this for every campaign level.
- **Surprise presents:** every few levels a gift box unlocks a new vehicle or paint job:
  - Vehicles: taxi, police car, race car, school bus, fire truck, ambulance, ice cream
    truck, tractor, garbage truck, jeep and cement mixer.
  - Paint jobs: polka dots, stripes, hearts, stars, flames, rainbow, gold and crowns.

  New items start appearing in the levels right away.
- **Garage:** tap any vehicle you've collected to hear its sound (siren, jingle, chug…) and
  its name.
- **Home screen toy:** the cars driving along the road honk and hop when tapped.
- Landscape and portrait both work, and the lot turns to fit the screen.

## Grown-ups area

**Press and hold the ⚙️ gear** on the home screen (about 2 seconds), then answer a simple sum.
In the grown-ups area you can:

- See progress: furthest level, levels completed, stars, vehicles cleared, time played
  today and in total, and the next surprise.
- Change sound: effects and music (each with volume), spoken cheers and vibration.
- Change play:
  - Helping-hand delay (off / 4s / 8s / 15s).
  - Car speed (slow / normal / fast).
  - Stars: "always 3" (gentle, the default) or "count bumps".
  - Calmer effects and hiding level numbers.
- Set a **session time limit** (10–60 min). When time is up, a sleepy "time for a rest"
  screen appears, and only a grown-up can continue.
- **Unlock all levels**, **unlock all vehicles**, or **jump to any level**.
- **Reset progress** or **reset settings**.

All data stays on the device in `localStorage`.

## Install / host

It's a static site with no build step. Serve the folder over **HTTPS** (or `localhost`):

```sh
python3 -m http.server 8123   # then open http://localhost:8123
```

**GitHub Pages:** `.github/workflows/pages.yml` deploys on every push to `main`. In the repo,
go to *Settings → Pages* and set *Source* to **GitHub Actions** first.

On the phone or tablet, open the site once while online. Then:
- iOS Safari: *Share → Add to Home Screen*.
- Android Chrome: *⋮ → Install app*.

After that it runs offline from the home screen. Tip: Guided Access (iOS) or screen
pinning (Android) keeps little hands inside the game.

## Development

```
index.html            screens + overlays
css/style.css         UI styling
js/main.js            app controller (screens, win flow, rewards, garage, play-time limit)
js/game.js            board engine: input, driving/bump animation, hints, rendering
js/draw.js            all vehicle / animal / obstacle artwork (canvas)
js/audio.js           Web Audio synthesized sound effects, music and spoken cheers
js/generator.js       level generator + solver (shared by browser and build script)
js/worlds.js          world themes and difficulty curve
js/levels-data.js     pre-generated campaign levels (built by tools/build-levels.mjs)
js/vehicles.js        vehicle catalogue + reward track
js/parent.js          grown-ups gate and settings panel
sw.js                 offline service worker (bump VERSION when files change)
tools/                level builder, icon renderer, headless smoke + offline tests
```

- `node tools/build-levels.mjs`: regenerates and checks the 120 campaign levels.
- `node tools/make-icons.mjs`: renders the PNG icons. Serve the repo on `:8123` first.
- `node tools/smoke-test.mjs [outDir]`: plays levels in headless Chromium and saves
  screenshots.
- `node tools/offline-test.mjs`: checks that the game loads and plays with the network off.

When you change any shipped file, bump `VERSION` in `sw.js` so installed copies update. The
next time the app launches, it picks up the new version.
