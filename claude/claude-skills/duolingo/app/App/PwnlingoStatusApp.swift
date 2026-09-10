import SwiftUI

@main
struct PwnlingoStatusApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                #if os(macOS)
                .background(FloatingWindow())
                #endif
        }
        #if os(macOS)
        .windowResizability(.contentSize)
        #endif
        #if os(macOS)
        Settings { SettingsView() }
        #endif
    }
}

#if os(macOS)
// ponytail: SwiftUI has no window-level API — grab the NSWindow via a zero-size
// NSViewRepresentable and set it directly. .floating stays above normal windows
// but still yields to menus/fullscreen, unlike .statusBar/.popUpMenu levels.
// Re-reads @AppStorage on every body update so the Settings toggle takes effect live.
private struct FloatingWindow: NSViewRepresentable {
    @AppStorage("alwaysOnTop") private var alwaysOnTop = false
    func makeNSView(context: Context) -> NSView { NSView() }
    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async { nsView.window?.level = alwaysOnTop ? .floating : .normal }
    }
}
#endif
