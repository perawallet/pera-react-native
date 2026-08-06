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

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { selectCosignDispatchAddresses } from '../selectCosignDispatchAddresses'

const account = (address: string): WalletAccount =>
    ({
        id: `algo25-${address}`,
        type: AccountTypes.algo25,
        address,
        keyPairId: `kp-${address}`,
    }) as WalletAccount

describe('selectCosignDispatchAddresses', () => {
    it('dispatches every local-key signer when the whole batch is still needed', () => {
        const result = selectCosignDispatchAddresses({
            localKeySigners: [account('A'), account('B')],
            inFlightAddresses: new Set(),
            threshold: 2,
            signedCount: 0,
        })

        expect(result).toEqual(['A', 'B'])
    })

    it('caps the batch at the signatures still needed (threshold - signedCount)', () => {
        // Threshold 2, one already signed → only one more signature is needed,
        // so the second local participant must NOT be dispatched.
        const result = selectCosignDispatchAddresses({
            localKeySigners: [account('A'), account('B')],
            inFlightAddresses: new Set(),
            threshold: 2,
            signedCount: 1,
        })

        expect(result).toEqual(['A'])
    })

    it('skips signers already in flight and counts them against the cap', () => {
        // Two needed, one (A) already queued → one slot left, and A is skipped,
        // so only B is dispatched.
        const result = selectCosignDispatchAddresses({
            localKeySigners: [account('A'), account('B')],
            inFlightAddresses: new Set(['A']),
            threshold: 2,
            signedCount: 0,
        })

        expect(result).toEqual(['B'])
    })

    it('returns nothing once enough signatures are signed or in flight (repeated Sign is a no-op)', () => {
        const result = selectCosignDispatchAddresses({
            localKeySigners: [account('A'), account('B')],
            inFlightAddresses: new Set(['A', 'B']),
            threshold: 2,
            signedCount: 0,
        })

        expect(result).toEqual([])
    })

    it('returns nothing when there are no local-key signers', () => {
        const result = selectCosignDispatchAddresses({
            localKeySigners: [],
            inFlightAddresses: new Set(),
            threshold: 2,
            signedCount: 0,
        })

        expect(result).toEqual([])
    })

    it('preserves the input (backend participant) order', () => {
        const result = selectCosignDispatchAddresses({
            localKeySigners: [account('C'), account('A'), account('B')],
            inFlightAddresses: new Set(),
            threshold: 3,
            signedCount: 0,
        })

        expect(result).toEqual(['C', 'A', 'B'])
    })
})
