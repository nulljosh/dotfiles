# Architecture doc accuracy sweep (2026-09-20)

Scope: all ~/Documents/Code/*/docs/ARCHITECTURE.md except joshuatree*. 55 docs checked.
Method: spot-checked 3-5 load-bearing claims per doc (stack, entry point, deploy target, DB/auth/external services, key numbers) against package.json/wrangler.toml/vercel.json/Package.swift/project.yml and named entry files. Swept every doc for em dashes.

## Per-repo results

authmail: clean
bank: clean
bcgd: clean
blockframe: clean
bookrank: clean
brain: clean
breathe: clean
cadence: clean
canlii-app: clean
conveyer: clean
conway: fixed em dash in intro line
costanza: clean
curbfind: clean
curvely: clean
dotfiles: clean
dream: clean
epiphany: clean
fieldbook: clean
gato: clean
hackrange: clean
healstack: clean
homeqi: clean
homeward: clean
hormuz: clean
inkpress: clean
journal: clean
keyrate: clean
lec: clean
lexly: clean
litigate: clean
logans-frenchies: clean
lucarne: clean
nimble: clean
notes: clean
nulljosh.github.io: clean
numen: clean
nyc: clean
plain: fixed em dash in "How it runs"
plan: clean
pwnlingo: clean
quotestreak: clean
roost: clean
seamark: clean
secretary: clean
sidewise: clean
siftbox: clean
sparkjar: clean
swing: clean
talli: clean (verified: package.json has both wrangler deploy scripts and an Express API script; doc's "Cloudflare Workers backend scraper" claim confirmed against wrangler.jsonc)
tripwire: clean
turing: clean
voxprint: clean
weather: clean
wordroot: clean

Notes on close calls that turned out fine (checked, not changed):
- blockframe: wrangler.toml project name is "wiretext" (legacy Cloudflare project, comment warns renaming breaks the custom domain) but code/doc consistently use blockframe/charwork as the product name. Not a doc error, just a known infra quirk.
- curvely: wrangler.toml name is "grapher" (same legacy-rename situation as blockframe). Doc correctly describes it as Curvely throughout.
- homeqi: doc explains the homeqi.heyitsmejosh.com domain is a DNS alias from the old fengshui.heyitsmejosh.com name. Confirmed accurate.
- siftbox: package.json/wrangler name is "sieve" (pre-rename), doc uses "Siftbox" throughout, matches current product name per memory.

## Reads too technical / jargon heavy

Repos whose intro or "How it runs" section leads with implementation detail a non-programmer visitor would bounce off of:

- **seamark**: opens with "A chart lives in four coordinate spaces at once: SVG user units, CSS pixels on the page, pixels within an iframe, and screenshot pixels if the image is scaled." No plain-English framing of what the tool is for before diving into coordinate-space math.
- **numen**: "The parser and evaluator are implemented twice: once in JavaScript and once in Swift, pinned to the same test fixtures so they never diverge." and "recursive-descent implementation supporting + - * / ^ ( )" read like an engineering spec, not a product description.
- **conway**: "toroidal (wrapping) grid," "flat Uint8Array... with double buffering," "modulo on each of the 8 neighbor reads" are all in the first two paragraphs before any plain description of what the app looks like to use.
- **tripwire**: "Monitors OpenAPI specs for breaking changes, diffs against your code, opens issues" assumes the reader already knows what an OpenAPI spec is.
- **cadence**: "the /contributions endpoint does not give commit counts, so these use /repositoryOwner and /search instead" is GitHub GraphQL internals in the product-level architecture summary.
- **secretary**: "HMAC-SHA1 without timestamp/replay protection" in the Gotchas section is fine for a dev doc but the "How it runs" section's TwiML/Gather/webhook signature language front-loads Twilio jargon before saying plainly what the product does for a caller.

## Counts

Clean: 53
Fixed: 2 (conway, plain — both em dash removals only)
