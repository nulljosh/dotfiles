import SwiftUI

struct SettingsView: View {
    @AppStorage("pwnlingoHost") private var host = "localhost:8737"
    @AppStorage("alwaysOnTop") private var alwaysOnTop = false

    var body: some View {
        Form {
            TextField("Mac address", text: $host)
            Toggle("Always on top", isOn: $alwaysOnTop)
        }
        .padding(20)
        .frame(width: 300)
    }
}
