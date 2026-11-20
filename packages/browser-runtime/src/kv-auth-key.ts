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

import {
    bytesToHex,
    hexToBytes,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { isTrustedExtensionPageSender } from '@perawallet/wallet-extension-platform-chrome/messaging'

// The offscreen document has no chrome.storage.session, so the derived key
// that authenticates its network records is fetched from the service worker.
// Pull only, never broadcast: a broadcast would reach every extension page
// and any listener a compromised page registers.
export const KV_AUTH_KEY_SCOPE = 'pera-kv-auth-key'

type KvAuthKeyQuery = { scope: typeof KV_AUTH_KEY_SCOPE; kind: 'get' }
/** Hex key; empty while locked or when the worker can't read it. */
type KvAuthKeyAnswer = { key?: string }

const KEY_HEX_LENGTH = 64

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isKvAuthKeyQuery = (value: unknown): value is KvAuthKeyQuery =>
    isRecord(value) && value.scope === KV_AUTH_KEY_SCOPE && value.kind === 'get'

const parseKeyHex = (hex: string): Nullable<Uint8Array> =>
    /^[0-9a-f]+$/i.test(hex) && hex.length === KEY_HEX_LENGTH
        ? hexToBytes(hex)
        : null

/**
 * Service-worker side. Registered at the worker's top level so a worker woken
 * by the offscreen document's query already has it in place.
 */
export const installKvAuthKeyHost = ({
    chromeLike = chrome,
    readKvAuthKey,
}: {
    chromeLike?: typeof chrome
    readKvAuthKey: () => Promise<Nullable<Uint8Array>>
}): void => {
    chromeLike.runtime.onMessage.addListener(
        (message, sender, sendResponse: (answer: KvAuthKeyAnswer) => void) => {
            if (!isKvAuthKeyQuery(message)) return false
            // Content scripts share this listener, and popups and tabs are
            // extension pages too: only the offscreen document may ask.
            if (
                !isTrustedExtensionPageSender(sender, chromeLike) ||
                sender?.url !== chromeLike.runtime.getURL('offscreen.html')
            ) {
                return false
            }
            void readKvAuthKey().then(
                key => {
                    sendResponse(key === null ? {} : { key: bytesToHex(key) })
                    key?.fill(0)
                },
                () => sendResponse({}),
            )
            return true
        },
    )
}

/** Offscreen side. The caller owns the returned key and must zero it. */
export const requestKvAuthKey = async (
    chromeLike: typeof chrome = chrome,
): Promise<Nullable<Uint8Array>> => {
    const query: KvAuthKeyQuery = { scope: KV_AUTH_KEY_SCOPE, kind: 'get' }
    try {
        const answer: unknown = await chromeLike.runtime.sendMessage(query)
        if (!isRecord(answer) || typeof answer.key !== 'string') return null
        return parseKeyHex(answer.key)
    } catch {
        return null
    }
}
