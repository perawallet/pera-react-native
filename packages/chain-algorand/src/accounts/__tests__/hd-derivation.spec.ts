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

import { describe, expect, it } from 'vitest'
import {
    BIP32DerivationType,
    KeyContext,
} from '@algorandfoundation/xhd-wallet-api'
import { algorandHdDerivationRequest, hdDerivedKeyId } from '../hd-derivation'

describe('hdDerivedKeyId', () => {
    it('keeps the stored key id format', () => {
        expect(
            hdDerivedKeyId('seed-1', 0, 0, BIP32DerivationType.Peikert),
        ).toBe('seed-1-acc0-idx0-dt9')
        expect(
            hdDerivedKeyId('seed-1', 2, 5, BIP32DerivationType.Khovratovich),
        ).toBe('seed-1-acc2-idx5-dt32')
    })
})

describe('algorandHdDerivationRequest', () => {
    it('asks for a Peikert child along the Algorand BIP44 path with the metadata signXHDEd25519 reads', () => {
        expect(
            algorandHdDerivationRequest(
                'seed-1',
                2,
                5,
                BIP32DerivationType.Peikert,
            ),
        ).toEqual({
            scheme: 'ed25519',
            path: "m/44'/283'/2'/0/5",
            id: 'seed-1-acc2-idx5-dt9',
            params: {
                mode: 'peikert',
                metadata: {
                    path: "m/44'/283'/2'/0/5",
                    context: KeyContext.Address,
                    account: 2,
                    index: 5,
                    derivation: BIP32DerivationType.Peikert,
                },
            },
        })
    })

    it('asks for standard mode for a Khovratovich child', () => {
        expect(
            algorandHdDerivationRequest(
                'seed-1',
                0,
                1,
                BIP32DerivationType.Khovratovich,
            ),
        ).toEqual({
            scheme: 'ed25519',
            path: "m/44'/283'/0'/0/1",
            id: 'seed-1-acc0-idx1-dt32',
            params: {
                mode: 'standard',
                metadata: {
                    path: "m/44'/283'/0'/0/1",
                    context: KeyContext.Address,
                    account: 0,
                    index: 1,
                    derivation: BIP32DerivationType.Khovratovich,
                },
            },
        })
    })
})
