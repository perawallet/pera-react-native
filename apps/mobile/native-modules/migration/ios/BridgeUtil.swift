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

enum BridgeUtil {

    static func nullable(_ value: String?) -> Any {
        value ?? NSNull()
    }

    static func nullable(_ value: Bool?) -> Any {
        value.map { $0 as Any } ?? NSNull()
    }

    static func nullable(_ value: Int?) -> Any {
        value.map { $0 as Any } ?? NSNull()
    }

    static func nullable(_ value: Double?) -> Any {
        value.map { $0 as Any } ?? NSNull()
    }

    static func nullableBytes(_ bytes: Data?) -> Any {
        guard let bytes = bytes else { return NSNull() }
        return bytes.base64EncodedString()
    }

    static func longString(_ value: Int64?, sentinel: Int64? = nil) -> Any {
        guard let value = value else { return NSNull() }
        if let sentinel = sentinel, value == sentinel { return NSNull() }
        return String(value)
    }
}

struct BridgeMap {
    private(set) var dict: [String: Any] = [:]

    mutating func putString(_ key: String, _ value: String?) {
        dict[key] = BridgeUtil.nullable(value)
    }

    mutating func putBool(_ key: String, _ value: Bool?) {
        dict[key] = BridgeUtil.nullable(value)
    }

    mutating func putInt(_ key: String, _ value: Int?) {
        dict[key] = BridgeUtil.nullable(value)
    }

    mutating func putDouble(_ key: String, _ value: Double?) {
        dict[key] = BridgeUtil.nullable(value)
    }

    mutating func putBytes(_ key: String, _ value: Data?) {
        dict[key] = BridgeUtil.nullableBytes(value)
    }

    mutating func putLongString(_ key: String, _ value: Int64?, sentinel: Int64? = nil) {
        dict[key] = BridgeUtil.longString(value, sentinel: sentinel)
    }

    mutating func putRaw(_ key: String, _ value: Any) {
        dict[key] = value
    }
}
