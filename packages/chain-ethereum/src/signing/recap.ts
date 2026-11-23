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

import type { SignInGrant } from '@perawallet/wallet-core-chain-contract'
import {
    decodeFromBase64,
    decodePrintableUtf8,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { isRecord } from './adapter'

const RECAP_PREFIX = 'urn:recap:'
const BASE64URL = /^[A-Za-z0-9_-]+$/

/** An EIP-5573 ReCap: a SIWE resource that delegates capabilities to the site. */
export const isRecapUri = (uri: string): boolean =>
    uri.toLowerCase().startsWith(RECAP_PREFIX)

const decodeBase64Url = (text: string): Optional<Uint8Array> => {
    if (!BASE64URL.test(text) || text.length % 4 === 1) return undefined
    const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
    try {
        return decodeFromBase64(
            base64.padEnd(Math.ceil(base64.length / 4) * 4, '='),
        )
    } catch {
        return undefined
    }
}

// Every key is the dApp's text, so anything unprintable makes the whole ReCap
// unreadable rather than letting bidi or zero-width characters into the review.
const isPrintable = (text: string): boolean =>
    text !== '' && decodePrintableUtf8(new TextEncoder().encode(text)) === text

/**
 * The capabilities an EIP-5573 ReCap grants, one per target resource, or
 * undefined when the URI does not decode to a well-formed `att` map.
 */
export const decodeRecap = (uri: string): Optional<SignInGrant[]> => {
    if (!isRecapUri(uri)) return undefined
    const bytes = decodeBase64Url(uri.slice(RECAP_PREFIX.length))
    const json = bytes ? decodePrintableUtf8(bytes) : undefined
    if (json === undefined) return undefined
    let parsed: unknown
    try {
        parsed = JSON.parse(json)
    } catch {
        return undefined
    }
    if (!isRecord(parsed) || !isRecord(parsed.att)) return undefined
    const grants: SignInGrant[] = []
    for (const [target, abilities] of Object.entries(parsed.att)) {
        if (
            !isPrintable(target) ||
            !isRecord(abilities) ||
            Array.isArray(abilities)
        ) {
            return undefined
        }
        const names = Object.keys(abilities)
        if (names.length === 0 || !names.every(isPrintable)) return undefined
        grants.push({ target, abilities: names })
    }
    return grants.length > 0 ? grants : undefined
}
