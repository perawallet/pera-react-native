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

import { expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { keyDerivations } from '@perawallet/wallet-core-chain-contract'
import { kmsCore, useKMS } from '@perawallet/wallet-core-kms'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { HD_TEST_MNEMONIC_24_INDICES } from './onboarding'

/**
 * The test seed's Ethereum address at an HD index, read through a throwaway
 * copy of the seed: secp256k1 keys derive only inside the keystore. Resets
 * the test keystore, so call it before the spec seeds its own keys.
 */
export const ethereumAddressAt = async (
    account: number,
    keyIndex: number,
): Promise<string> => {
    const { result: kms } = renderHook(() => useKMS())
    const rootKey = await waitFor(async () => {
        const created = await kms.current.createHDWalletKey({
            mnemonicIndices: HD_TEST_MNEMONIC_24_INDICES,
        })
        expect(created).not.toBeNull()
        return created!
    })
    const { address } = await keyDerivations
        .get('ethereum')
        .deriveAccount(kmsCore, rootKey.seedKey.id, account, keyIndex, {
            scheme: 'secp256k1',
            networkId: 'mainnet',
        })
    resetTestKeystore()
    return address
}
