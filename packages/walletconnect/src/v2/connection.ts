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
import { readString } from '../shared/read'
import { walletConnectUriTopic, walletConnectUriVersion } from '../shared/uri'

export const WALLET_CONNECT_V2_KIND = 'walletconnect-v2'

export type WalletConnectV2Metadata = {
    topic: string
    /** CAIP-2 chain ids the session was approved for (see `./caip`). */
    chains: string[]
    /** Approved methods (`algo_signTxn`, …), as the session namespace lists them. */
    methods: string[]
    /** Epoch SECONDS, as WalletKit reports it. Convert at the boundary. */
    expiry: number
}

export type WalletConnectV2Connection = Connection & {
    kind: typeof WALLET_CONNECT_V2_KIND
    /** Never present: WalletKit owns the symKey, so v2 stores no key material. */
    secretRef?: never
    metadata: WalletConnectV2Metadata
}

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(item => typeof item === 'string')

/** The `?…` query of a `wc:` URI, with any `#fragment` cut off. */
const queryOf = (uri: string): string => {
    const start = uri.indexOf('?')
    if (start === -1) return ''
    const end = uri.indexOf('#', start)
    return end === -1 ? uri.slice(start) : uri.slice(start, end)
}

// v2 carries the pairing secret in `symKey=`; a bridge-less `wc://?…` focus
// signal has no version at all and must never reach the pairing path. Only the
// query counts: nothing reads a `wc:` fragment, so a symKey found there is not
// a secret the relay would accept.
export const isV2PairingUri = (uri: string): boolean =>
    walletConnectUriVersion(uri) === 2 && /[?&]symKey=[^&]+/.test(queryOf(uri))

/**
 * Log-safe identifiers for a v2 pairing URI. Returns fields, never the URI:
 * `symKey=` is the pairing secret and error-level log context ships to the
 * crash reporter. The topic and the relay protocol are both plaintext to the
 * relay itself, so they carry nothing the relay does not already hold.
 */
export const describeV2PairingUri = (
    uri: string,
): Record<string, string | null> => ({
    version: '2',
    topic: walletConnectUriTopic(uri),
    relay: /[?&]relay-protocol=([^&#]+)/.exec(queryOf(uri))?.[1] ?? null,
})

// Applied on every read: the registry hands over erased records, and persisted
// ones can be stale or half-written.
export const isWalletConnectV2Connection = (
    connection: Connection,
): connection is WalletConnectV2Connection => {
    if (connection.kind !== WALLET_CONNECT_V2_KIND) return false
    // A v2 row holding key material is a mis-migrated v1 row or corruption.
    if (connection.secretRef !== undefined) return false
    const metadata = connection.metadata
    if (typeof metadata !== 'object' || metadata === null) return false
    return (
        // An empty topic addresses no relay subscription, and a NaN expiry
        // reads as "not yet expired" in every comparison against it.
        (readString(metadata, 'topic')?.length ?? 0) > 0 &&
        isStringArray(metadata.chains) &&
        isStringArray(metadata.methods) &&
        typeof metadata.expiry === 'number' &&
        Number.isFinite(metadata.expiry)
    )
}
