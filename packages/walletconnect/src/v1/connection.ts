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

import type { Connection } from '@perawallet/wallet-extension-connections'
import type { ConnectionHandler } from '@perawallet/wallet-core-connections'
import { readString } from '../shared/read'
import { walletConnectUriVersion } from '../shared/uri'

export const WALLET_CONNECT_V1_KIND = 'walletconnect-v1'

/** No session key here: it lives in the keystore behind `secretRef` (`./secrets`). */
export type WalletConnectV1Metadata = {
    bridge: string
    handshakeTopic: string
    peerId: string
    /** The v1 wire value, including the 4160 "any Algorand chain" wildcard. */
    chainId: number
    /**
     * JSON-RPC id of the approved handshake, used to recognise the bridge
     * replaying it after a socket flap. Optional only for records predating
     * it; importers must carry it, or every replay raises a spurious "repeat
     * connection request" error.
     */
    handshakeId?: number
    /** Approved methods (`algo_signTxn`, …). Absent reads as "unknown", never as "none". */
    permissions?: string[]
}

export type WalletConnectV1Connection = Connection & {
    kind: typeof WALLET_CONNECT_V1_KIND
    /** Required — the keystore entry holding the v1 session key. */
    secretRef: string
    metadata: WalletConnectV1Metadata
}

// dApps also emit bridge-less `wc://?…` focus signals; routing one into the v1 client throws.
export const isV1PairingUri = (uri: string): boolean =>
    walletConnectUriVersion(uri) === 1 && /[?&]bridge=[^&]+/.test(uri)

// Applied on every read: the registry hands over erased records, and persisted
// ones can be stale or half-migrated.
export const isWalletConnectV1Connection = (
    connection: Connection,
): connection is WalletConnectV1Connection => {
    if (connection.kind !== WALLET_CONNECT_V1_KIND) return false
    if (typeof connection.secretRef !== 'string') return false
    const metadata = connection.metadata
    if (typeof metadata !== 'object' || metadata === null) return false
    return (
        readString(metadata, 'bridge') !== undefined &&
        readString(metadata, 'handshakeTopic') !== undefined &&
        readString(metadata, 'peerId') !== undefined &&
        typeof metadata.chainId === 'number'
    )
}

/** The concrete handler, with the URI-pairing capabilities it declares made required. */
export type WalletConnectV1Handler =
    ConnectionHandler<WalletConnectV1Connection> &
        Required<
            Pick<
                ConnectionHandler<WalletConnectV1Connection>,
                'canHandleUri' | 'pair' | 'abandonPairing' | 'describeUri'
            >
        >
