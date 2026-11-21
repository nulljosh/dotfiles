---
name: onboarding
description: Build a first-launch welcome screen in the Apple Stocks style - two-line "Welcome to / AppName" title, three feature rows, a privacy blurb, one Continue button - in SwiftUI or its web twin. Use for /onboarding, "welcome screen", "first launch screen", "onboarding splash", or when an app drops new users straight into an empty home screen.
---

# /onboarding

The model is Apple's Stocks welcome screen (`stocks-reference.png` in this folder). Super basic, simple, classic. Copy the structure, not the content. It shows once, after the animated launch splash and before the first real screen.

## Layout (top to bottom, leading aligned, 32pt side margins)
1. **Title**, two lines, `.largeTitle.bold()`: line 1 "Welcome to" in the app accent, line 2 the app name in `.primary`. It sits about a third of the way down, not centered vertically.
2. **Three feature rows**, 32pt apart, with the title 48pt above them. Each row: an SF Symbol in the accent (or a brand glyph), 44pt wide column, `.title` size, top aligned. Next to it a `.headline` title and a `.body` line in `.secondary`. Every title is 2 to 4 words and every body is one sentence, two lines max. Three rows, never four.
3. **Spacer.** The empty space is the design. Do not fill it.
4. **Privacy footer**, only if the app collects anything: a small accent glyph (`person.2.fill` style), then `.footnote` `.secondary` text saying plainly what is collected and why, then a `.footnote` accent link ("See how your data is managed…") to the privacy policy. If nothing is collected, say so in one line or drop the footer.
5. **Continue**: full-width capsule, 50 to 56pt tall, accent fill, white `.headline` label, 32pt side margins, sitting just above the home indicator.

## Rules
- System font only. Accent colour comes from the app's brand tokens. Dark and light both work, so use semantic colours.
- The rows say what the app really does today. No invented features, no sample data, no marketing fluff ("powerful", "seamless").
- No paging, no carousel, no skip button, no illustrations, no sign-in on this screen. One screen, one button.
- Show it once: `@AppStorage("hasSeenWelcome")`, set it to true on Continue. Present it as a full-screen cover over the real root view so Continue just dismisses it.
- Accessibility: the rows are combined elements (`.accessibilityElement(children: .combine)`), and the layout scrolls at accessibility text sizes (wrap the content above the button in a `ScrollView`, with the button pinned below).
- Web twin: same stack in plain HTML/CSS, `max-width: 440px`, `font: -apple-system`, `localStorage` flag in try/catch.

## SwiftUI skeleton
```swift
struct WelcomeView: View {
    @AppStorage("hasSeenWelcome") private var hasSeenWelcome = false
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 48) {
                    (Text("Welcome to\n").foregroundStyle(.tint) + Text("AppName"))
                        .font(.largeTitle.bold())
                    VStack(alignment: .leading, spacing: 32) {
                        row("chart.xyaxis.line", "Title", "One sentence about what it does.")
                        // two more rows
                    }
                }
                .padding(.top, 120)
            }
            .scrollBounceBehavior(.basedOnSize)
            // optional privacy footer here
            Button { hasSeenWelcome = true } label: {
                Text("Continue").font(.headline).frame(maxWidth: .infinity, minHeight: 50)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .padding(.bottom, 8)
        }
        .padding(.horizontal, 32)
    }

    private func row(_ symbol: String, _ title: String, _ body: String) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: symbol).font(.title).foregroundStyle(.tint).frame(width: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                Text(body).foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
```
Root: `.fullScreenCover(isPresented: .constant(!hasSeenWelcome)) { WelcomeView() }`, or an `if` in the root view.

## Done means
Screenshot it on a simulator in dark and light mode, next to `stocks-reference.png`, and check that it reads just as calm. Then delete the `hasSeenWelcome` flag and relaunch once to make sure it shows on a fresh install and is gone after Continue.
