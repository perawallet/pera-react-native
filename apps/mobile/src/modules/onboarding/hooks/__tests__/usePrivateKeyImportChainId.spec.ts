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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { renderHook } from '@test-utils/render'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import {
    allCapabilities,
    ETHEREUM_CHAIN_ID,
    fixtureEthereumDescriptor,
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { usePrivateKeyImportChainId } from '../usePrivateKeyImportChainId'

vi.unmock('@perawallet/wallet-core-accounts')

const SECONDARY_CHAIN_ID = 'base'

const registerSecondaryEvmChain = (): void => {
    getProvider().chains.register(
        {
            ...fixtureEthereumDescriptor,
            id: SECONDARY_CHAIN_ID,
            displayName: 'Base',
            signing: {
                schemes: ['secp256k1'],
                derivationPaths: {},
                rawKeySchemes: ['secp256k1'],
                standaloneSecret: 'privateKey',
            },
            enabledByDefault: false,
        },
        allCapabilities(true),
    )
}

describe('usePrivateKeyImportChainId', () => {
    afterEach(() => {
        useRemoteConfigStore.getState().resetState()
        restoreAlgorandOnlyChains()
    })

    it('opens on Ethereum once it is registered at its shipped defaults', () => {
        registerEthereumChain()

        const { result } = renderHook(() => usePrivateKeyImportChainId())

        expect(result.current).toBe(ETHEREUM_CHAIN_ID)
    })

    it('opens nowhere with Algorand alone', () => {
        const { result } = renderHook(() => usePrivateKeyImportChainId())

        expect(result.current).toBeUndefined()
    })

    it('opens nowhere once private keys are off on Ethereum', () => {
        registerEthereumChain()
        setCapabilityOverrides({ privateKeys: false }, ETHEREUM_CHAIN_ID)

        const { result } = renderHook(() => usePrivateKeyImportChainId())

        expect(result.current).toBeUndefined()
    })

    it('opens on a non-default chain when it alone imports private keys', () => {
        registerEthereumChain()
        registerSecondaryEvmChain()
        setCapabilityOverrides({ privateKeys: false }, ETHEREUM_CHAIN_ID)

        const { result } = renderHook(() => usePrivateKeyImportChainId())

        expect(result.current).toBe(SECONDARY_CHAIN_ID)
    })
})
