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

import { describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'

// Accounts persist these ids as `keyPairId`, so any change strands them.
// Literals on purpose: a test that recomputes the id would drift with it.

const mockDeriveFromSeed = vi.fn(
    async (_s, _p, opts: { id: string }) => opts.id,
)
vi.mock('../../hooks/useKMSServices', () => ({
    useKMSService: () => ({
        keyStore: { deriveFromSeed: mockDeriveFromSeed },
    }),
}))
vi.mock('../../hooks/usePasskeyMainKey', () => ({
    usePasskeyMainKey: () => ({ ensurePasskeyMainKey: vi.fn() }),
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({
        state: {
            keys: [
                {
                    id: 'seed-1',
                    type: 'hd-root-key',
                    algorithm: 'raw',
                    extractable: true,
                    metadata: { scheme: 'bip39' },
                },
            ],
        },
    }),
}))

import { hdDerivedKeyId, useHDWallet } from '../../hooks/useHDWallet'
import {
    algo25SignKeyId,
    PQ_DERIVATION_CANONICAL,
    PQ_DERIVATION_LEGACY,
    quantumSignKeyId,
} from '../../models'

describe('keystore id formats', () => {
    test('hdDerivedKeyId', () => {
        expect(
            hdDerivedKeyId('seed-1', 0, 0, BIP32DerivationType.Peikert),
        ).toBe('seed-1-acc0-idx0-dt9')
        expect(
            hdDerivedKeyId('seed-1', 2, 5, BIP32DerivationType.Khovratovich),
        ).toBe('seed-1-acc2-idx5-dt32')
    })

    test('algo25SignKeyId', () => {
        expect(algo25SignKeyId('seed-1')).toBe('seed-1-ed25519')
    })

    test('quantumSignKeyId', () => {
        expect(quantumSignKeyId('seed-1', PQ_DERIVATION_LEGACY)).toBe(
            'seed-1-quantum',
        )
        expect(quantumSignKeyId('seed-1', PQ_DERIVATION_CANONICAL)).toBe(
            'seed-1-quantum-pqk1',
        )
    })

    test('generateDerivedKey hands the keystore exactly hdDerivedKeyId through the core', async () => {
        const { result } = renderHook(() => useHDWallet())
        const id = await result.current.generateDerivedKey(
            'seed-1',
            2,
            5,
            BIP32DerivationType.Khovratovich,
        )
        expect(mockDeriveFromSeed.mock.calls[0][2].id).toBe(
            'seed-1-acc2-idx5-dt32',
        )
        expect(id).toBe('seed-1-acc2-idx5-dt32')
    })
})
