# Roadmap

## Where the run stopped
Unit 202 level 2, "create the piecewise function". One draggable point sits at
(1, -2); the definition is `f(x) = 2x-1 for x<1, 1 for x>=1`, so it belongs at
(1, 1). There is no solver for building a piecewise graph yet — `curvePieces()`
reads branches but nothing places the open/closed endpoint.

## Open
- [ ] Piecewise construction: place the endpoint from the stated definition
- [ ] Revisit known-bad levels: 150 L4, 153 L4, 160 L3, 148 L3
- [ ] Dot plots and spinner wedges still need real OS mouse input
- [ ] Ledger (`localStorage.duoLedger`) is written but never exported; add a dump
      command so progress survives a browser profile reset
- [ ] Math runs to unit 411; ~200 units remain

## How to run it cheaply
The polling loop needs no reasoning — `duo.js` solves in the page. Run it in its
own small session on a cheap model, and only bring a stronger model in when a
question type has no solver. A long session re-sends its whole history on every
30-second poll, which is the expensive way to watch a status line.
