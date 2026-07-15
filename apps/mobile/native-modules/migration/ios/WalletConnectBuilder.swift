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

enum WalletConnectBuilder {

    static func composeHistoryBlob(_ data: Data?) -> Any {
        guard let data = data else { return NSNull() }
        return data.base64EncodedString()
    }

    static func composeV1Sessions(_ entries: [SqliteReader.WCSessionListEntry]) -> [Any] {
        entries.map { entry -> [String: Any] in
            let session = entry.session
            var m = BridgeMap()
            m.putString("id", entry.topic)
            m.putRaw("peerMeta", composePeerMeta(session.peerMeta))
            m.putBool("isConnected", false)
            m.putBool("isSubscribed", session.isSubscribed ?? false)
            // Apple reference date (2001-01-01) -> Unix epoch ms.
            m.putLongString("dateTimestampMs", session.date.flatMap {
                Int64(exactly: (($0 + 978_307_200) * 1000).rounded())
            })
            m.putString("fallbackBrowserGroupResponse", nil)
            m.putRaw("connectedAccounts", session.walletMeta?.accounts ?? [String]())
            m.putString("sessionMetaJson", composeSessionMetaJson(session.urlMeta))
            m.putString("clientId", session.walletMeta?.peerId)
            m.putString("peerId", session.peerMeta?.id)
            m.putLongString("handshakeId", nil)
            m.putString("currentKey", nil)
            if let approved = session.walletMeta?.accounts {
                m.putRaw("approvedAccounts", approved)
            } else {
                m.putRaw("approvedAccounts", NSNull())
            }
            m.putInt("chainId", session.walletMeta?.chainId)
            return m.dict
        }
    }

    private static func composePeerMeta(_ peerMeta: SqliteReader.WCSessionBlob.PeerMeta?) -> [String: Any] {
        var m = BridgeMap()
        m.putString("name", peerMeta?.name ?? "")
        m.putString("url", peerMeta?.url ?? "")
        m.putString("description", peerMeta?.description ?? "")
        m.putRaw("icons", peerMeta?.icons ?? [String]())
        return m.dict
    }

    private static func composeSessionMetaJson(_ urlMeta: SqliteReader.WCSessionBlob.URLMeta) -> String {
        let payload: [String: Any] = [
            "bridge": urlMeta.bridge,
            "key": urlMeta.key,
            "topic": urlMeta.topic,
            "version": urlMeta.version,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return json
    }
}
