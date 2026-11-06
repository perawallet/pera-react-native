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
import { createQueryClientWrapper, renderHook } from '@test-utils/render'
import {
    useAccountCapabilityScope,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { rampChainAdapters } from '@perawallet/wallet-core-onramp'
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
        useSwapScope: (account: WalletAccount | null, chainId?: ChainId) =>
            useAccountCapabilityScope(account, 'swap', chainId),
    }
})

// useCanBuyAsset reads the router's list through a query.
const renderButtons = (
    account: WalletAccount | null,
    chainId: ChainId,
    asset?: Parameters<typeof useAssetActionButtons>[2],
) =>
    renderHook(() => useAssetActionButtons(account, chainId, asset), {
        wrapper: createQueryClientWrapper(),
    })

const account = algorandAccountAt('ALGORAND_ADDRESS')

const onEthereumOnly: WalletAccount = {
    id: 'eth',
    custody: { kind: 'local', seed: null },
    chains: { ethereum: { address: '0xabc' } },
}

const onBoth: WalletAccount = {
    ...account,
    chains: { ...account.chains, ethereum: { address: '0xabc' } },
}

describe('useAssetActionButtons', () => {
    beforeEach(async () => {
        // The global mock has every capability on; these specs switch some off.
        const actual = await vi.importActual<
            typeof import('@perawallet/wallet-core-accounts')
        >('@perawallet/wallet-core-accounts')
        vi.mocked(useAccountCapabilityScope).mockImplementation(
            actual.useAccountCapabilityScope,
        )
        registerEthereumChain()
        useRemoteConfigStore.getState().resetState()
        registerAlgorandRampAdapter()
    })

    it('offers every action at the Algorand defaults', () => {
        const { result } = renderButtons(account, 'algorand')

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

            const { result } = renderButtons(account, 'algorand')

            expect(result.current).toEqual(expected)
        },
    )

    it('offers Buy on every Algorand asset, listed or not', () => {
        const { result } = renderButtons(account, 'algorand', {
            assetId: '31566704',
        })

        expect(result.current.canBuy).toBe(true)
    })

    it("swaps and sends on the asset's own chain, and buys only where the chain has a ramp adapter", () => {
        const { result } = renderButtons(onBoth, 'ethereum')

        expect(result.current).toEqual({
            canSwap: true,
            canBuy: false,
            canSend: true,
            canReceive: true,
        })
    })

    it('offers Buy on either chain of an account that is on both', () => {
        rampChainAdapters.register({
            chainId: 'ethereum',
            fromRouterAssetId: () => null,
        })

        const onAlgorand = renderButtons(onBoth, 'algorand')
        const onEthereum = renderButtons(onBoth, 'ethereum')

        expect(onAlgorand.result.current.canBuy).toBe(true)
        expect(onEthereum.result.current.canBuy).toBe(true)
    })

    it('drops Buy on the chain whose onramp is off, keeping it on the other', () => {
        rampChainAdapters.register({
            chainId: 'ethereum',
            fromRouterAssetId: () => null,
        })
        setCapabilityOverrides({ onramp: false }, 'ethereum')

        const onAlgorand = renderButtons(onBoth, 'algorand')
        const onEthereum = renderButtons(onBoth, 'ethereum')

        expect(onAlgorand.result.current.canBuy).toBe(true)
        expect(onEthereum.result.current.canBuy).toBe(false)
    })

    it('drops receive on an asset whose chain has receive off', () => {
        setCapabilityOverrides({ receive: false }, 'ethereum')

        const { result } = renderButtons(onEthereumOnly, 'ethereum')

        expect(result.current.canReceive).toBe(false)
    })

    it("offers send on an Ethereum asset from the account's own Ethereum chain", () => {
        const { result } = renderButtons(onEthereumOnly, 'ethereum')

        expect(result.current.canSend).toBe(true)
    })

    it("drops send and receive when the account has no address on the asset's chain", () => {
        const { result } = renderButtons(onEthereumOnly, 'algorand')

        expect(result.current.canSend).toBe(false)
        expect(result.current.canReceive).toBe(false)
    })

    it('drops swap on a chain whose swap capability is off', () => {
        setCapabilityOverrides({ swap: false }, 'ethereum')

        const { result } = renderButtons(onEthereumOnly, 'ethereum')

        expect(result.current.canSwap).toBe(false)
    })

    it.each(['unverified', 'suspicious'] as const)(
        'drops swap for a %s token on a chain where tokens arrive unasked',
        verificationTier => {
            const { result } = renderButtons(onEthereumOnly, 'ethereum', {
                assetId: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
                peraMetadata: { verificationTier },
            })

            expect(result.current.canSwap).toBe(false)
            expect(result.current.canSend).toBe(true)
        },
    )

    it('keeps swap for a verified token and for the native coin', () => {
        const verified = renderButtons(onEthereumOnly, 'ethereum', {
            assetId: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            peraMetadata: { verificationTier: 'verified' },
        })
        const native = renderButtons(onEthereumOnly, 'ethereum', {
            assetId: 'native',
            peraMetadata: { verificationTier: 'unverified' },
        })

        expect(verified.result.current.canSwap).toBe(true)
        expect(native.result.current.canSwap).toBe(true)
    })

    it('drops swap for an account with no address on the asset chain', () => {
        const { result } = renderButtons(account, 'ethereum')

        expect(result.current.canSwap).toBe(false)
    })

    it('drops swap without an account', () => {
        const { result } = renderButtons(null, 'algorand')

        expect(result.current.canSwap).toBe(false)
    })

    it('hides buying for an account with no address on an onramp chain', () => {
        const { result } = renderButtons(
            {
                id: 'elsewhere',
                custody: { kind: 'watch' },
                chains: { ethereum: { address: '0xADDRESS' } },
            },
            'ethereum',
        )

        expect(result.current.canBuy).toBe(false)
    })
})
