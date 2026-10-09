"""Shared Liquid Glass look for every house diagram, on the Jaybulb Orchard tokens
(nulljosh.github.io/tokens.css): cream paper, warm ink, clay / leaf / gold, hairlines, SF.
Glass here is shape and layering, never gradients: capsules, translucent fills over a
tinted band, a bright inner edge, one soft warm shadow. Dark mode is a media query inside
the SVG, so a README <img> follows the viewer's theme.
ponytail: literal colours and classes, no CSS variables (librsvg ignores var()).
"""

def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

LIGHT = dict(bg="#f5f0e4", band="#ebe4d3", ink="#1f1b16", ink2="rgba(31,27,22,.6)", hair="#dcd2bd",
             glass="rgba(255,252,245,.66)", edge="rgba(255,255,255,.9)", line="rgba(31,27,22,.28)",
             clay="#b3461f", leaf="#4f6b34", gold="#8a6412", gold_fill="#ffca30", shadow="rgba(60,40,20,.10)")
DARK = dict(bg="#1c1a17", band="#26231f", ink="#f3ede0", ink2="rgba(243,237,224,.6)", hair="#3a352e",
            glass="rgba(70,63,54,.5)", edge="rgba(255,255,255,.16)", line="rgba(243,237,224,.3)",
            clay="#e07856", leaf="#8fb06a", gold="#ffca30", gold_fill="#ffca30", shadow="rgba(0,0,0,.35)")
NAMES = ("clay", "leaf", "gold", "ink")

def color(name):
    return name if name in NAMES else "clay"   # ponytail: legacy hex accents fall back to clay

def _css(p):
    r = [f".bg{{fill:{p['bg']}}}.band{{fill:{p['band']};fill-opacity:.6}}",
         f".t{{fill:{p['ink']}}}.t2{{fill:{p['ink2']}}}",
         f".glass{{fill:{p['glass']};stroke:{p['hair']}}}.edge{{fill:none;stroke:{p['edge']}}}",
         f".gate{{fill:{p['bg']};stroke:{p['ink']};stroke-width:1.5}}",
         f".ln{{stroke:{p['line']};fill:none}}.tip{{fill:{p['line']}}}.ink{{fill:{p['ink']}}}"]
    for n in NAMES:
        c = p[n]
        r.append(f".tint-{n}{{fill:{p.get(n + '_fill', c)};fill-opacity:{.2 if n == 'gold' else .15};stroke:{c};stroke-opacity:.6}}"
                 f".ln-{n}{{stroke:{c};stroke-opacity:.6;fill:none}}.f-{n}{{fill:{c}}}.t-{n}{{fill:{c}}}"
                 f".dash-{n}{{stroke:{c};fill:none;stroke-dasharray:4 3}}"
                 f".st-{n}{{fill:{p.get(n + '_fill', c)};fill-opacity:{.24 if n == 'gold' else .12};stroke:{c};stroke-opacity:.4}}"
                 f".flow-{n}{{stroke:{c};fill:none;stroke-width:2.2;stroke-linecap:round;stroke-dasharray:.1 15}}"
                 f".gl-{n}{{flood-color:{c};flood-opacity:.5}}")
    r.append(f".hollow{{fill:none;stroke:{p['ink']};stroke-width:1.2}}")
    return "".join(r)

def head(w, h):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'font-family="-apple-system,BlinkMacSystemFont,\'SF Pro Text\',\'Helvetica Neue\',Helvetica,Arial,sans-serif">'
            f'<style>{_css(LIGHT)}@media (prefers-color-scheme:dark){{{_css(DARK)}}}'
            f'[class^=flow-]{{animation:flow 1.4s linear infinite}}@keyframes flow{{to{{stroke-dashoffset:-15.1}}}}'
            f'.march{{animation:march .9s linear infinite}}@keyframes march{{to{{stroke-dashoffset:-14}}}}'
            f'@media (prefers-reduced-motion:reduce){{[class^=flow-],.march{{animation:none}}}}</style>'
            f'<defs><filter id="sh" x="-20%" y="-30%" width="140%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="rgb(60,40,20)" flood-opacity=".13"/></filter>'
            f'<filter id="sh1" x="-10%" y="-20%" width="120%" height="170%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="rgb(60,40,20)" flood-opacity=".12"/></filter>'
            + "".join(f'<filter id="gl-{n}" x="-30%" y="-70%" width="160%" height="240%"><feDropShadow dx="0" dy="0" stdDeviation="4" class="gl-{n}"/></filter>' for n in NAMES)
            + '</defs>'
            f'<rect class="bg" width="{w}" height="{h}"/>')

def card(x, y, w, h, r, cls="glass", shadow="sh"):
    """A glass node: filled shape, soft shadow, inner edge highlight."""
    return (f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" filter="url(#{shadow})"/>'
            f'<rect class="edge" x="{x + 1}" y="{y + 1}" width="{w - 2}" height="{h - 2}" rx="{max(r - 1, 0)}"/>')
