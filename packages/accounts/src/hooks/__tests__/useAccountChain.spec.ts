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
import { accountsChainAdapters } from '../../chain-adapter'
import { accountValueKey, type WalletAccount } from '../../models'
import { useAccountsStore } from '../../store'
import { testAccount } from '../../__tests__/accountFactory'
import { fakeAccountsChain } from '../../__tests__/fakeAccountsChain'
import {
    accountChainIdOf,
    accountValueOf,
    ownAddressOf,
    secondaryChainIdsOf,
    useSigningAccountsOnAnyChain,
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

type Stamp = 'created' | 'discovery'

const stamped = (stamps: Partial<Record<ChainId, Stamp>>): WalletAccount => ({
    id: 'stamped',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: Object.fromEntries(
        Object.entries(stamps).map(([chainId, enabledBy]) => [
            chainId,
            {
                address: chainId === 'algorand' ? 'ALGO-ADDR' : ETH_ADDRESS,
                keyPairId: `${chainId}-key`,
                enabledBy,
            },
        ]),
    ) as WalletAccount['chains'],
})
const REGISTRY: ChainId[] = ['algorand', 'ethereum', 'base']

describe('accountChainIdOf with discovery stamps', () => {
    it.each([
        [
            'only a later chain was found active',
            { algorand: 'created', ethereum: 'discovery' },
            'ethereum',
        ],
        [
            'every chain was found active',
            { algorand: 'discovery', ethereum: 'discovery' },
            'algorand',
        ],
        [
            'the first chain was found active',
            { algorand: 'discovery', ethereum: 'created' },
            'algorand',
        ],
        [
            'nothing was found active',
            { algorand: 'created', ethereum: 'created' },
            'algorand',
        ],
        [
            'an unstamped record',
            { algorand: undefined, ethereum: undefined },
            'algorand',
        ],
        [
            'only the last chain was found active',
            { algorand: 'created', ethereum: 'created', base: 'discovery' },
            'base',
        ],
    ] as const)('resolves when %s', (_label, stamps, expected) => {
        expect(accountChainIdOf(stamped(stamps), REGISTRY)).toBe(expected)
    })

    it('ignores a discovery stamp on a chain that is not registered', () => {
        expect(
            accountChainIdOf(
                stamped({ algorand: 'created', ethereum: 'discovery' }),
                ['algorand'],
            ),
        ).toBe('algorand')
    })
})

describe('secondaryChainIdsOf', () => {
    it('lists the held chains with another address once discovery put a later chain first', () => {
        expect(
            secondaryChainIdsOf(
                stamped({ algorand: 'created', ethereum: 'discovery' }),
                REGISTRY,
            ),
        ).toEqual(['algorand'])
    })

    it.each([
        [
            'active on the first chain',
            { algorand: 'discovery', ethereum: 'discovery' },
        ],
        ['unstamped', { algorand: undefined, ethereum: undefined }],
    ] as const)('is empty when the account is %s', (_label, stamps) => {
        expect(secondaryChainIdsOf(stamped(stamps), REGISTRY)).toEqual([])
    })

    it('is empty when every held chain shares the own chain address', () => {
        expect(
            secondaryChainIdsOf(
                stamped({ ethereum: 'created', base: 'discovery' }),
                REGISTRY,
            ),
        ).toEqual([])
    })
})

describe('ownAddressOf', () => {
    it('reads the 0x address of an account found active only on its second chain', () => {
        register('algorand', 'ethereum')

        expect(
            ownAddressOf(
                stamped({ algorand: 'created', ethereum: 'discovery' }),
            ),
        ).toBe(ETH_ADDRESS)
    })

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

describe('useSigningAccountsOnAnyChain', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        useAccountsStore.getState().resetState()
        useNetworkStore.getState().setMode('live')
    })

    it('skips a chain with no accounts adapter', () => {
        register('algorand', 'ethereum')
        useAccountsStore
            .getState()
            .setAccounts([algorandAccount, ethereumAccount])

        const { result } = renderHook(() => useSigningAccountsOnAnyChain())

        expect(result.current).toEqual([algorandAccount])
    })

    it("keeps an account whose chain's Pera backend is switched off", () => {
        register('algorand')
        useAccountsStore.getState().setAccounts([algorandAccount])
        vi.spyOn(getProvider().chains, 'isSwitchedOff').mockImplementation(
            chainId => chainId === 'algorand',
        )

        const { result } = renderHook(() => useSigningAccountsOnAnyChain())

        expect(result.current).toEqual([algorandAccount])
    })

    it('keeps an account on two chains that signs only on its second', () => {
        register('algorand', 'ethereum')
        if (!accountsChainAdapters.has('ethereum' as ChainId)) {
            accountsChainAdapters.register({
                ...fakeAccountsChain().adapter,
                chainId: 'ethereum' as ChainId,
            })
        }
        const both: WalletAccount = {
            ...algorandAccount,
            chains: {
                ...algorandAccount.chains,
                ethereum: { address: ETH_ADDRESS, keyPairId: 'eth-key' },
            },
        }
        useAccountsStore.getState().setAccounts([both])
        vi.mocked(fakeAccountsChain().adapter.resolveSigner).mockImplementation(
            (account, _accounts, scope) =>
                scope.chainId === 'ethereum'
                    ? { kind: 'ok', signer: account }
                    : { kind: 'watch', account },
        )

        const { result } = renderHook(() => useSigningAccountsOnAnyChain())

        expect(result.current).toEqual([both])
    })
})
