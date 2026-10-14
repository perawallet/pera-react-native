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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@test-utils/render'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import {
    algorandAccountAt,
    registerAlgorandRampAdapter,
} from '@test-utils/rampChainAdapter'
import { useAssetActionButtons } from '../useAssetActionButtons'

// The real useSwapScope is this one line; the package barrel drags in stores
// the global mocks can't satisfy.
vi.mock('@perawallet/wallet-core-swaps', async () => {
    const { useAccountCapabilityScope } = await vi.importActual<
        typeof import('@perawallet/wallet-core-accounts')
    >('@perawallet/wallet-core-accounts')
    return {
        useSwapScope: (account: WalletAccount | null) =>
            useAccountCapabilityScope(account, 'swap'),
    }
})

const account = algorandAccountAt('ALGORAND_ADDRESS')

const onEthereumOnly: WalletAccount = {
    id: 'eth',
    custody: { kind: 'local', seed: null },
    chains: { ethereum: { address: '0xabc' } },
}

describe('useAssetActionButtons', () => {
    beforeEach(() => {
        useRemoteConfigStore.getState().resetState()
        registerAlgorandRampAdapter()
    })

    it('offers both actions at the Algorand defaults', () => {
        const { result } = renderHook(() => useAssetActionButtons(account))

        expect(result.current).toEqual({ canSwap: true, canBuy: true })
    })

    it.each([
        ['swap', { canSwap: false, canBuy: true }],
        ['onramp', { canSwap: true, canBuy: false }],
    ] as const)(
        'drops only the action whose %s capability is off',
        (capability, expected) => {
            setCapabilityOverrides({ [capability]: false })

            const { result } = renderHook(() => useAssetActionButtons(account))

            expect(result.current).toEqual(expected)
        },
    )

    it('drops swap for an account with no address on a swap chain', () => {
        const { result } = renderHook(() =>
            useAssetActionButtons(onEthereumOnly),
        )

        expect(result.current.canSwap).toBe(false)
    })

    it('drops swap without an account', () => {
        const { result } = renderHook(() => useAssetActionButtons(null))

        expect(result.current.canSwap).toBe(false)
    })

    it('hides buying for an account with no address on an onramp chain', () => {
        const { result } = renderHook(() =>
            useAssetActionButtons({
                id: 'elsewhere',
                custody: { kind: 'watch' },
                chains: { ethereum: { address: '0xADDRESS' } },
            }),
        )

        expect(result.current.canBuy).toBe(false)
    })
})
