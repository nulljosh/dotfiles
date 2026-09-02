# Working on this solver

## The one rule that matters: don't stack wrappers

`duo.js` grew by appending `const base = __duo.foo; __duo.foo = ...` blocks.
Thirty-plus deep chains have accumulated on `autoDrag`, `typeAnswer` and
`plan()`. When a fix "doesn't take", or two behaviours both fire and undo each
other, an older wrapper is still in the chain. **Delete the stale block. Never
layer another one on top of it.** Now that this is a git repo, delete freely —
history is recoverable.

## Traps that keep costing time

- `plan()` is checked BEFORE the multiple-choice branch in `run2`. Any plan
  returned on a screen that is really multiple-choice means the question never
  gets answered.
- Duolingo leaves earlier questions' diagram iframes in the DOM. Always use
  `visibleFrame()`; the first iframe is usually the previous question's.
- `diagramLabels()` returns FRAME-LOCAL rects. Anything compared against them
  must be frame-local too.
- SVG geometry is in USER units. Map it with `getScreenCTM()`, never by adding
  the element's bounding rect — that ignores the viewBox scale.
- `\frac{a}{b}` must become `(a)/(b)` BEFORE braces are stripped, or it
  flattens to the ambiguous `fracab`.
- `\pi` cancels on both sides of these equations, so set it to 1 on both — but
  substituting `*1` strands a leading `*`; strip operators at a boundary.
- Choice `innerText` is doubled ("kitekite"). Use `__duo.half()`.
- The solid in a geometry question is usually never named in text. Infer it:
  a curved outline means a round solid, and a single labelled edge means a
  sphere.
- `\duodisplay{max}{value}` is a slider; `\duoblank{n}` is a typed answer.

## Testing a change

Reload the solver in the page and call the new function directly before
restarting the loop:

```js
try { delete window.__duo; } catch (e) {}
const src = await (await fetch('http://127.0.0.1:8777/duo.js', {cache:'no-store'})).text();
(0, eval)(src);
await __duo.solveWhatever();
```

`node --check scripts/duo.js` after every edit. Commit each working family with
a message that says what the question looked like.
