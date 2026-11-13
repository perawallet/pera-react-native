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
    registry: null as null | { changeAccount: ReturnType<typeof vi.fn> },
    pickAccount: vi.fn(),
    showError: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-connections', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-connections')
    >()),
    useOptionalConnectionRegistry: () => mocks.registry,
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAllAccounts: () => mocks.accounts,
    chainAccountOf: (account: MockAccount, chainId: string) =>
        account.chains[chainId],
    accountsSigningOnAll: (
        accounts: MockAccount[],
        _all: unknown,
        chainIds: readonly string[],
    ) =>
        accounts.filter(account =>
            chainIds.every(chainId => account.chains[chainId]),
        ),
    firstHeldAccountOf: (
        held: readonly string[],
        accounts: MockAccount[],
        chainId: string,
    ) => {
        const first = held.find(address => address.startsWith('0x'))
        return (
            accounts.find(
                account => account.chains[chainId]?.address === first,
            ) ?? null
        )
    },
}))

vi.mock('../useConnectAccountPicker', () => ({
    useConnectAccountPicker: () => ({ pickAccount: mocks.pickAccount }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mocks.showError }),
}))

vi.mock('@hooks/useLanguage')

import { useChangeConnectionAccount } from '../useChangeConnectionAccount'

const ONE = { id: 'one', chains: { ethereum: { address: '0x1' } } }
const TWO = { id: 'two', chains: { ethereum: { address: '0x2' } } }
const ALGO = { id: 'algo', chains: { algorand: { address: 'AAAA' } } }

const CONNECTION = {
    id: 'session-1',
    accounts: ['AAAA', '0x1'],
    evmChainIds: ['ethereum' as const],
}

describe('useChangeConnectionAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.accounts = [ONE, TWO, ALGO]
        mocks.registry = { changeAccount: vi.fn(async () => {}) }
        mocks.pickAccount.mockResolvedValue(null)
    })

    it('shows the account the dApp uses on the first EVM chain', () => {
        const { result } = renderHook(() =>
            useChangeConnectionAccount(CONNECTION),
        )

        expect(result.current.evmChainId).toBe('ethereum')
        expect(result.current.activeEvmAccount?.id).toBe('one')
        expect(result.current.isAvailable).toBe(true)
    })

    it('is unavailable for a connection with no EVM chain', () => {
        const { result } = renderHook(() =>
            useChangeConnectionAccount({ ...CONNECTION, evmChainIds: [] }),
        )

        expect(result.current.evmChainId).toBeUndefined()
        expect(result.current.isAvailable).toBe(false)
    })

    it('is unavailable outside a connections provider', () => {
        mocks.registry = null
        const { result } = renderHook(() =>
            useChangeConnectionAccount(CONNECTION),
        )

        expect(result.current.isAvailable).toBe(false)
    })

    it('moves the connection to the picked account’s address', async () => {
        mocks.pickAccount.mockResolvedValueOnce('two')
        const { result } = renderHook(() =>
            useChangeConnectionAccount(CONNECTION),
        )

        await act(() => result.current.handleChangeAccount())

        expect(mocks.pickAccount).toHaveBeenCalledWith(
            expect.objectContaining({
                accounts: [ONE, TWO],
                chainId: 'ethereum',
                selectedAccountId: 'one',
            }),
        )
        expect(mocks.registry?.changeAccount).toHaveBeenCalledWith(
            'session-1',
            'ethereum',
            '0x2',
        )
    })

    it('changes nothing when the picker is dismissed', async () => {
        const { result } = renderHook(() =>
            useChangeConnectionAccount(CONNECTION),
        )

        await act(() => result.current.handleChangeAccount())

        expect(mocks.registry?.changeAccount).not.toHaveBeenCalled()
    })

    it('tells the user when the change fails', async () => {
        const failure = new Error('relay down')
        mocks.pickAccount.mockResolvedValueOnce('two')
        mocks.registry?.changeAccount.mockRejectedValueOnce(failure)
        const { result } = renderHook(() =>
            useChangeConnectionAccount(CONNECTION),
        )

        await act(() => result.current.handleChangeAccount())

        expect(mocks.showError).toHaveBeenCalledWith(
            failure,
            'walletconnect.settings.change_account_failed',
        )
        expect(result.current.isChanging).toBe(false)
    })

    it('tells the user when the picker cannot open', async () => {
        const failure = new Error('chunk failed')
        mocks.pickAccount.mockRejectedValueOnce(failure)
        const { result } = renderHook(() =>
            useChangeConnectionAccount(CONNECTION),
        )

        await act(() => result.current.handleChangeAccount())

        expect(mocks.showError).toHaveBeenCalledWith(
            failure,
            'walletconnect.settings.change_account_failed',
        )
    })

    it('opens one picker for a double tap', async () => {
        let settle: (id: string) => void = () => {}
        mocks.pickAccount.mockReturnValueOnce(
            new Promise<string>(resolve => {
                settle = resolve
            }),
        )
        const { result } = renderHook(() =>
            useChangeConnectionAccount(CONNECTION),
        )

        const first = result.current.handleChangeAccount()
        const second = result.current.handleChangeAccount()
        settle('two')
        await act(async () => {
            await Promise.all([first, second])
        })

        expect(mocks.pickAccount).toHaveBeenCalledTimes(1)
        expect(mocks.registry?.changeAccount).toHaveBeenCalledTimes(1)
    })
})
