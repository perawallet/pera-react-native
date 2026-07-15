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

enum ContactsBuilder {

    static func compose(rows: [SqliteReader.ContactRow]) -> [Any] {
        rows.map { row -> [String: Any] in
            var m = BridgeMap()
            m.putString("name", row.name)
            m.putString("address", row.address)
            m.putString("avatar", encodeAvatarAsDataURI(row.image))
            return m.dict
        }
    }

    private static func encodeAvatarAsDataURI(_ data: Data?) -> String? {
        guard let data = data, !data.isEmpty else { return nil }
        let mime: String
        if data.count >= 4,
           data[0] == 0x89, data[1] == 0x50, data[2] == 0x4E, data[3] == 0x47 {
            mime = "image/png"
        } else {
            mime = "image/jpeg"
        }
        return "data:\(mime);base64,\(data.base64EncodedString())"
    }
}
