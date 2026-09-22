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
import { isStringArray, readString } from '../shared/read'
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
     * JSON-RPC id of the approved handshake, used to recognise the bridge replaying
     * it after a socket flap. Importers must carry it, or every replay raises a
     * spurious "repeat connection request" error.
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

/**
 * The `bridge=` value the SDK will actually dial, or null when unreadable.
 * Read exactly the way the SDK reads it — `URLSearchParams` over the query,
 * then a second `decodeURIComponent` — because anything this validates but
 * the SDK resolves differently is a bypass. A duplicate `bridge=` is refused
 * outright: the SDK's parser keeps the last one, so a URI carrying both an
 * https and an http bridge would be checked on one host and dialed on the
 * other.
 */
export const bridgeUrlFromV1Uri = (uri: string): string | null => {
    const queryStart = uri.indexOf('?')
    if (queryStart === -1) return null
    const values = new URLSearchParams(uri.slice(queryStart + 1)).getAll(
        'bridge',
    )
    if (values.length !== 1 || !values[0]) return null
    try {
        return decodeURIComponent(values[0])
    } catch {
        return null
    }
}

const LOOPBACK_HOSTNAME =
    /^(?:localhost|\[::1\]|127(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})$/

/**
 * The connector dials the bridge from its constructor, before any approval.
 * The URI key never crosses the bridge, but cleartext exposes topic ids,
 * client metadata and message timing and size, and lets an on-path attacker
 * drop or replay frames. Loopback never leaves the device.
 */
export const isSecureBridgeUrl = (bridge: string): boolean => {
    let url: URL
    try {
        url = new URL(bridge)
    } catch {
        return false
    }
    if (url.protocol === 'https:' || url.protocol === 'wss:') return true
    if (url.protocol !== 'http:' && url.protocol !== 'ws:') return false
    // The raw authority must equal the WHATWG host: RN's iOS WebSocket (NSURL)
    // reads `ws://127.0.0.1\@evil.com` as host evil.com.
    const authority = /^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i.exec(bridge)?.[1]
    return authority === url.host && LOOPBACK_HOSTNAME.test(url.hostname)
}

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
        typeof metadata.chainId === 'number' &&
        // Optional on the record, but the settings screen maps whatever is
        // there, so a present value has to be the shape the type promises.
        (metadata.permissions === undefined ||
            isStringArray(metadata.permissions))
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
