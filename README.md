# Beep Beep Jam 🚗

An **ad-free 3D parking-lot puzzle**: tap the cars to drive them out of a packed lot in the
right order. It's an installable PWA that works **fully offline**, with no tracking, no
accounts and no purchases. All art, sounds and music are generated in code (three.js is
bundled in `vendor/`).

## How to play

Each vehicle can only drive the way it's facing. **Tap a vehicle**:
- If its way is clear, it pulls out onto the road around the lot and drives off.
- If something is in the way, it bumps into it and rolls back.

Clear the lot to finish the level. You earn 3 stars with at most one bump, 2 stars with up
to four bumps, and 1 star otherwise. The 💡 button shows a vehicle that can leave right now.

## What's inside

- **3D graphics:**
  - Glossy toy-style vehicles with reflections, soft shadows, rolling wheels and flashing
    sirens.
  - A road loop around every lot, which vehicles turn onto as they leave.
  - Themed scenery with houses, trees, cacti, a barn, snowy pines, a night city with
    headlights and street lamps, and falling snow.
- **180 campaign levels in 9 worlds**, then endless **Bonus Lots**:
  - ☀️ **Sunny Town**
  - 🚚 **Truck Stop:** long trucks.
  - 🌲 **Forest Park:** trees that never move.
  - 🐥 **Farm Friends:** animals sit in the way until you tap them.
  - ❄️ **Snowy Hills**
  - 🌙 **Night City**
  - 🏙️ **Downtown**, 🏖️ **Seaside** and 🏟️ **Mega Lot:** big lots that grow from 9×11
    (33 vehicles) to 15×19 (91 vehicles). Downtown has office towers; Seaside has palm
    trees, beach umbrellas and the sea.
- **Big lots:**
  - On big lots, pinch or scroll to zoom and drag to look around; the + / − / fit
    buttons do the same. A tap only counts if your finger doesn't move, so dragging never
    taps a car.
  - The hint pans to the car it points at.
  - Very big lots use lighter vehicle meshes and soft shadows to stay smooth on phones.
- **Closed exits (from about level 47):** parts of the lot's edge are blocked by hedges,
  fences, roadworks cones, no-entry signs, parking booths with boom gates or snowbanks.
  Red-and-white hatching marks each closed exit, and a car facing one can't leave that way.
- **Moving obstacles:**
  - From Farm Friends on, people stroll the footpath.
  - From Snowy Hills on, traffic drives the roads.

  Pull out while someone is passing and the car stops with a honk or a "hey!" (that counts
  as a bump), so time your taps. Leaving cars merge into the near lane, and traffic brakes
  for them.
- **Realistic style:** a Toy / Realistic switch in the Garage swaps in real-looking vehicle
  models (Kenney's Car Kit, CC0, bundled for offline play). Plain cars rotate through
  sedan, sports, hatchback, SUV and van bodies. The school bus, ice cream truck and cement
  mixer have no realistic version, so they stay toy-style.
- **Every level can be solved.** The generator builds each lot so it can be cleared, and
  tunes how long the "this one first" chains get.
- **Game feel:**
  - Vehicles bounce into the lot at the start of each level.
  - A red "!" marks whatever a car bumped into.
  - A live 3-star meter in the HUD drops as you bump.
  - Traffic drives around the home screen.
- **Daily Puzzle:** a new hard lot every day, plus a streak counter.
- **Unlocks:** presents along the way unlock 11 vehicles and 8 paint jobs (polka dots,
  flames, rainbow, gold, crowns…), which then start appearing in levels.
- **Garage:** view your collection on a 3D turntable.
- **Win screen:** stars, moves, bumps and time for each level.
- **Pause menu:** resume, restart, levels, settings or home.
- Landscape and portrait both work, and the lot turns to fit the screen.
- **Full screen:**
  - Starting a level goes full screen.
  - A ⛶ button on the home screen and in the pause menu toggles it.
  - If you leave full screen yourself, it isn't forced again until you tap the button.
  - The button hides where full screen isn't available: an iPhone browser, an embedded
    view, or the installed app (which is already full screen).
  - The automatic switch can be turned off in Settings.

## Settings

Tap **Settings** on the home screen, or in the pause menu. It covers:
- **Progress:** levels and stars, time played today and in total, and the next unlock.
- **Sound:** effects and music (each with volume), spoken cheers and vibration.
- **Kid mode:** cartoon faces, always 3 stars, slower cars, automatic hints and spoken
  cheers, all in one switch. Each of these can also be set on its own.
- **Gameplay:** automatic hint delay, car speed, star rules, calmer effects and level
  numbers.
- **Parental controls:**
  - **Lock settings:** a quick sum has to be answered before settings open.
  - **Play-time limit:** after 10–60 minutes, a "time for a rest" screen appears that only
    a grown-up can dismiss.
- **Levels & garage:** unlock all levels, unlock all vehicles, or jump to any level.
- **Reset:** progress or settings. Tap the button twice to confirm.

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
js/game.js            3D board: camera framing, input/raycasting, driving & bump animation, hints
js/models.js          procedural 3D vehicles, animals, obstacles and scenery
js/studio.js          turntable renderer for garage thumbnails and unlock reveals
js/draw.js            2D overlay helpers (hint hand, particle shapes)
vendor/               three.js r160 (MIT) + RoundedBoxGeometry, RoomEnvironment, BufferGeometryUtils
fonts/                Rubik (OFL)
models/carkit/        Kenney Car Kit glTF models (CC0, see License.txt) for the Realistic style
js/realistic.js       loads/fits the realistic models; falls back to toy models
js/audio.js           Web Audio synthesized sound effects, music and spoken cheers
js/generator.js       level generator + solver (shared by browser and build script)
js/worlds.js          world themes and difficulty curve
js/levels-data.js     pre-generated campaign levels (built by tools/build-levels.mjs)
js/vehicles.js        vehicle catalogue + reward track
js/parent.js          settings panel + optional grown-up check
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

## Credits

- Realistic vehicles: [Car Kit](https://kenney.nl/assets/car-kit) by Kenney (CC0).
- 3D engine: [three.js](https://threejs.org) (MIT). Font: Rubik (SIL OFL).
