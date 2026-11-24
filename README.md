# Nazara

See the view from your seat before you book. A working prototype of a 3D seat-preview booking screen, built for Indian cinema halls.

"Nazara" (नज़ारा) means "the view".

## What it does

- Renders the hall in 3D and puts the camera in any seat, so you see how big the screen looks and what is in front of you.
- Scores every seat out of 100 on three things: how much of your vision the screen fills, how far you tilt your neck, and how far off to the side you are.
- Shows the best open seat in each price class, so you can compare a ₹180 Classic seat with a ₹260 Prime one.
- Colours the whole hall by view quality with one switch.
- Three sample halls: a mall multiplex (Classic / Prime / Recliner), an old single screen (Front Stalls / Rear Stalls / Balcony), and a large-format giant screen.

## Run it

```bash
npm install
npm run dev
```

Then open the address it prints. To try it on your phone on the same Wi-Fi, run `npm run dev -- --host` and open the "Network" address.

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
- `src/style.css` — styles
