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
// Use the system SQLite3 module, not a bridging-header `#import <sqlite3.h>` which resolves ambiguously against expo-sqlite's vendored header.
import SQLite3

final class SqliteReader {

    private var db: OpaquePointer?
    private let storeURL: URL

    init(storeURL: URL) {
        self.storeURL = storeURL
    }

    deinit {
        if let db = db {
            sqlite3_close(db)
        }
    }

    private static func sqliteError(_ context: String, _ db: OpaquePointer) -> LegacyMigrationError {
        let primary = Int(sqlite3_errcode(db))
        let extended = Int(sqlite3_extended_errcode(db))
        let message = String(cString: sqlite3_errmsg(db))
        return .sqlite("\(context) [code=\(primary) extended=\(extended)] \(message)")
    }

    func open() throws {
        _ = try connection()
    }

    private func connection() throws -> OpaquePointer {
        if let db = db { return db }
        var handle: OpaquePointer?
        let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_NOMUTEX
        let result = sqlite3_open_v2(storeURL.path, &handle, flags, nil)
        guard result == SQLITE_OK, let opened = handle else {
            let message = handle.flatMap { String(cString: sqlite3_errmsg($0)) } ?? "<no handle>"
            if let h = handle { sqlite3_close(h) }
            throw LegacyMigrationError.sqlite(
                "sqlite3_open_v2 failed at \(storeURL.path): \(result) \(message)"
            )
        }
        if sqlite3_exec(opened, "PRAGMA query_only = ON;", nil, nil, nil) != SQLITE_OK {
            let error = Self.sqliteError("PRAGMA query_only failed", opened)
            sqlite3_close(opened)
            throw error
        }
        self.db = opened
        return opened
    }

    func readAuthenticatedUserData() throws -> Data? {
        let db = try connection()
        let sql = "SELECT ZAUTHENTICATEDUSERDATA FROM ZAPPLICATIONCONFIGURATION LIMIT 1;"
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw Self.sqliteError("prepare ZAUTHENTICATEDUSERDATA failed", db)
        }
        let stepResult = sqlite3_step(statement)
        if stepResult == SQLITE_DONE {
            return nil
        }
        guard stepResult == SQLITE_ROW else {
            throw Self.sqliteError("step ZAUTHENTICATEDUSERDATA returned \(stepResult)", db)
        }
        if sqlite3_column_type(statement, 0) == SQLITE_NULL {
            return nil
        }
        guard let blob = sqlite3_column_blob(statement, 0) else { return nil }
        let length = Int(sqlite3_column_bytes(statement, 0))
        return Data(bytes: blob, count: length)
    }

    // MARK: - Contacts

    struct ContactRow {
        let name: String
        let address: String
        let image: Data?
    }

    func readContacts() throws -> [ContactRow] {
        let db = try connection()
        let sql = "SELECT ZNAME, ZADDRESS, ZIMAGE FROM ZCONTACT;"
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw Self.sqliteError("prepare ZCONTACT failed", db)
        }
        var rows: [ContactRow] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            let name = sqlite3_column_text(statement, 0).flatMap { String(cString: $0) } ?? ""
            let address = sqlite3_column_text(statement, 1).flatMap { String(cString: $0) } ?? ""
            var image: Data?
            if sqlite3_column_type(statement, 2) != SQLITE_NULL,
               let blob = sqlite3_column_blob(statement, 2) {
                let length = Int(sqlite3_column_bytes(statement, 2))
                if length > 0 {
                    image = Data(bytes: blob, count: length)
                }
            }
            if !address.isEmpty {
                rows.append(ContactRow(name: name, address: address, image: image))
            }
        }
        return rows
    }

    // MARK: - Passkeys

    struct PasskeyRow {
        let address: String
        let credentialId: String
        let origin: String
        let username: String?
        let displayName: String?
        let userHandle: String?
        let lastUsedSecondsSince2001: Double?
    }

    func readPasskeys() throws -> [PasskeyRow] {
        let db = try connection()
        let sql = """
            SELECT ZADDRESS, ZCREDENTIALID, ZORIGIN, ZUSERNAME, ZDISPLAYNAME,
                   ZUSERHANDLE, ZLASTUSED
              FROM ZPASSKEY;
            """
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw Self.sqliteError("prepare ZPASSKEY failed", db)
        }
        var rows: [PasskeyRow] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            let address = sqlite3_column_text(statement, 0).flatMap { String(cString: $0) } ?? ""
            let credentialId = sqlite3_column_text(statement, 1).flatMap { String(cString: $0) } ?? ""
            let origin = sqlite3_column_text(statement, 2).flatMap { String(cString: $0) } ?? ""
            let username = sqlite3_column_text(statement, 3).flatMap { String(cString: $0) }
            let displayName = sqlite3_column_text(statement, 4).flatMap { String(cString: $0) }
            let userHandle = sqlite3_column_text(statement, 5).flatMap { String(cString: $0) }
            var lastUsed: Double?
            if sqlite3_column_type(statement, 6) != SQLITE_NULL {
                lastUsed = sqlite3_column_double(statement, 6)
            }
            if !credentialId.isEmpty {
                rows.append(PasskeyRow(
                    address: address,
                    credentialId: credentialId,
                    origin: origin,
                    username: username,
                    displayName: displayName,
                    userHandle: userHandle,
                    lastUsedSecondsSince2001: lastUsed
                ))
            }
        }
        return rows
    }

    // MARK: - WalletConnect history blob

    func readWalletConnectHistoryBlob() throws -> Data? {
        let db = try connection()
        let sql = "SELECT ZSESSIONHISTORY FROM ZWCSESSIONHISTORY LIMIT 1;"
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            return nil
        }
        guard sqlite3_step(statement) == SQLITE_ROW,
              sqlite3_column_type(statement, 0) != SQLITE_NULL,
              let blob = sqlite3_column_blob(statement, 0) else {
            return nil
        }
        let length = Int(sqlite3_column_bytes(statement, 0))
        return Data(bytes: blob, count: length)
    }

    // MARK: - WalletConnect v1 live sessions

    /// Hand-parsed rather than `Decodable` on purpose: a synthesized `Decodable`
    /// throws for the whole session when *any* field disagrees on JSON type —
    /// including the optional ones, since Swift's `decodeIfPresent` forgives a
    /// missing key but not a wrong type. Pera 6 wrote these blobs over several
    /// years and dApp SDK versions, so one session storing `chainId` as a string
    /// or `accounts` as a comma-joined list would take the whole row down while
    /// its siblings migrated fine. See PERA-4787.
    struct WCSessionBlob {
        struct URLMeta {
            let topic: String
            let version: String
            let bridge: String
            let key: String
        }
        struct PeerMeta {
            let id: String?
            let name: String?
            let description: String?
            let icons: [String]?
            let url: String?
        }
        struct WalletMeta {
            let accounts: [String]?
            let chainId: Int?
            let peerId: String?
        }
        let urlMeta: URLMeta
        let peerMeta: PeerMeta?
        let walletMeta: WalletMeta?
        /// Seconds since 2001-01-01 (Apple reference date), NOT Unix epoch.
        let date: Double?
        let isSubscribed: Bool?
    }

    struct WCSessionListEntry {
        let topic: String
        let session: WCSessionBlob
    }

    /// Every bail-out here yields an empty list, which the migration cannot
    /// tell apart from "the user had no sessions" — so each one logs. Session
    /// secrets (bridge URL, encryption key) are never logged; topics are, as
    /// they are the only handle for correlating a lost row (PERA-4787).
    func readWalletConnectV1Sessions() -> [WCSessionListEntry] {
        let log = LegacyMigrationConstants.logTag
        guard let db = try? connection() else {
            NSLog("[%@] WC v1: legacy store did not open", log)
            return []
        }
        // No LIMIT: Core Data models this as a single session-list row, but if
        // an install ever holds more than one, reading an arbitrary one would
        // lose whole dApps silently — which is this bug's exact signature.
        let sql = "SELECT ZSESSIONS FROM ZWCSESSIONLIST;"
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            NSLog("[%@] WC v1: ZWCSESSIONLIST is not readable", log)
            return []
        }

        var entries: [WCSessionListEntry] = []
        var rowCount = 0
        var decodedRows = 0
        while sqlite3_step(statement) == SQLITE_ROW {
            rowCount += 1
            guard sqlite3_column_type(statement, 0) != SQLITE_NULL,
                  let blob = sqlite3_column_blob(statement, 0) else {
                NSLog("[%@] WC v1: ZSESSIONS blob %ld is null", log, rowCount)
                continue
            }
            let length = Int(sqlite3_column_bytes(statement, 0))
            let data = Data(bytes: blob, count: length)
            guard let root = (try? JSONSerialization.jsonObject(with: data))
                    as? [String: Any] else {
                NSLog("[%@] WC v1: ZSESSIONS blob %ld is not a JSON object", log, rowCount)
                continue
            }
            decodedRows += 1
            for (topic, value) in root.sorted(by: { $0.key < $1.key }) {
                guard let session = parseWCSessionBlob(value) else {
                    // Reachable when `urlMeta` is absent/not an object, or any
                    // of bridge/key/topic is missing or not a string. Such a
                    // row could not have worked in Pera 6 either, but it must
                    // not vanish without a trace.
                    NSLog("[%@] WC v1: dropped session %@, no usable urlMeta", log, topic)
                    continue
                }
                entries.append(WCSessionListEntry(topic: topic, session: session))
            }
        }

        if rowCount == 0 {
            NSLog("[%@] WC v1: ZWCSESSIONLIST is empty", log)
        } else if decodedRows > 1 {
            NSLog("[%@] WC v1: merged %ld session-list rows", log, decodedRows)
        }
        return entries
    }
}

// MARK: - Tolerant WalletConnect v1 blob parsing

/// Strings only. Coercing a number or bool here would be worse than useless:
/// JSON booleans bridge to `NSNumber`, so `true` would become `"1"` and could
/// manufacture a plausible-looking `bridge`/`key`/`topic` where rejecting the
/// field is correct. Tolerance comes from parsing each field independently, not
/// from inventing values.
private func jsonString(_ value: Any?) -> String? { value as? String }

/// Exact integers only — a truncated `4160.7` would land on the `all`
/// wildcard, and `intValue` wraps silently past `Int` range.
private func jsonInt(_ value: Any?) -> Int? {
    switch value {
    case let number as NSNumber: return Int(exactly: number.doubleValue)
    case let string as String: return Int(string)
    default: return nil
    }
}

private func jsonDouble(_ value: Any?) -> Double? {
    switch value {
    case let number as NSNumber: return number.doubleValue
    case let string as String: return Double(string)
    default: return nil
    }
}

private func jsonBool(_ value: Any?) -> Bool? {
    switch value {
    case let number as NSNumber: return number.boolValue
    case let string as String: return ["1", "true", "yes"].contains(string.lowercased())
    default: return nil
    }
}

/// Accepts a JSON array, and also a single comma-joined string — some legacy
/// WC v1 client builds persisted account lists that way. Non-string elements
/// are dropped rather than failing the whole session, so the result may be
/// shorter than the input; that is logged, because a session importing with
/// fewer approved accounts than the dApp holds looks like a live connection
/// that inexplicably refuses one address.
private func jsonStringArray(_ value: Any?, field: String) -> [String]? {
    if let array = value as? [Any] {
        let strings = array.compactMap { jsonString($0) }
        if strings.count != array.count {
            NSLog(
                "[%@] WC v1: dropped %ld non-string %@ entries",
                LegacyMigrationConstants.logTag,
                array.count - strings.count,
                field
            )
        }
        return strings
    }
    if let joined = value as? String {
        // A bare string here is a comma-joined list; an icon URL containing a
        // comma (a data: URI) splits into junk, which costs a broken icon
        // rather than a lost session.
        let parts = joined
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts
    }
    return nil
}

/// Empty strings are deliberately passed through rather than rejected: the JS
/// migrator classifies them as `missing-bridge`/`missing-topic`/`missing-key`
/// and logs the legacy row id and dApp name with the reason, which is strictly
/// more diagnostic than dropping the row here where neither is known.
private func parseWCURLMeta(_ value: Any?) -> SqliteReader.WCSessionBlob.URLMeta? {
    guard let dict = value as? [String: Any],
          let topic = jsonString(dict["topic"]),
          let bridge = jsonString(dict["bridge"]),
          let key = jsonString(dict["key"]) else {
        return nil
    }
    // `version` is echoed into the bridged `sessionMetaJson` but no JS consumer
    // parses it (`parseSessionMeta` reads only bridge/key/topic, and
    // `WalletConnectConnection.version` is hardcoded to 1), so a missing one
    // must never cost us the session.
    return SqliteReader.WCSessionBlob.URLMeta(
        topic: topic,
        version: jsonString(dict["version"]) ?? "1",
        bridge: bridge,
        key: key
    )
}

private func parseWCPeerMeta(_ value: Any?) -> SqliteReader.WCSessionBlob.PeerMeta? {
    guard let dict = value as? [String: Any] else { return nil }
    return SqliteReader.WCSessionBlob.PeerMeta(
        id: jsonString(dict["id"]),
        name: jsonString(dict["name"]),
        description: jsonString(dict["description"]),
        icons: jsonStringArray(dict["icons"], field: "icons"),
        url: jsonString(dict["url"])
    )
}

private func parseWCWalletMeta(_ value: Any?) -> SqliteReader.WCSessionBlob.WalletMeta? {
    guard let dict = value as? [String: Any] else { return nil }
    return SqliteReader.WCSessionBlob.WalletMeta(
        accounts: jsonStringArray(dict["accounts"], field: "accounts"),
        chainId: jsonInt(dict["chainId"]),
        peerId: jsonString(dict["peerId"])
    )
}

private func parseWCSessionBlob(_ value: Any) -> SqliteReader.WCSessionBlob? {
    guard let dict = value as? [String: Any],
          let urlMeta = parseWCURLMeta(dict["urlMeta"]) else {
        return nil
    }
    return SqliteReader.WCSessionBlob(
        urlMeta: urlMeta,
        peerMeta: parseWCPeerMeta(dict["peerMeta"]),
        walletMeta: parseWCWalletMeta(dict["walletMeta"]),
        date: jsonDouble(dict["date"]),
        isSubscribed: jsonBool(dict["isSubscribed"])
    )
}

enum LegacyMigrationError: Error, LocalizedError {
    case sqlite(String)
    case decode(String)
    case keychain(OSStatus, String)
    case simulator(String)

    var errorDescription: String? {
        switch self {
        case .sqlite(let msg):       return "[Migration:sqlite] \(msg)"
        case .decode(let msg):       return "[Migration:decode] \(msg)"
        case .keychain(let status, let msg):
            return "[Migration:keychain] OSStatus=\(status) \(msg)"
        case .simulator(let msg):    return "[Migration:simulator] \(msg)"
        }
    }
}
