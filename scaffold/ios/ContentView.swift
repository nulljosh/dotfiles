import SwiftUI
import LocalAuthentication

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @State private var showSplash = true

    var body: some View {
        NavigationStack {
            Group {
                if appState.isAuthenticated {
                    AuthenticatedTabShell()
                } else {
                    LoginScreen()
                }
            }
        }
        .overlay {
            if showSplash {
                SplashView()
                    .transition(.opacity)
            }
        }
        .task {
            try? await Task.sleep(for: .milliseconds(800))
            withAnimation(.easeOut(duration: 0.4)) {
                showSplash = false
            }
        }
        .task {
            await appState.bootstrap()
        }
    }
}

// TODO: replace with your app's tabs
private struct AuthenticatedTabShell: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        TabView {
            Text("Home")
                .tabItem {
                    Label("Home", systemImage: "house")
                }
                .tag(0)

            Text("Settings")
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
                .tag(1)
        }
    }
}

private struct LoginScreen: View {
    @Environment(AppState.self) private var appState
    @State private var username = ""
    @State private var password = ""
    @State private var biometryType: LABiometryType = .none

    private var biometricLabel: String {
        biometryType == .faceID ? "Face ID" : "Touch ID"
    }

    private var biometricIcon: String {
        biometryType == .faceID ? "faceid" : "touchid"
    }

    var body: some View {
        VStack(spacing: 20) {
            Spacer()

            VStack(spacing: 10) {
                // TODO: replace with your app icon
                Image(systemName: "app")
                    .font(.system(size: 48))
                    .foregroundStyle(.tint)

                Text("App")
                    .font(.system(size: 42, weight: .bold))
                    .foregroundStyle(.primary)

                Text("Sign in to continue")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 12) {
                TextField("Username", text: $username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding()
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))

                SecureField("Password", text: $password)
                    .padding()
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            if biometryType != .none, appState.hasSavedBiometricCredentials() {
                Button {
                    Task {
                        await appState.biometricLogin()
                    }
                } label: {
                    Label("Sign in with \(biometricLabel)", systemImage: biometricIcon)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .fontWeight(.semibold)
                }
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .foregroundStyle(.tint)
            }

            Button {
                Task {
                    await appState.login(username: username, password: password)
                }
            } label: {
                HStack {
                    if appState.isLoading {
                        ProgressView()
                            .tint(.white)
                    }
                    Text("Login")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(.tint, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .foregroundStyle(.white)
            }
            .disabled(username.isEmpty || password.isEmpty || appState.isLoading)
            .opacity((username.isEmpty || password.isEmpty || appState.isLoading) ? 0.6 : 1)

            if let error = appState.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(Color.red.opacity(0.9))
                    .multilineTextAlignment(.center)
            }

            Spacer()
        }
        .padding(24)
        .navigationTitle("Sign In")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            biometryType = appState.biometricBiometryType()
        }
    }
}

private struct SplashView: View {
    var body: some View {
        VStack(spacing: 16) {
            // TODO: replace with your app icon
            Image(systemName: "app")
                .font(.system(size: 64))
                .foregroundStyle(.tint)

            Text("App")
                .font(.system(size: 38, weight: .bold))
                .foregroundStyle(.primary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }
}

#Preview {
    ContentView()
        .environment(AppState())
}
