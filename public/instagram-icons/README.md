# Line icons for Instagram-style UI (offline)

199 icons in a thin, rounded line style (24px grid, Lucide). Same file names and
`#bi-<name>` ids as the earlier set, so existing code keeps working - only the look changed.

- `svg/`          single SVG files (use as <img>; black only)
- `sprite.svg`    all icons as <symbol id="bi-name">
- `icons.css`     .bi (+ .bi-sm/md/lg/xl, .bi-thin/.bi-bold, .bi-fill, .create-btn)
- `preview.html`  searchable gallery
- `icons.json`    old name -> Lucide name

```html
<link rel="stylesheet" href="icons.css">
<svg class="bi bi-md"><use href="sprite.svg#bi-house-door"/></svg>
<svg class="bi bi-md bi-fill"><use href="sprite.svg#bi-heart"/></svg>   <!-- solid / liked -->
<button class="create-btn"><svg class="bi"><use href="sprite.svg#bi-plus-lg"/></svg></button>
```
Line thickness: set `--ic-stroke` (default 1.75) on :root or on one icon.
`<use href="sprite.svg#...">` needs http(s); on file:// paste the sprite into the page and use `href="#bi-name"`.
`-fill` icons are the same drawing, solid; inner details (e.g. a check) can disappear in solid mode.

Licenses: Lucide (ISC), Bootstrap Icons (MIT, used only for the Instagram logo).
