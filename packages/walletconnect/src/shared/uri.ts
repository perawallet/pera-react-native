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

import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * Shared by both WalletConnect protocol implementations: reading a `wc:` URI
 * is the one thing v1 and v2 must agree on, since the registry decides which
 * handler owns a URI purely from what these two functions report.
 */

/** The topic of a `wc:<topic>@<version>` URI, in both protocols' encoding. */
export const walletConnectUriTopic = (uri: string): Nullable<string> =>
    /^wc:([^@?#]+)@/.exec(uri)?.[1] ?? null

/**
 * Log-safe identifiers for a `wc:` pairing URI. Never returns the URI itself:
 * v1's `key=` and v2's `symKey=` are the pairing secret, and error-level log
 * context ships to the crash reporter. Topic and bridge origin are visible in
 * plaintext to the public bridge server, so they are safe.
 */
export const walletConnectLogContext = (
    uri: string,
): { topic: Nullable<string>; bridgeOrigin: Nullable<string> } => {
    const topic = walletConnectUriTopic(uri)
    const bridgeValue = /[?&]bridge=([^&#]+)/.exec(uri)?.[1]
    let bridgeOrigin: Nullable<string> = null
    if (bridgeValue) {
        try {
            const origin = new URL(decodeURIComponent(bridgeValue)).origin
            bridgeOrigin = origin === 'null' ? null : origin
        } catch {
            // A malformed bridge value only costs this diagnostic field.
        }
    }
    return { topic, bridgeOrigin }
}

/**
 * A URI safe to log: the pairing secret (`key=`, `symKey=`) is blanked whether
 * it appears raw or still percent-encoded inside a deep-link wrapper's `uri=`.
 */
export const redactWalletConnectUri = (uri: string): string =>
    uri
        .replace(/((?:^|[?&])(?:symKey|key)=)[^&#]*/g, '$1[redacted]')
        .replace(
            /((?:%3F|%26)(?:symKey|key)%3D)(?:[^&#%]|%(?!26|23))*/gi,
            '$1[redacted]',
        )

/** The protocol version a `wc:` URI pairs with, or null if not a pairing URI. */
export const walletConnectUriVersion = (uri: string): 1 | 2 | null => {
    const match = /^wc:([^@?#]+)@(\d+)/.exec(uri)
    if (!match) return null
    const version = Number(match[2])
    return version === 1 || version === 2 ? version : null
}
