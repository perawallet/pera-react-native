/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */
import Foundation

/// The widget's requests to Pera's backends. Every fetcher goes through here, so every request is pinned
/// when the app shares pins.
enum PeraBackend {
    // WidgetKit gives a timeline request only a few seconds; give up early and
    // fall back to what the app last wrote.
    private static let timeout: TimeInterval = 8

    static func get<T: Decodable>(_ base: URL, _ path: String, _ feed: WidgetSnapshot.PriceFeed) async -> T? {
        await send(base, path, apiKey: feed.apiKey, pinning: feed.pinning, body: nil)
    }

    /// The inbox is a POST: the addresses travel in the body.
    static func post<T: Decodable, Body: Encodable>(
        _ base: URL, _ path: String, _ feed: WidgetSnapshot.PriceFeed, body: Body
    ) async -> T? {
        guard let data = try? JSONEncoder().encode(body) else { return nil }
        return await send(base, path, apiKey: feed.apiKey, pinning: feed.pinning, body: data)
    }

    /// Nil on any failure, a refused pin included.
    static func send<T: Decodable>(
        _ base: URL,
        _ path: String,
        apiKey: String,
        pinning: WidgetSnapshot.PriceFeed.Pinning?,
        body: Data?
    ) async -> T? {
        guard let url = URL(string: path, relativeTo: base.appendingPathComponent("")) else { return nil }
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !apiKey.isEmpty {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }
        if let body {
            request.httpMethod = "POST"
            request.httpBody = body
        }
        let pinned = pinning.flatMap { WidgetPinning.session(hashes: $0.publicKeyHashes, expiresAt: $0.expiresAt) }
        // A delegate session holds its delegate until invalidated.
        defer { pinned?.finishTasksAndInvalidate() }
        let session = pinned ?? .shared
        guard let (data, response) = try? await session.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200
        else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    // Amounts arrive as strings (or occasionally numbers); Decimal avoids float drift.
    static func decimal(_ value: FlexibleNumber?) -> Decimal? {
        switch value {
        case .string(let string): Decimal(string: string, locale: Locale(identifier: "en_US_POSIX"))
        case .number(let number): Decimal(number)
        case nil: nil
        }
    }
}

/// A JSON value the backend sends as either a string or a number.
enum FlexibleNumber: Decodable {
    case string(String)
    case number(Double)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            self = .string(string)
        } else {
            self = .number(try container.decode(Double.self))
        }
    }

    var stringValue: String {
        switch self {
        case .string(let string): string
        case .number(let number): String(format: "%.0f", number)
        }
    }
}

/// An id the backend sends as either a string or a number.
struct LooseString: Decodable, Equatable {
    let value: String

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            value = string
        } else {
            value = String(try container.decode(Int.self))
        }
    }
}

/// Decodes an element on its own, so one malformed row doesn't fail the whole page.
struct Lossy<T: Decodable>: Decodable {
    let value: T?

    init(from decoder: Decoder) throws {
        value = try? T(from: decoder)
    }
}

enum ISODate {
    private static let withFraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let plain = ISO8601DateFormatter()

    /// The backend writes microseconds on some rows and none on others, and
    /// the formatter doesn't take every fraction length, so a last attempt
    /// drops the fraction.
    static func parse(_ value: String?) -> Date? {
        guard let value else { return nil }
        if let date = withFraction.date(from: value) ?? plain.date(from: value) { return date }
        let trimmed = value.replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression)
        return plain.date(from: trimmed)
    }
}
