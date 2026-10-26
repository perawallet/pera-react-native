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

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { registerAlgorandAddressCodec } from '@test-utils/algorandAccountsAdapter'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { useRecipientSafety } from '../useRecipientSafety'
import { useSendFundsStore } from '../useSendFunds'

type FakeAccount = {
    name?: string
    isWatch?: boolean
    chains: Record<string, { address: string }>
}

const mocks = vi.hoisted(() => ({
    accounts: [] as FakeAccount[],
    contacts: [] as { name: string; addresses: Record<string, string> }[],
    counterparties: [] as { address: string; hasBeenPaid: boolean }[],
    isCounterpartiesPending: false,
    hasSenderHistory: true,
    counterpartiesQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAllAccounts: () => mocks.accounts,
    chainAccountOf: (account: FakeAccount, chainId: string) =>
        account.chains[chainId],
    canSignWith: (account: FakeAccount) => !account.isWatch,
}))

vi.mock('@perawallet/wallet-core-contacts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-contacts')
    >()),
    useContactsStore: (
        select: (state: { contacts: typeof mocks.contacts }) => unknown,
    ) => select({ contacts: mocks.contacts }),
}))

vi.mock('@perawallet/wallet-core-transactions', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-transactions')
    >()),
    useTrustedCounterpartiesQuery: (params: unknown) => {
        mocks.counterpartiesQuery(params)
        return {
            data: mocks.counterparties,
            isPending: mocks.isCounterpartiesPending,
            hasSenderHistory: mocks.hasSenderHistory,
        }
    },
}))

const ALGORAND: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

const ALGO_KNOWN = '2SSSXMFNG55PKDGKJB7MLTGIRSIYAXFCJAWSQFD6C3M7L6JLG5NJIBTGAA'
const ALGO_LOOK_ALIKE =
    '2SSSXMBXVWYMJ33BCFI5PED5O7LMFJZWXXSAJCU44W5M4NP4Q5YIJBTGAA'
const EVM_KNOWN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const EVM_LOOK_ALIKE = '0xF39F000000000000000000000000000000002266'
const EVM_NEW = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

const SENDER = 'SENDER'

const render = (recipient: string | undefined, scope: ChainScope) =>
    renderHook(() =>
        useRecipientSafety({ recipient, senderAddress: SENDER, scope }),
    )

describe('useRecipientSafety', () => {
    beforeAll(() => {
        registerAlgorandAddressCodec()
        registerEthereumChain()
    })

    beforeEach(async () => {
        // The unit setup stubs truncation to identity; resemblance needs the real one.
        const actual = await vi.importActual<
            typeof import('@packages/shared/src/utils/addresses')
        >('@packages/shared/src/utils/addresses')
        vi.mocked(truncateAlgorandAddress).mockImplementation(
            actual.truncateAlgorandAddress,
        )
        mocks.accounts = []
        mocks.contacts = []
        mocks.counterparties = []
        mocks.isCounterpartiesPending = false
        mocks.hasSenderHistory = true
        mocks.counterpartiesQuery.mockClear()
        useSendFundsStore.getState().reset()
    })

    describe.each([
        ['Algorand', ALGORAND, ALGO_KNOWN, ALGO_LOOK_ALIKE],
        ['an EVM chain', ETHEREUM, EVM_KNOWN, EVM_LOOK_ALIKE],
    ] as const)('on %s', (_, scope, known, lookAlike) => {
        const family = scope.chainId === 'algorand' ? 'algorand' : 'evm'
        const sources = {
            'own-account': () => {
                mocks.accounts = [
                    {
                        name: 'Main',
                        chains: { [scope.chainId]: { address: known } },
                    },
                ]
            },
            contact: () => {
                mocks.contacts = [
                    { name: 'Alice', addresses: { [family]: known } },
                ]
            },
            history: () => {
                mocks.counterparties = [{ address: known, hasBeenPaid: true }]
            },
        }

        it.each(Object.keys(sources) as (keyof typeof sources)[])(
            'passes a known %s quietly',
            source => {
                sources[source]()

                const { result } = render(known, scope)

                expect(result.current.assessment).toEqual({
                    kind: 'known',
                    source,
                })
                expect(result.current.isConfirmBlocked).toBe(false)
            },
        )

        it.each(Object.keys(sources) as (keyof typeof sources)[])(
            'blocks a look-alike of a %s until acknowledged',
            source => {
                sources[source]()

                const { result } = render(lookAlike, scope)

                expect(result.current.assessment).toMatchObject({
                    kind: 'look-alike',
                    knownAddress: { address: known, source },
                })
                expect(result.current.isConfirmBlocked).toBe(true)

                act(() => result.current.toggleAcknowledged())

                expect(result.current.isAcknowledged).toBe(true)
                expect(result.current.isConfirmBlocked).toBe(false)
            },
        )
    })

    it('does not count an account on another chain as known', () => {
        mocks.accounts = [{ chains: { algorand: { address: ALGO_KNOWN } } }]

        const { result } = render(EVM_KNOWN, ETHEREUM)

        expect(result.current.assessment).toEqual({ kind: 'first-send' })
    })

    it('treats a contact address in another letter case as known on EVM', () => {
        mocks.contacts = [
            { name: 'Alice', addresses: { evm: EVM_KNOWN.toLowerCase() } },
        ]

        const { result } = render(EVM_KNOWN, ETHEREUM)

        expect(result.current.assessment).toEqual({
            kind: 'known',
            source: 'contact',
        })
    })

    it('reports a first send without blocking Confirm', () => {
        mocks.contacts = [{ name: 'Alice', addresses: { evm: EVM_KNOWN } }]

        const { result } = render(EVM_NEW, ETHEREUM)

        expect(result.current.assessment).toEqual({ kind: 'first-send' })
        expect(result.current.isConfirmBlocked).toBe(false)
    })

    it('flags a pasted poisoner as a look-alike of the real counterparty', () => {
        // The trusted-counterparty query leaves out a dust-only sender, so only
        // the real counterparty reaches the known set.
        mocks.counterparties = [{ address: EVM_KNOWN, hasBeenPaid: true }]

        const { result } = render(EVM_LOOK_ALIKE, ETHEREUM)

        expect(result.current.assessment).toMatchObject({
            kind: 'look-alike',
            knownAddress: { address: EVM_KNOWN, source: 'history' },
        })
    })

    it('flags a counterparty that paid the account when it resembles a contact', () => {
        mocks.contacts = [{ name: 'Alice', addresses: { evm: EVM_KNOWN } }]
        mocks.counterparties = [{ address: EVM_LOOK_ALIKE, hasBeenPaid: false }]

        const { result } = render(EVM_LOOK_ALIKE, ETHEREUM)

        expect(result.current.assessment).toMatchObject({
            kind: 'look-alike',
            knownAddress: { address: EVM_KNOWN, source: 'contact' },
        })
        expect(result.current.isConfirmBlocked).toBe(true)
    })

    it('passes a counterparty that paid the account when it resembles nothing vouched for', () => {
        mocks.counterparties = [{ address: EVM_NEW, hasBeenPaid: false }]

        const { result } = render(EVM_NEW, ETHEREUM)

        expect(result.current.assessment).toEqual({
            kind: 'known',
            source: 'history',
        })
    })

    it("holds Confirm on the sender's history and reads the other accounts too", () => {
        mocks.accounts = [
            { chains: { ethereum: { address: EVM_KNOWN } } },
            { chains: { ethereum: { address: EVM_NEW } } },
        ]

        render(EVM_LOOK_ALIKE, ETHEREUM)

        expect(mocks.counterpartiesQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({
                senderAddress: SENDER,
                accountAddresses: [EVM_KNOWN, EVM_NEW],
            }),
        )
    })

    it("shows no first-send notice when the sender's history couldn't load", () => {
        mocks.hasSenderHistory = false

        const { result } = render(EVM_NEW, ETHEREUM)

        expect(result.current.assessment).toBeUndefined()
        expect(result.current.isConfirmBlocked).toBe(false)
    })

    it("still flags a look-alike when the sender's history couldn't load", () => {
        mocks.hasSenderHistory = false
        mocks.contacts = [{ name: 'Alice', addresses: { evm: EVM_KNOWN } }]

        const { result } = render(EVM_LOOK_ALIKE, ETHEREUM)

        expect(result.current.assessment?.kind).toBe('look-alike')
        expect(result.current.isConfirmBlocked).toBe(true)
    })

    describe('with a watched address in the wallet', () => {
        beforeEach(() => {
            mocks.accounts = [
                {
                    name: 'Cold wallet',
                    isWatch: true,
                    chains: { ethereum: { address: EVM_KNOWN } },
                },
                { chains: { ethereum: { address: EVM_NEW } } },
            ]
        })

        it('flags a look-alike of it', () => {
            const { result } = render(EVM_LOOK_ALIKE, ETHEREUM)

            expect(result.current.assessment).toMatchObject({
                kind: 'look-alike',
                knownAddress: {
                    address: EVM_KNOWN,
                    source: 'watched-account',
                    name: 'Cold wallet',
                },
            })
            expect(result.current.isConfirmBlocked).toBe(true)
        })

        it('passes it quietly', () => {
            const { result } = render(EVM_KNOWN, ETHEREUM)

            expect(result.current.assessment).toEqual({
                kind: 'known',
                source: 'watched-account',
            })
        })

        it('does not read its history', () => {
            render(EVM_LOOK_ALIKE, ETHEREUM)

            expect(mocks.counterpartiesQuery).toHaveBeenLastCalledWith(
                expect.objectContaining({ accountAddresses: [EVM_NEW] }),
            )
        })
    })

    it('blocks Confirm while history is still loading', () => {
        mocks.isCounterpartiesPending = true

        const { result } = render(EVM_NEW, ETHEREUM)

        expect(result.current.assessment).toBeUndefined()
        expect(result.current.isPending).toBe(true)
        expect(result.current.isConfirmBlocked).toBe(true)
    })

    it('has nothing to assess without a recipient', () => {
        mocks.isCounterpartiesPending = true

        const { result } = render(undefined, ETHEREUM)

        expect(result.current.assessment).toBeUndefined()
        expect(result.current.isConfirmBlocked).toBe(false)
    })

    it('drops the acknowledgement when the recipient changes', () => {
        mocks.contacts = [{ name: 'Alice', addresses: { evm: EVM_KNOWN } }]
        const { result } = render(EVM_LOOK_ALIKE, ETHEREUM)
        act(() => result.current.toggleAcknowledged())

        act(() => useSendFundsStore.getState().setDestination(EVM_LOOK_ALIKE))

        expect(result.current.isAcknowledged).toBe(false)
        expect(result.current.isConfirmBlocked).toBe(true)
    })
})
