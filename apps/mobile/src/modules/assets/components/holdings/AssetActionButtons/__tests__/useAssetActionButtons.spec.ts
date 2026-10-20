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
import { registerEthereumChain } from '@test-utils/chain-fixtures'
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
        registerEthereumChain()
        useRemoteConfigStore.getState().resetState()
        registerAlgorandRampAdapter()
    })

    it('offers every action at the Algorand defaults', () => {
        const { result } = renderHook(() =>
            useAssetActionButtons(account, 'algorand'),
        )

        expect(result.current).toEqual({
            canSwap: true,
            canBuy: true,
            canSend: true,
            canReceive: true,
        })
    })

    it.each([
        [
            'swap',
            { canSwap: false, canBuy: true, canSend: true, canReceive: true },
        ],
        [
            'onramp',
            { canSwap: true, canBuy: false, canSend: true, canReceive: true },
        ],
        [
            'send',
            { canSwap: true, canBuy: true, canSend: false, canReceive: true },
        ],
        [
            'receive',
            { canSwap: true, canBuy: true, canSend: true, canReceive: false },
        ],
    ] as const)(
        'drops only the action whose %s capability is off',
        (capability, expected) => {
            setCapabilityOverrides({ [capability]: false })

            const { result } = renderHook(() =>
                useAssetActionButtons(account, 'algorand'),
            )

            expect(result.current).toEqual(expected)
        },
    )

    it("offers neither swap nor buy on an asset off the account's swap and onramp chain, but sends on the asset's chain", () => {
        const { result } = renderHook(() =>
            useAssetActionButtons(
                {
                    ...account,
                    chains: {
                        ...account.chains,
                        ethereum: { address: '0xabc' },
                    },
                },
                'ethereum',
            ),
        )

        expect(result.current).toEqual({
            canSwap: false,
            canBuy: false,
            canSend: true,
            canReceive: true,
        })
    })

    it('drops receive on an asset whose chain has receive off', () => {
        setCapabilityOverrides({ receive: false }, 'ethereum')

        const { result } = renderHook(() =>
            useAssetActionButtons(onEthereumOnly, 'ethereum'),
        )

        expect(result.current.canReceive).toBe(false)
    })

    it("offers send on an Ethereum asset from the account's own Ethereum chain", () => {
        const { result } = renderHook(() =>
            useAssetActionButtons(onEthereumOnly, 'ethereum'),
        )

        expect(result.current.canSend).toBe(true)
    })

    it("drops send and receive when the account has no address on the asset's chain", () => {
        const { result } = renderHook(() =>
            useAssetActionButtons(onEthereumOnly, 'algorand'),
        )

        expect(result.current.canSend).toBe(false)
        expect(result.current.canReceive).toBe(false)
    })

    it('drops swap for an account with no address on a swap chain', () => {
        const { result } = renderHook(() =>
            useAssetActionButtons(onEthereumOnly, 'ethereum'),
        )

        expect(result.current.canSwap).toBe(false)
    })

    it('drops swap without an account', () => {
        const { result } = renderHook(() =>
            useAssetActionButtons(null, 'algorand'),
        )

        expect(result.current.canSwap).toBe(false)
    })

    it('hides buying for an account with no address on an onramp chain', () => {
        const { result } = renderHook(() =>
            useAssetActionButtons(
                {
                    id: 'elsewhere',
                    custody: { kind: 'watch' },
                    chains: { ethereum: { address: '0xADDRESS' } },
                },
                'ethereum',
            ),
        )

        expect(result.current.canBuy).toBe(false)
    })
})
