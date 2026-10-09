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

import type { DeriveOpts, PaymentUriOpts } from '../models/domain'
import type { ChainId, NetworkId } from '../models/identity'
import { createChainAdapterRegistry } from '../registry'

export type ParsedPaymentUri = PaymentUriOpts & { address: string }

// Synchronous throughout: validation runs in render paths and needs no I/O.
export interface AddressCodec {
    readonly chainId: ChainId
    fromPublicKey(publicKey: Uint8Array, opts: DeriveOpts): string
    isValid(address: string, networkId?: NetworkId): boolean
    /** Only defined for input that passes `isValid`. */
    normalize(address: string): string
    /**
     * The only valid address equality: string comparison breaks on checksum
     * case (EIP-55) and on case-insensitive encodings such as base32.
     */
    areEqual(a: string, b: string): boolean
    /** A short display form, as shown for an account with no name. */
    truncate(address: string): string
    toPaymentUri(address: string, opts?: PaymentUriOpts): string
    parsePaymentUri(uri: string): ParsedPaymentUri | undefined
}

export const addressCodecs =
    createChainAdapterRegistry<AddressCodec>('addressCodec')
