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
import type { ChainContext } from '@perawallet/wallet-core-chain-contract'
import { createFakeChainKeyStore } from '@perawallet/wallet-core-chain-contract/testing'
import { createEthereumAccountsAdapter } from '../adapter'
import { ethereumKeyDerivation } from '../key-derivation'
import { revealEthereumPrivateKey } from '../private-key'

const adapter = createEthereumAccountsAdapter({} as ChainContext)

// Any 64 bytes after the 0x04 prefix make a key the codec accepts.
const toUncompressedKey = (bytes: Uint8Array) =>
    Uint8Array.of(0x04, ...bytes, ...bytes)

describe('createEthereumAccountsAdapter', () => {
    it.each([
        [0, 0],
        [0, 3],
        [2, 1],
    ])(
        'names the HD key at account %i, index %i as the key derivation stores it',
        async (account, keyIndex) => {
            const keyStore = createFakeChainKeyStore(toUncompressedKey)

            const derived = await ethereumKeyDerivation.deriveAccount(
                keyStore,
                'seed-1',
                account,
                keyIndex,
                { scheme: 'secp256k1', networkId: 'mainnet' },
            )

            expect(adapter.hdKeyPairId('seed-1', { account, keyIndex })).toBe(
                derived.keyPairId,
            )
        },
    )

    it('reads a stored row as a fresh EVM state until a sync carries the nonce', () => {
        expect(adapter.toChainState({ authorityAddress: null })).toEqual({
            family: 'evm',
            nonce: { latest: 0, pending: 0 },
        })
    })

    it('reveals a private key through the keystore export', () => {
        expect(adapter.revealPrivateKey).toBe(revealEthereumPrivateKey)
    })
})
