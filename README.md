# Nazara

See the view from your seat before you book. A working prototype of a 3D seat-preview booking screen, built for Indian cinema halls.

"Nazara" (नज़ारा) means "the view".

**Live demo:** https://divyamohanty.github.io/nazara-seat-view/

## What it does

- Renders the hall in 3D and puts the camera in any seat, so you see how big the screen looks and what is in front of you.
- Scores every seat out of 100 on three things: how much of your vision the screen fills, how far you tilt your neck, and how far off to the side you are.
- Shows the best open seat in each price class, so you can compare a ₹180 Classic seat with a ₹260 Prime one.
- Colours the whole hall by view quality. This is on when the page opens, so the good and bad seats are obvious straight away.
- Three sample halls: a mall multiplex (Classic / Prime / Recliner), an old single screen (Front Stalls / Rear Stalls / Balcony), and a large-format giant screen.

## The look

The panel is built around an Indian cinema ticket: thin coloured paper with one colour per class (pink, yellow, green), a perforated stub that carries the view score, and a rubber-stamp verdict. The same three colours mark each class on the seat map. Type is Rozha One for the wordmark and seat numbers and Hind for everything else, both from the Indian Type Foundry and both with Devanagari.

Two motion ideas are ported from [motion-primitives](https://github.com/ibelick/motion-primitives) (MIT) into plain JS in `src/motion.js`, since that kit is React and Tailwind: rolling digits on the score and stats, and a highlight that glides between hall tabs and best-seat rows. Motion is switched off for people who ask their device for reduced motion.

## The film on the screen

The screen plays a real trailer through YouTube's own embedded player, so nothing is downloaded or re-hosted. The player sits in a DOM layer behind the WebGL canvas, lined up in 3D with the cinema screen, and shows through a hole the screen cuts in the canvas. Seats and walls in front of it still cover it correctly. It uses the `youtube-nocookie.com` embed.

"Change film" takes any YouTube link, or a video file from your device (the file stays in your browser). `?yt=<link or id>` opens the page with a different trailer.

If YouTube cannot play a video here (some owners switch embedding off), the app falls back to the trailer for "Sintel" (© Blender Foundation, durian.blender.org, CC BY 3.0), which ships in `public/media/`. `?film=local` forces that.

The default trailer is set by `DEFAULT_TRAILER` in `src/main.js`.

## Run it

```bash
npm install
npm run dev
```

Then open the address it prints. To try it on your phone on the same Wi-Fi, run `npm run dev -- --host` and open the "Network" address.

`npm run deploy` rebuilds the site and publishes it to GitHub Pages (the `gh-pages` branch).

Links can open a specific view: `?hall=single&seat=H15`, `?hall=large&view=hall&heat=1`.

## What is real and what is not

- The halls are typical layouts for each format. They are not measurements of any real cinema.
- Sold seats are random. Prices are placeholders.
- "Book" does nothing. There is no payment or backend.
- The view score is a rule of thumb, tuned by eye. The thresholds live in `viewMetrics()` in `src/halls.js`.
- The view does not yet account for heads in front of you or a balcony overhang cutting off the top of the screen.

## Adding a real hall

Each hall is one object in `src/halls.js`. To model a real one you need, in metres:

- screen width, height, and height of its bottom edge above the front floor
- distance from the screen to the first row
- for each price class: number of rows, row spacing, how much each row steps up, seat width, and seats per block between aisles

Row A is the back row, as in most Indian halls. Letters I and O are skipped.

## Code

- `src/halls.js` — hall data, seat layout, view maths
- `src/scene.js` — the 3D hall (three.js), camera moves, seat picking
- `src/main.js` — panel, seat map, controls
- `src/motion.js` — rolling digits, gliding highlight
- `src/style.css` — styles
