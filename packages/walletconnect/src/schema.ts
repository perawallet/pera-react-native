/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { z } from 'zod'
import { ARC60_MAX_REQUEST_BYTES } from './constants'
import { WalletConnectSignRequestError } from './errors'

const byteLength = (value: string): number =>
    new TextEncoder().encode(value).length

/**
 * Rejects an ARC-60 request whose serialized size exceeds
 * {@link ARC60_MAX_REQUEST_BYTES} *before* it reaches `safeParse`/`canonify`.
 * Pure + dependency-free so it can be unit-tested without the WC stack.
 */
export const assertArc60RequestWithinLimits = (rawParams: unknown): void => {
    const serialized = JSON.stringify(rawParams) ?? ''
    if (byteLength(serialized) > ARC60_MAX_REQUEST_BYTES) {
        throw new WalletConnectSignRequestError(
            'Invalid ARC-60 sign request payload — request exceeds the maximum allowed size',
        )
    }
}

/**
 * Zod schema for the wire shape of an ARC-60 `algo_signData` request.
 *
 * Mirrors ARC-60's `StdSigData` + `Metadata`. `data`, `signer`, `domain`,
 * `authenticatorData` are required strings on the wire; `authenticatorData`
 * is base64 and is decoded after parsing. Keep this as the sole source of
 * truth for the wire shape — do not duplicate typeof checks elsewhere.
 */
export const arc60PayloadSchema = z.object({
    data: z.string().max(16 * 1024), // base64-encoded SIWA blob
    signer: z.string().min(1).max(128),
    domain: z.string().min(1).max(256),
    authenticatorData: z.string().min(1).max(512),
    requestId: z.string().max(256).optional(),
    hdPath: z.string().max(256).optional(),
    metadata: z.object({
        scope: z.number().int(),
        encoding: z.string().min(1).max(32),
    }),
})
