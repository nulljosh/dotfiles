import Foundation
import LocalAuthentication
import Network
import Observation

@Observable
@MainActor
final class AppState {
    private enum Constants {
        static let dataCacheKey = "cached-app-data"
        static let lastSyncKey = "last-sync-date"
    }

    var isAuthenticated = false
    var isLoading = false
    var errorMessage: String?
    var isOffline = false

    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "com.heyitsmejosh.app.network")

    private var storedCredentials: KeychainHelper.Credentials?

    init() {
        startNetworkMonitoring()
        storedCredentials = KeychainHelper.loadCredentials()
    }

    deinit {
        monitor.cancel()
    }

    // MARK: - Auth

    func bootstrap() async {
        // Fast path: check if server session is still alive (no external roundtrip)
        if let _ = storedCredentials {
            if let sessionValid = try? await APIClient.shared.sessionCheck(), sessionValid {
                isAuthenticated = true
                // TODO: load your app data here
                return
            }
        }

        // Slow path: full login
        if let credentials = storedCredentials {
            storedCredentials = nil
            if biometricBiometryType() != .none {
                do {
                    try await authenticateWithBiometrics()
                    await login(username: credentials.username, password: credentials.password, storeCredentials: false)
                } catch let error as LAError where error.code == .userCancel || error.code == .systemCancel || error.code == .appCancel {
                    errorMessage = nil
                } catch {
                    errorMessage = error.localizedDescription
                }
            } else {
                await login(username: credentials.username, password: credentials.password, storeCredentials: false)
            }
            return
        }

        errorMessage = "Please sign in."
    }

    func biometricBiometryType() -> LABiometryType {
        let context = LAContext()
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else {
            return .none
        }
        return context.biometryType
    }

    func hasSavedBiometricCredentials() -> Bool {
        KeychainHelper.loadCredentials() != nil
    }

    func biometricLogin() async {
        guard let credentials = KeychainHelper.loadCredentials() else {
            errorMessage = "No saved credentials found."
            return
        }

        do {
            try await authenticateWithBiometrics()
            await login(username: credentials.username, password: credentials.password, storeCredentials: false)
        } catch let error as LAError where error.code == .userCancel || error.code == .systemCancel || error.code == .appCancel {
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func login(username: String, password: String, storeCredentials: Bool = true) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response = try await APIClient.shared.login(username: username, password: password)
            guard response.success else {
                isAuthenticated = false
                errorMessage = "Login failed. Check your credentials."
                return
            }

            isAuthenticated = true
            if storeCredentials {
                KeychainHelper.saveCredentials(username: username, password: password)
            }

            // TODO: load your app data after login
        } catch {
            isAuthenticated = false
            errorMessage = error.localizedDescription
        }
    }

    func logout() async {
        isLoading = true
        defer { isLoading = false }

        try? await APIClient.shared.logout()
        isAuthenticated = false
        KeychainHelper.clearCredentials()
        clearCookies()
    }

    // MARK: - Cache helpers

    static func cache<T: Encodable>(_ value: T, forKey key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    static func loadCached<T: Decodable>(_ type: T.Type, forKey key: String) -> T? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    // MARK: - Private

    private func startNetworkMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.isOffline = path.status != .satisfied
            }
        }
        monitor.start(queue: monitorQueue)
    }

    private func clearCookies() {
        guard let cookies = HTTPCookieStorage.shared.cookies else { return }
        for cookie in cookies {
            HTTPCookieStorage.shared.deleteCookie(cookie)
        }
    }

    private func authenticateWithBiometrics() async throws {
        let context = LAContext()
        try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Sign in")
    }
}
