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
import SQLite3

enum CoreDataStoreFixture {

    private static let transient = unsafeBitCast(
        -1,
        to: sqlite3_destructor_type.self
    )

    private static let createTablesSql = """
        CREATE TABLE ZAPPLICATIONCONFIGURATION (
            Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER,
            ZAUTHENTICATEDUSERDATA BLOB, ZPASSWORD VARCHAR
        );
        CREATE TABLE ZCONTACT (
            Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER,
            ZNAME VARCHAR, ZADDRESS VARCHAR, ZIMAGE BLOB
        );
        CREATE TABLE ZPASSKEY (
            Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER,
            ZLASTUSED TIMESTAMP, ZADDRESS VARCHAR, ZCREDENTIALID VARCHAR,
            ZDISPLAYNAME VARCHAR, ZORIGIN VARCHAR, ZUSERHANDLE VARCHAR,
            ZUSERNAME VARCHAR
        );
        """

    static func write(to storeURL: URL, includeUnroutable: Bool) throws {
        var handle: OpaquePointer?
        let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_NOMUTEX
        let rc = sqlite3_open_v2(storeURL.path, &handle, flags, nil)
        guard rc == SQLITE_OK, let db = handle else {
            let message = handle.flatMap { String(cString: sqlite3_errmsg($0)) }
                ?? "<no handle>"
            if let h = handle { sqlite3_close(h) }
            throw LegacyMigrationError.sqlite(
                "simulator open failed at \(storeURL.path): \(rc) \(message)"
            )
        }
        defer { sqlite3_close(db) }

        try exec(db, "PRAGMA journal_mode = DELETE;")
        try exec(db, createTablesSql)
        try insertUserBlob(db, includeUnroutable: includeUnroutable)
        try insertContacts(db)
        try insertPasskeys(db)
    }

    // MARK: - Inserts

    private static func insertUserBlob(_ db: OpaquePointer, includeUnroutable: Bool) throws {
        let stmt = try prepare(
            db,
            "INSERT INTO ZAPPLICATIONCONFIGURATION (Z_PK, Z_ENT, Z_OPT, ZAUTHENTICATEDUSERDATA) VALUES (1, 1, 1, ?);"
        )
        defer { sqlite3_finalize(stmt) }
        bindBlob(stmt, 1, try UserBlobFixture.buildBlobData(includeUnroutable: includeUnroutable))
        try step(db, stmt)
    }

    private static func insertContacts(_ db: OpaquePointer) throws {
        let stmt = try prepare(
            db,
            "INSERT INTO ZCONTACT (Z_ENT, Z_OPT, ZNAME, ZADDRESS, ZIMAGE) VALUES (1, 1, ?, ?, ?);"
        )
        defer { sqlite3_finalize(stmt) }
        for contact in FixtureIdentities.contacts {
            sqlite3_reset(stmt)
            sqlite3_clear_bindings(stmt)
            bindText(stmt, 1, contact.name.isEmpty ? nil : contact.name)
            bindText(stmt, 2, contact.address)
            bindBlob(stmt, 3, contact.imagePngBase64.flatMap { Data(base64Encoded: $0) })
            try step(db, stmt)
        }
    }

    private static func insertPasskeys(_ db: OpaquePointer) throws {
        let stmt = try prepare(
            db,
            """
            INSERT INTO ZPASSKEY
                (Z_ENT, Z_OPT, ZLASTUSED, ZADDRESS, ZCREDENTIALID,
                 ZDISPLAYNAME, ZORIGIN, ZUSERHANDLE, ZUSERNAME)
            VALUES (1, 1, ?, ?, ?, ?, ?, ?, ?);
            """
        )
        defer { sqlite3_finalize(stmt) }
        for passkey in FixtureIdentities.passkeys {
            sqlite3_reset(stmt)
            sqlite3_clear_bindings(stmt)
            bindDouble(stmt, 1, passkey.lastUsedSecondsSince2001)
            bindText(stmt, 2, passkey.address)
            bindText(stmt, 3, passkey.credentialId)
            bindText(stmt, 4, passkey.displayName)
            bindText(stmt, 5, passkey.origin)
            bindText(stmt, 6, passkey.userHandleBase64)
            bindText(stmt, 7, passkey.username)
            try step(db, stmt)
        }
    }

    // MARK: - sqlite helpers

    private static func exec(_ db: OpaquePointer, _ sql: String) throws {
        var errMsg: UnsafeMutablePointer<CChar>?
        if sqlite3_exec(db, sql, nil, nil, &errMsg) != SQLITE_OK {
            let message = errMsg.flatMap { String(cString: $0) } ?? "unknown"
            sqlite3_free(errMsg)
            throw LegacyMigrationError.sqlite("exec failed: \(message)")
        }
    }

    private static func prepare(_ db: OpaquePointer, _ sql: String) throws -> OpaquePointer {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK,
              let prepared = stmt else {
            throw LegacyMigrationError.sqlite(
                "prepare failed: \(String(cString: sqlite3_errmsg(db)))"
            )
        }
        return prepared
    }

    private static func step(_ db: OpaquePointer, _ stmt: OpaquePointer) throws {
        let rc = sqlite3_step(stmt)
        guard rc == SQLITE_DONE else {
            throw LegacyMigrationError.sqlite(
                "step failed rc=\(rc): \(String(cString: sqlite3_errmsg(db)))"
            )
        }
    }

    private static func bindText(_ stmt: OpaquePointer, _ idx: Int32, _ value: String?) {
        if let value = value {
            sqlite3_bind_text(stmt, idx, value, -1, transient)
        } else {
            sqlite3_bind_null(stmt, idx)
        }
    }

    private static func bindBlob(_ stmt: OpaquePointer, _ idx: Int32, _ data: Data?) {
        guard let data = data, !data.isEmpty else {
            sqlite3_bind_null(stmt, idx)
            return
        }
        data.withUnsafeBytes { raw in
            _ = sqlite3_bind_blob(stmt, idx, raw.baseAddress, Int32(data.count), transient)
        }
    }

    private static func bindDouble(_ stmt: OpaquePointer, _ idx: Int32, _ value: Double?) {
        if let value = value {
            sqlite3_bind_double(stmt, idx, value)
        } else {
            sqlite3_bind_null(stmt, idx)
        }
    }
}
