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

import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { algorandDescriptor } from '@perawallet/wallet-core-chain-algorand/descriptor'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    ETHEREUM_CHAIN_ID,
    allCapabilities,
    fixtureEthereumDescriptor,
} from '@test-utils/chain-fixtures'
import { useSettingsNetworksScreen } from '../useSettingsNetworksScreen'

describe('useSettingsNetworksScreen', () => {
    beforeEach(() => {
        const { chains } = getProvider()
        chains.reset()
        chains.register(algorandDescriptor, allCapabilities(true))
    })

    it('lists a single chain without a header', () => {
        const { result } = renderHook(() => useSettingsNetworksScreen())

        expect(result.current.chains).toEqual([{ chainId: 'algorand' }])
        expect(result.current.isChainHeaderVisible).toBe(false)
    })

    it('lists registered chains in registry order and shows the headers', () => {
        getProvider().chains.register(
            fixtureEthereumDescriptor,
            allCapabilities(false),
        )

        const { result } = renderHook(() => useSettingsNetworksScreen())

        expect(result.current.chains).toEqual([
            { chainId: 'algorand' },
            { chainId: ETHEREUM_CHAIN_ID },
        ])
        expect(result.current.isChainHeaderVisible).toBe(true)
    })
})
