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

enum PasskeysBuilder {

    static func compose(rows: [SqliteReader.PasskeyRow]) -> [Any] {
        rows.map { row -> [String: Any] in
            var m = BridgeMap()
            m.putString("credentialId", row.credentialId)
            m.putString("address", row.address)
            m.putString("siteUrl", row.origin)
            m.putString("siteName", nil)
            m.putString("userName", row.username)
            m.putString("userDisplayName", row.displayName)
            m.putString("userHandle", normalizeUserHandle(row.userHandle))
            if let coreSec = row.lastUsedSecondsSince2001 {
                let epoch1970Sec = coreSec + 978_307_200
                m.putLongString("lastUsedAtMs", Int64(epoch1970Sec * 1000))
            } else {
                m.putLongString("lastUsedAtMs", nil)
            }
            return m.dict
        }
    }

    private static func normalizeUserHandle(_ stored: String?) -> String? {
        guard let stored, !stored.isEmpty,
              let data = Data(base64Encoded: stored), !data.isEmpty else {
            return nil
        }
        return data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
