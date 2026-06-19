/*
 Copyright 2022-2025 Pera Wallet, LDA
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

    struct WCSessionBlob: Decodable {
        struct URLMeta: Decodable {
            let topic: String
            let version: String
            let bridge: String
            let key: String
        }
        struct PeerMeta: Decodable {
            let id: String?
            let name: String?
            let description: String?
            let icons: [String]?
            let url: String?
        }
        struct WalletMeta: Decodable {
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

    func readWalletConnectV1Sessions() -> [WCSessionListEntry] {
        guard let db = try? connection() else { return [] }
        let sql = "SELECT ZSESSIONS FROM ZWCSESSIONLIST LIMIT 1;"
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            return []
        }
        guard sqlite3_step(statement) == SQLITE_ROW,
              sqlite3_column_type(statement, 0) != SQLITE_NULL,
              let blob = sqlite3_column_blob(statement, 0) else {
            return []
        }
        let length = Int(sqlite3_column_bytes(statement, 0))
        let data = Data(bytes: blob, count: length)
        guard let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            return []
        }
        var entries: [WCSessionListEntry] = []
        for (topic, value) in root.sorted(by: { $0.key < $1.key }) {
            guard JSONSerialization.isValidJSONObject(value),
                  let valueData = try? JSONSerialization.data(withJSONObject: value),
                  let session = try? JSONDecoder().decode(WCSessionBlob.self, from: valueData) else {
                continue
            }
            entries.append(WCSessionListEntry(topic: topic, session: session))
        }
        return entries
    }
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
