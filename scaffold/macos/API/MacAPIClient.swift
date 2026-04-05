import Foundation

enum MacAPIError: Error, LocalizedError {
    case unauthorized
    case serverError(Int)
    case invalidResponse
    case decodingError(Error)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Session expired. Please sign in again."
        case .serverError(let code): return "Server error (\(code))."
        case .invalidResponse: return "Invalid response from server."
        case .decodingError(let error): return "Parse error: \(error.localizedDescription)"
        case .networkError(let error): return "Network error: \(error.localizedDescription)"
        }
    }
}

final class MacAPIClient: @unchecked Sendable {
    static let shared = MacAPIClient()

    // TODO: change to your app's URL
    // swiftlint:disable:next force_unwrapping
    private let baseURL = URL(string: "https://yourapp.heyitsmejosh.com")!
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    private init() {
        let config = URLSessionConfiguration.default
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.httpCookieStorage = .shared
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        session = URLSession(configuration: config)
    }

    func login(username: String, password: String) async throws -> MacLoginResponse {
        try await send(
            path: "api/login",
            method: "POST",
            body: MacLoginRequest(username: username, password: password),
            responseType: MacLoginResponse.self
        )
    }

    func sessionCheck() async throws -> Bool {
        var request = URLRequest(url: baseURL.appending(path: "api/session-check"))
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (_, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { return false }
        return http.statusCode == 200
    }

    func logout() async throws {
        var request = URLRequest(url: baseURL.appending(path: "api/logout"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (_, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else { return }
    }

    // TODO: add your app-specific endpoints here

    private func send<Response: Decodable>(
        path: String,
        method: String = "GET",
        responseType: Response.Type
    ) async throws -> Response {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return try await execute(request, responseType: responseType)
    }

    private func send<Body: Encodable, Response: Decodable>(
        path: String,
        method: String,
        body: Body,
        responseType: Response.Type
    ) async throws -> Response {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)
        return try await execute(request, responseType: responseType)
    }

    private func execute<Response: Decodable>(
        _ request: URLRequest,
        responseType: Response.Type
    ) async throws -> Response {
        let data: Data
        let urlResponse: URLResponse

        do {
            (data, urlResponse) = try await session.data(for: request)
        } catch {
            throw MacAPIError.networkError(error)
        }

        guard let http = urlResponse as? HTTPURLResponse else {
            throw MacAPIError.invalidResponse
        }

        switch http.statusCode {
        case 200...299: break
        case 401: throw MacAPIError.unauthorized
        default: throw MacAPIError.serverError(http.statusCode)
        }

        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw MacAPIError.decodingError(error)
        }
    }
}

struct MacLoginResponse: Decodable {
    let success: Bool
}

private struct MacLoginRequest: Encodable {
    let username: String
    let password: String
}
