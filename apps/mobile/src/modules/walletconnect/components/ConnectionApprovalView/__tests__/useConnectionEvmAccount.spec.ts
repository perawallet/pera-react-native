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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockAccount = { id: string; chains: Record<string, { address: string }> }

const mocks = vi.hoisted(() => ({
    accounts: [] as MockAccount[],
    selectedAccountId: undefined as string | undefined,
    connections: [] as unknown[],
    pickAccount: vi.fn(),
    firstUnreachableChainsNote: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAllAccounts: () => mocks.accounts,
    useSelectedAccountId: () => ({
        selectedAccountId: mocks.selectedAccountId,
    }),
    firstUnreachableChainsNote: mocks.firstUnreachableChainsNote,
    findAccountByAddressOn: (
        accounts: MockAccount[],
        chainId: string,
        address: string,
    ) => accounts.find(account => account.chains[chainId]?.address === address),
    accountsSigningOnAll: (
        accounts: MockAccount[],
        _all: unknown,
        chainIds: readonly string[],
    ) =>
        chainIds.length === 0
            ? []
            : accounts.filter(account =>
                  chainIds.every(chainId => account.chains[chainId]),
              ),
}))

vi.mock('@perawallet/wallet-core-connections', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-connections')
    >()),
    useConnectionsStore: (
        select: (state: { connections: unknown[] }) => unknown,
    ) => select({ connections: mocks.connections }),
}))

vi.mock('../../../hooks/useConnectAccountPicker', () => ({
    useConnectAccountPicker: () => ({ pickAccount: mocks.pickAccount }),
}))

vi.mock('@hooks/useLanguage')

import { useConnectionEvmAccount } from '../useConnectionEvmAccount'

const ONE = { id: 'one', chains: { ethereum: { address: '0x1' } } }
const TWO = { id: 'two', chains: { ethereum: { address: '0x2' } } }
const ALGO = { id: 'algo', chains: { algorand: { address: 'AAAA' } } }

const proposal = (overrides: Record<string, unknown> = {}) =>
    ({
        kind: 'walletconnect-v2',
        proposalId: 'p1',
        peer: { name: 'Uniswap' },
        requested: { networks: ['mainnet'], chains: ['ethereum'], methods: [] },
        expiresAt: Date.now() + 60_000,
        approve: vi.fn(),
        reject: vi.fn(),
        ...overrides,
    }) as never

const render = (chains: string[] = ['ethereum'], overrides = {}) =>
    renderHook(() =>
        useConnectionEvmAccount(
            proposal(overrides),
            mocks.accounts as never,
            chains as never,
        ),
    )

describe('useConnectionEvmAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.accounts = [ONE, TWO, ALGO]
        mocks.selectedAccountId = undefined
        mocks.connections = []
        mocks.pickAccount.mockResolvedValue(null)
        mocks.firstUnreachableChainsNote.mockReturnValue(null)
    })

    it('preselects the account selected in Pera when it can sign', () => {
        mocks.selectedAccountId = 'two'

        const { result } = render()

        expect(result.current.evmAccount?.id).toBe('two')
    })

    it('falls back to the first account that can sign', () => {
        mocks.selectedAccountId = 'algo'

        const { result } = render()

        expect(result.current.evmAccount?.id).toBe('one')
    })

    it('starts a re-prompt on the account the site is already connected with', () => {
        mocks.selectedAccountId = 'one'
        mocks.connections = [
            {
                kind: 'dapp-eip1193',
                accounts: ['0x2'],
                origin: { requesterOrigin: 'https://app.uniswap.org' },
            },
        ]

        const { result } = render(['ethereum'], {
            kind: 'dapp-eip1193',
            requesterOrigin: 'https://app.uniswap.org',
        })

        expect(result.current.evmAccount?.id).toBe('two')
    })

    it('switches to the account picked, and keeps it when the picker is dismissed', async () => {
        mocks.pickAccount.mockResolvedValueOnce('two')
        const { result } = render()

        await act(() => result.current.handleEvmAccountPress())
        expect(result.current.evmAccount?.id).toBe('two')

        await act(() => result.current.handleEvmAccountPress())
        expect(result.current.evmAccount?.id).toBe('two')
    })

    it('offers nothing for a proposal without an EVM chain', () => {
        const { result } = render([])

        expect(result.current.evmChainId).toBeUndefined()
        expect(result.current.evmAccount).toBeNull()
        expect(result.current.evmNoAccountsNote).toBeUndefined()
    })

    // A mixed proposal still lists Algorand accounts, so the list's own
    // empty note never shows; the row says why it is empty.
    it("explains an empty EVM row with the kind's note for the EVM chains", () => {
        mocks.accounts = [ALGO]
        mocks.firstUnreachableChainsNote.mockReturnValue('kind.unreachable')

        const { result } = render(['ethereum'])

        expect(result.current.evmAccount).toBeNull()
        expect(result.current.evmNoAccountsNote).toBe('kind.unreachable')
        expect(mocks.firstUnreachableChainsNote).toHaveBeenCalledWith(
            [ALGO],
            ['ethereum'],
        )
    })

    it('falls back to the generic note when no kind says why', () => {
        mocks.accounts = [ALGO]

        const { result } = render(['ethereum'])

        expect(result.current.evmNoAccountsNote).toBe(
            'walletconnect.request.no_accounts',
        )
    })
})
