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
@testable import WidgetCore

/// Answers URLSession.shared requests from a per-test route table, so the
/// fetchers run end to end without touching the network.
final class StubURLProtocol: URLProtocol {
    struct Response {
        let status: Int
        let body: String
    }

    private static let lock = NSLock()
    nonisolated(unsafe) private static var routes: [String: Response] = [:]
    nonisolated(unsafe) private static var recorded: [URLRequest] = []

    /// Keys are URL paths ("/v1/currencies/EUR/"); unknown paths answer 404.
    static func install(_ table: [String: Response]) {
        lock.withLock {
            routes = table
            recorded = []
        }
        URLProtocol.registerClass(StubURLProtocol.self)
    }

    static func uninstall() {
        URLProtocol.unregisterClass(StubURLProtocol.self)
    }

    static var requests: [URLRequest] { lock.withLock { recorded } }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let response = Self.lock.withLock { () -> Response in
            Self.recorded.append(request)
            return Self.routes[request.url?.path ?? ""] ?? Response(status: 404, body: "")
        }
        let http = HTTPURLResponse(url: request.url!, statusCode: response.status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: http, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(response.body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

func ok(_ body: String) -> StubURLProtocol.Response { .init(status: 200, body: body) }

let testFeed = WidgetSnapshot.PriceFeed(backendUrl: "https://api.test", apiKey: "test-key", currencyCode: "EUR")
let english = Locale(identifier: "en_US")
