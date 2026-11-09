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

enum DeepLink {
    // URLQueryItem leaves `&`, `=` and `+` unescaped, and a backend id could carry them.
    private static let valueAllowed = CharacterSet.urlQueryAllowed.subtracting(CharacterSet(charactersIn: "&=+#"))

    /// A perawallet://app/ link with every query value percent-encoded; a nil value is left out.
    static func url(_ path: String, _ query: KeyValuePairs<String, String?> = [:]) -> URL? {
        var components = URLComponents()
        components.scheme = "perawallet"
        components.host = "app"
        components.path = "/" + path
        let items = query.compactMap { name, value in
            value.flatMap { $0.addingPercentEncoding(withAllowedCharacters: valueAllowed) }
                .map { URLQueryItem(name: name, value: $0) }
        }
        if !items.isEmpty {
            components.percentEncodedQueryItems = items
        }
        return components.url
    }

    /// One account opens that account; no account opens the portfolio drawer.
    static func portfolio(account: String?) -> URL? {
        guard let account else { return url("portfolio/") }
        return url("account-detail/", ["address": account])
    }

    /// One account opens its History tab; no account opens the portfolio drawer.
    static func transactions(account: String?) -> URL? {
        guard let account else { return url("portfolio/") }
        return url("account-detail/", ["address": account, "tab": "history"])
    }
}
