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
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'

/** The ARC-60 request the Algorand app's `signData` takes, minus the path it derives from the account index. */
export type AlgorandLedgerMessage = {
    data: string
    signerPublicKey: Uint8Array
    domain: string
    /** First 32 bytes = sha256(domain). */
    authenticatorData: Uint8Array
    requestId?: string
    scope: number
    encoding: string
}

type EncodedMessage = Omit<
    AlgorandLedgerMessage,
    'signerPublicKey' | 'authenticatorData'
> & { signerPublicKey: string; authenticatorData: string }

const MALFORMED = 'Not an encoded Algorand Ledger message'

export const encodeAlgorandLedgerMessage = (
    message: AlgorandLedgerMessage,
): Uint8Array =>
    new TextEncoder().encode(
        JSON.stringify({
            ...message,
            signerPublicKey: encodeToBase64(message.signerPublicKey),
            authenticatorData: encodeToBase64(message.authenticatorData),
        } satisfies EncodedMessage),
    )

/** @throws on bytes {@link encodeAlgorandLedgerMessage} did not produce. */
export const decodeAlgorandLedgerMessage = (
    payload: Uint8Array,
): AlgorandLedgerMessage => {
    let parsed: unknown
    try {
        parsed = JSON.parse(
            new TextDecoder('utf-8', { fatal: true }).decode(payload),
        )
    } catch (error) {
        throw new Error(MALFORMED, { cause: error })
    }
    if (typeof parsed !== 'object' || parsed === null) {
        throw new Error(MALFORMED)
    }
    const record = parsed as Record<string, unknown>
    const {
        data,
        signerPublicKey,
        domain,
        authenticatorData,
        requestId,
        scope,
        encoding,
    } = record
    if (
        typeof data !== 'string' ||
        typeof signerPublicKey !== 'string' ||
        typeof domain !== 'string' ||
        typeof authenticatorData !== 'string' ||
        (requestId !== undefined && typeof requestId !== 'string') ||
        typeof scope !== 'number' ||
        typeof encoding !== 'string'
    ) {
        throw new Error(MALFORMED)
    }
    return {
        data,
        signerPublicKey: decodeFromBase64(signerPublicKey),
        domain,
        authenticatorData: decodeFromBase64(authenticatorData),
        ...(requestId !== undefined && { requestId }),
        scope,
        encoding,
    }
}
