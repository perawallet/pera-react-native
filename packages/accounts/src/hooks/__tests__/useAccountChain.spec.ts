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

// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { accountValueKey, type WalletAccount } from '../../models'
import { useAccountsStore } from '../../store'
import { testAccount } from '../../__tests__/accountFactory'
import {
    accountChainIdOf,
    accountValueOf,
    ownAddressOf,
    useSigningAccountsOnOwnChain,
} from '../useAccountChain'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

const ALL_ON = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, true]),
) as ChainCapabilities

const register = (...ids: ChainId[]) => {
    for (const id of ids) {
        getProvider().chains.register(
            {
                id,
                networks: [
                    { id: 'mainnet', tier: 'mainnet', isDefaultForTier: true },
                ],
            } as unknown as ChainDescriptor,
            ALL_ON,
        )
    }
}

const ETH_ADDRESS = '0xabc'
const algorandAccount = testAccount('local', 'ALGO-ADDR')
const ethereumAccount: WalletAccount = {
    id: 'eth',
    custody: { kind: 'local', seed: null },
    chains: { ethereum: { address: ETH_ADDRESS, keyPairId: 'eth-key' } },
}

describe('accountChainIdOf', () => {
    it('resolves the registered chain the account has an address on', () => {
        expect(
            accountChainIdOf(ethereumAccount, ['algorand', 'ethereum']),
        ).toBe('ethereum')
        expect(
            accountChainIdOf(algorandAccount, ['algorand', 'ethereum']),
        ).toBe('algorand')
    })

    it("falls back to the record's own chain when that chain isn't registered", () => {
        expect(accountChainIdOf(ethereumAccount, ['algorand'])).toBe('ethereum')
    })
})

describe('ownAddressOf', () => {
    it("reads the account's address on its own chain", () => {
        register('algorand', 'ethereum')

        expect(ownAddressOf(ethereumAccount)).toBe(ETH_ADDRESS)
        expect(ownAddressOf(algorandAccount)).toBe('ALGO-ADDR')
    })
})

describe('accountValueOf', () => {
    it('looks the account up by its address on the given chain only', () => {
        const values = new Map([
            [accountValueKey('ethereum', ETH_ADDRESS), new Decimal(3)],
            [accountValueKey('base', ETH_ADDRESS), new Decimal(0)],
        ])

        expect(accountValueOf(ethereumAccount, 'ethereum', values)).toEqual(
            new Decimal(3),
        )
        expect(accountValueOf(ethereumAccount, 'algorand', values)).toBe(
            undefined,
        )
    })
})

describe('useSigningAccountsOnOwnChain', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        useAccountsStore.getState().resetState()
        useNetworkStore.getState().setMode('live')
    })

    it('checks each account on its own chain, skipping a chain with no accounts adapter', () => {
        register('ethereum')
        useAccountsStore
            .getState()
            .setAccounts([algorandAccount, ethereumAccount])

        const { result } = renderHook(() => useSigningAccountsOnOwnChain())

        expect(result.current).toEqual([algorandAccount])
    })

    it("leaves out an account whose chain's kill switch is on", () => {
        register('algorand')
        useAccountsStore.getState().setAccounts([algorandAccount])
        vi.spyOn(getProvider().chains, 'isSwitchedOff').mockImplementation(
            chainId => chainId === 'algorand',
        )

        const { result } = renderHook(() => useSigningAccountsOnOwnChain())

        expect(result.current).toEqual([])
    })
})
