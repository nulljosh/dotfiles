import Foundation
import Observation
import Network

@Observable
@MainActor
final class MacAppState {
    private enum Constants {
        static let dataCacheKey = "cached-app-data"
        static let lastSyncKey = "last-sync-date"
        static let appGroup = "group.com.jt.app" // TODO: change to your app group
    }

    var isAuthenticated = false
    var isLoading = false
    var errorMessage: String?
    var isOffline = false

    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "com.jt.app.mac.network")

    init() {
        startNetworkMonitoring()
    }

    deinit {
        monitor.cancel()
    }

    // MARK: - Auth

    func bootstrap() async {
        if let credentials = MacKeychainHelper.loadCredentials() {
            // Fast path: check if server session is still alive
            if let sessionValid = try? await MacAPIClient.shared.sessionCheck(), sessionValid {
                isAuthenticated = true
                // TODO: load your app data here
                return
            }
            // Slow path: full login
            await login(username: credentials.username, password: credentials.password, store: false)
        } else {
            errorMessage = "Sign in to continue."
        }
    }

    func login(username: String, password: String, store: Bool = true) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response = try await MacAPIClient.shared.login(username: username, password: password)
            guard response.success else {
                errorMessage = "Login failed. Check your credentials."
                return
            }
            isAuthenticated = true
            if store {
                MacKeychainHelper.saveCredentials(username: username, password: password)
            }
            // TODO: load your app data after login
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func logout() async {
        try? await MacAPIClient.shared.logout()
        isAuthenticated = false
        MacKeychainHelper.clearCredentials()
        clearCookies()
    }

    // MARK: - Widget Sync

    func syncToWidgets<T: Encodable>(_ data: T) {
        guard let defaults = UserDefaults(suiteName: Constants.appGroup) else { return }
        if let encoded = try? JSONEncoder().encode(data) {
            defaults.set(encoded, forKey: "widget_sync_data")
        }
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
        HTTPCookieStorage.shared.cookies?.forEach { HTTPCookieStorage.shared.deleteCookie($0) }
    }
}
