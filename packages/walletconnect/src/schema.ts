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
    arc60WireSchema,
    assertArc60RequestWithinLimits as assertArc60WireRequestWithinLimits,
} from '@perawallet/wallet-core-signing'
import { WalletConnectSignRequestError } from './errors'

// The ARC-60 wire shape + size cap now live in the signing package, shared
// with the in-app webview bridge so the two transports can't drift. These
// re-exports preserve the existing `../schema` import surface and the WC
// dApp-facing error contract (`WalletConnectSignRequestError`).

/**
 * Sole source of truth for the ARC-60 `algo_signData` wire shape; re-exported
 * from {@link arc60WireSchema} in the signing package.
 */
export const arc60PayloadSchema = arc60WireSchema

/**
 * Rejects an oversized ARC-60 request before parse/canonify. Delegates to the
 * shared signing check and re-wraps its error so the WC bridge keeps surfacing
 * a {@link WalletConnectSignRequestError} to the dApp.
 */
export const assertArc60RequestWithinLimits = (rawParams: unknown): void => {
    try {
        assertArc60WireRequestWithinLimits(rawParams)
    } catch (error) {
        throw new WalletConnectSignRequestError(
            `Invalid ARC-60 sign request payload — ${(error as Error).message}`,
        )
    }
}
