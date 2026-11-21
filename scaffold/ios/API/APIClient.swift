import Foundation

enum APIClientError: Error, LocalizedError {
    case unauthorized
    case serverError(Int)
    case invalidResponse
    case decodingError(Error)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Session expired. Please sign in again."
        case .serverError(let code):
            return "Server error (\(code))."
        case .invalidResponse:
            return "Invalid response from server."
        case .decodingError(let error):
            return "Failed to parse server response: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}

final class APIClient: @unchecked Sendable {
    static let shared = APIClient()

    // TODO: change to your app's URL
    // swiftlint:disable:next force_unwrapping
    private let baseURL = URL(string: "https://yourapp.heyitsmejosh.com")!
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    private init() {
        let configuration = URLSessionConfiguration.default
        configuration.httpCookieAcceptPolicy = .always
        configuration.httpShouldSetCookies = true
        configuration.httpCookieStorage = .shared
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 30

        session = URLSession(configuration: configuration)
    }

    func login(username: String, password: String) async throws -> LoginResponse {
        try await send(
            path: "api/login",
            method: "POST",
            body: LoginRequest(username: username, password: password),
            responseType: LoginResponse.self
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
        try await executeVoid(request)
    }

    // TODO: add your app-specific endpoints here
    // func fetchData() async throws -> MyData {
    //     try await send(path: "api/data", responseType: MyData.self)
    // }

    // MARK: - Generic send methods

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

        do {
            request.httpBody = try encoder.encode(body)
        } catch {
            throw APIClientError.decodingError(error)
        }

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
            throw APIClientError.networkError(error)
        }

        guard let response = urlResponse as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }

        switch response.statusCode {
        case 200...299:
            break
        case 401:
            throw APIClientError.unauthorized
        default:
            throw APIClientError.serverError(response.statusCode)
        }

        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw APIClientError.decodingError(error)
        }
    }

    private func executeVoid(_ request: URLRequest) async throws {
        let _: Data
        let urlResponse: URLResponse

        do {
            (_, urlResponse) = try await session.data(for: request)
        } catch {
            throw APIClientError.networkError(error)
        }

        guard let response = urlResponse as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }

        switch response.statusCode {
        case 200...299:
            return
        case 401:
            throw APIClientError.unauthorized
        default:
            throw APIClientError.serverError(response.statusCode)
        }
    }
}

struct LoginResponse: Decodable {
    let success: Bool
}

private struct LoginRequest: Encodable {
    let username: String
    let password: String
}
