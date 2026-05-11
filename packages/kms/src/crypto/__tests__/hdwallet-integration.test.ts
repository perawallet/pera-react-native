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

// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { mnemonicToSeed } from '@scure/bip39'
import {
    BIP32DerivationType,
    fromSeed,
    KeyContext,
    XHDWalletAPI,
} from '@algorandfoundation/xhd-wallet-api'
import { encodeAddress } from '@algorandfoundation/algokit-utils'

/**
 * Integration test for HD wallet (BIP39 24-word mnemonic) key derivation.
 * Uses a known test vector — mnemonic → BIP39 seed → rootKey → keyGen → Algorand address.
 *
 * Derivation path: m/44'/283'/0'/0/0 with Peikert derivation type.
 * This must produce the same address as the native iOS/Android Pera apps.
 */

const TEST_MNEMONIC =
    'champion say kitchen sock defense example mesh body sample artwork warfare canvas item recall cheese total floor cycle such asthma okay immense lake street'

const EXPECTED_ADDRESS =
    'RP35URKAEVP6PA3WIJGDGA3FZKNV76E7Y2QZPEJ4TDLV72T326B3IOFX7A'

describe('HD wallet integration', () => {
    test('derives the expected address from a known 24-word mnemonic', async () => {
        const seed = await mnemonicToSeed(TEST_MNEMONIC)
        const rootKey = fromSeed(seed)
        const api = new XHDWalletAPI()
        const publicKey = await api.keyGen(
            rootKey,
            KeyContext.Address,
            0,
            0,
            BIP32DerivationType.Peikert,
        )
        const address = encodeAddress(publicKey)

        expect(address).toBe(EXPECTED_ADDRESS)
    })

    test('round-trips: mnemonic → address produces a deterministic result', async () => {
        const api = new XHDWalletAPI()

        const seed1 = await mnemonicToSeed(TEST_MNEMONIC)
        const rootKey1 = fromSeed(seed1)
        const publicKey1 = await api.keyGen(
            rootKey1,
            KeyContext.Address,
            0,
            0,
            BIP32DerivationType.Peikert,
        )
        const address1 = encodeAddress(publicKey1)

        const seed2 = await mnemonicToSeed(TEST_MNEMONIC)
        const rootKey2 = fromSeed(seed2)
        const publicKey2 = await api.keyGen(
            rootKey2,
            KeyContext.Address,
            0,
            0,
            BIP32DerivationType.Peikert,
        )
        const address2 = encodeAddress(publicKey2)

        expect(address1).toBe(address2)
    })
})
