import SwiftUI

private let tracks = ["es", "el", "math", "chess", "music"]
private let trackNames = ["es": "Spanish", "el": "Greek", "math": "Math", "chess": "Chess", "music": "Music"]
private let trackIcons = ["es": "quote.bubble.fill", "el": "character.book.closed.fill", "math": "function", "chess": "crown.fill", "music": "music.note"]

struct ContentView: View {
    @StateObject private var poller = Poller()
    #if os(macOS)
    @Environment(\.openSettings) private var openSettings
    #else
    @State private var editingHost = false
    #endif

    var body: some View {
        VStack(spacing: 14) {
            if let s = poller.state {
                Text(trackNames[s.track] ?? s.track.capitalized).font(.title2.bold())
                HStack(spacing: 14) {
                    ForEach(tracks, id: \.self) { t in
                        Button { poller.switchTrack(t) } label: {
                            Image(systemName: trackIcons[t] ?? "questionmark")
                                .font(.system(size: 16, weight: .semibold))
                                .frame(width: 34, height: 34)
                                .foregroundStyle(t == s.track ? .white : .secondary)
                                .background(t == s.track ? Color.accentColor : Color.clear, in: Circle())
                        }
                        .buttonStyle(.plain)
                        .help(trackNames[t] ?? t)
                    }
                }
                if let xp0 = s.xp0, let xp = s.xp {
                    Text("+\(xp - xp0) XP").font(.largeTitle.monospacedDigit().bold()).foregroundStyle(.green)
                }
                HStack(spacing: 28) {
                    if s.track == "chess" {
                        stat("Puzzles", s.puzzles)
                        stat("Misses", s.misses, tint: s.misses > 0 ? .red : nil)
                        stat("Matches", s.matches)
                    } else {
                        stat("Lessons", s.lessons)
                    }
                }
                Group {
                    if poller.stale {
                        Label("Stuck — no update in 90s+", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption).foregroundStyle(.red)
                    } else if let last = poller.events.first {
                        Text(last.summary).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
                .frame(height: 14)
            } else if poller.unreachable {
                Label("Can't reach \(poller.host)", systemImage: "wifi.slash").foregroundStyle(.red)
            } else {
                ProgressView()
            }
        }
        .padding(.top, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay(alignment: .topTrailing) {
            #if os(macOS)
            // ponytail: real Settings window (Cmd+, / menu bar) is the primary path now;
            // this stays as a quiet in-window shortcut to the same place.
            Button { openSettings() } label: { Image(systemName: "gearshape") }
                .buttonStyle(.plain)
                .padding(14)
            #else
            Button { editingHost = true } label: { Image(systemName: "gearshape") }
                .buttonStyle(.plain)
                .padding(14)
            #endif
        }
        .task { poller.start() }
        .frame(width: 320, height: 260)
        #if !os(macOS)
        .sheet(isPresented: $editingHost) {
            VStack(spacing: 12) {
                Text("Mac address").font(.headline)
                TextField("host:port", text: $poller.host).textFieldStyle(.roundedBorder)
                Button("Done") { editingHost = false; poller.reload() }
            }
            .padding()
            .frame(width: 260)
        }
        #endif
    }

    @ViewBuilder private func stat(_ label: String, _ value: Int, tint: Color? = nil) -> some View {
        VStack {
            Text("\(value)").font(.title3.monospacedDigit().bold()).foregroundStyle(tint ?? .primary)
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
    }
}
