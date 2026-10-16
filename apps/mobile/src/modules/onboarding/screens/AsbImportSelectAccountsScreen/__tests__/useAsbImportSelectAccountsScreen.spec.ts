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
import { renderHook, act } from '@testing-library/react'
import { AppState, type AppStateStatus } from 'react-native'
import { DuplicateAccountError } from '@perawallet/wallet-core-accounts'
import type {
    SecureBackupAccount,
    SecureBackupPayload,
} from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'
import { useAsbImportFlowStore } from '@modules/onboarding/hooks'

import { useAsbImportSelectAccountsScreen } from '../useAsbImportSelectAccountsScreen'

const mocks = vi.hoisted(() => ({
    replace: vi.fn(),
    errorToast: vi.fn(),
    importAccount: vi.fn(),
    alreadyImported: new Set<string>(),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ replace: mocks.replace }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mocks.errorToast }),
}))

vi.mock('@hooks/useLanguage')

vi.mock('@modules/onboarding/hooks', async () => ({
    useAsbImportFlowStore: (
        await vi.importActual<
            typeof import('@modules/onboarding/hooks/asbImportFlowStore')
        >('@modules/onboarding/hooks/asbImportFlowStore')
    ).useAsbImportFlowStore,
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<object>()),
    useAllAccounts: () => [],
}))

vi.mock('@perawallet/wallet-core-backup', async importOriginal => ({
    ...(await importOriginal<object>()),
    useSecureBackupAccountImport: () => ({
        importAccount: mocks.importAccount,
    }),
    partitionImportableAccounts: (accounts: SecureBackupAccount[]) => ({
        importable: accounts.filter(a => !mocks.alreadyImported.has(a.address)),
        alreadyImported: accounts.filter(a =>
            mocks.alreadyImported.has(a.address),
        ),
        unsupported: [],
    }),
}))

const backupAccount = (address: string): SecureBackupAccount => ({
    address,
    name: address,
    kind: 'single',
    privateKey: new Uint8Array([1, 2, 3]),
})

const loadPayload = (...addresses: string[]): SecureBackupPayload => {
    const payload: SecureBackupPayload = {
        accounts: addresses.map(backupAccount),
        providerName: null,
        deviceId: null,
    }
    useAsbImportFlowStore.getState().setPayload(payload)
    return payload
}

const select = (...addresses: string[]): void =>
    useAsbImportFlowStore.getState().setSelection(addresses)

const appStateListener = (): ((state: AppStateStatus) => void) =>
    vi.mocked(AppState.addEventListener).mock.calls.at(-1)?.[1] as (
        state: AppStateStatus,
    ) => void

const renderScreen = () => renderHook(() => useAsbImportSelectAccountsScreen())

describe('useAsbImportSelectAccountsScreen', () => {
    beforeEach(() => {
        useAsbImportFlowStore.getState().reset()
        mocks.alreadyImported = new Set()
        mocks.importAccount.mockResolvedValue(undefined)
    })

    it('shows nothing and cannot continue without a decrypted payload', async () => {
        const { result } = renderScreen()

        await act(() => result.current.handleContinue())

        expect(result.current.items).toEqual([])
        expect(result.current.areAllImported).toBe(false)
        expect(result.current.isAllSelected).toBe(false)
        expect(result.current.canContinue).toBe(false)
        expect(mocks.importAccount).not.toHaveBeenCalled()
    })

    it('lists importable accounts before already-imported ones and selects only importable', () => {
        mocks.alreadyImported = new Set(['B'])
        loadPayload('A', 'B', 'C')

        const { result } = renderScreen()

        expect(
            result.current.items.map(i => [i.address, i.isAlreadyImported]),
        ).toEqual([
            ['A', false],
            ['C', false],
            ['B', true],
        ])
        expect([...result.current.selectedAddresses]).toEqual(['A', 'C'])
        expect(result.current.importableCount).toBe(2)
        expect(result.current.isAllSelected).toBe(true)
        expect(result.current.canContinue).toBe(true)
    })

    it('flags a backup whose accounts are all already imported', () => {
        mocks.alreadyImported = new Set(['A', 'B'])
        loadPayload('A', 'B')

        const { result } = renderScreen()

        expect(result.current.areAllImported).toBe(true)
        expect(result.current.isAllSelected).toBe(false)
        expect(result.current.canContinue).toBe(false)
    })

    it('selects none when everything is selected', () => {
        loadPayload('A', 'B')
        const { result } = renderScreen()

        act(() => result.current.toggleSelectAll())

        expect(result.current.selectedAddresses.size).toBe(0)
        expect(result.current.isAllSelected).toBe(false)
        expect(result.current.canContinue).toBe(false)
    })

    it('selects every importable account from a partial selection', () => {
        mocks.alreadyImported = new Set(['C'])
        loadPayload('A', 'B', 'C')
        select('A')
        const { result } = renderScreen()
        expect(result.current.isAllSelected).toBe(false)

        act(() => result.current.toggleSelectAll())

        expect([...result.current.selectedAddresses].sort()).toEqual(['A', 'B'])
        expect(result.current.isAllSelected).toBe(true)
    })

    it('toggles a single account', () => {
        loadPayload('A', 'B')
        const { result } = renderScreen()

        act(() => result.current.toggleSelection('A'))

        expect([...result.current.selectedAddresses]).toEqual(['B'])
        expect(result.current.isAllSelected).toBe(false)
    })

    it('imports the selected accounts in payload order, wipes their keys and shows the result', async () => {
        const payload = loadPayload('A', 'B', 'C')
        select('C', 'A')
        const [a, , c] = payload.accounts
        const aKey = a.privateKey as Uint8Array
        const { result } = renderScreen()

        await act(() => result.current.handleContinue())

        expect(
            mocks.importAccount.mock.calls.map(([acc]) => acc.address),
        ).toEqual(['A', 'C'])
        expect(a.privateKey).toBeNull()
        expect(c.privateKey).toBeNull()
        expect(aKey.every(byte => byte === 0)).toBe(true)
        expect(useAsbImportFlowStore.getState().payload).toBeNull()
        expect(mocks.replace).toHaveBeenCalledWith('AsbImportResult', {
            importedCount: 2,
            skippedDuplicateCount: 0,
            failedCount: 0,
        })
    })

    it('counts duplicates as skipped and other failures as failed', async () => {
        loadPayload('A', 'B', 'C')
        const failure = new Error('boom')
        mocks.importAccount
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new DuplicateAccountError('B'))
            .mockRejectedValueOnce(failure)
        const { result } = renderScreen()

        await act(() => result.current.handleContinue())

        expect(logger.error).toHaveBeenCalledWith('ASB account import failed', {
            error: failure,
            address: 'C',
        })
        expect(mocks.replace).toHaveBeenCalledWith('AsbImportResult', {
            importedCount: 1,
            skippedDuplicateCount: 1,
            failedCount: 1,
        })
    })

    it.each([
        ['before the next account', ['A', 'B']],
        ['on the last account', ['A']],
    ])(
        'stops and does not navigate when the app is backgrounded %s',
        async (_, addresses) => {
            loadPayload(...addresses)
            mocks.importAccount.mockImplementationOnce(async () => {
                appStateListener()('background')
            })
            const { result } = renderScreen()

            await act(() => result.current.handleContinue())

            expect(mocks.importAccount).toHaveBeenCalledTimes(1)
            expect(mocks.replace).not.toHaveBeenCalled()
            expect(useAsbImportFlowStore.getState().payload).toBeNull()
        },
    )

    it('shows an error when the batch fails outside a single import', async () => {
        loadPayload('A')
        mocks.replace.mockImplementationOnce(() => {
            throw new Error('navigation gone')
        })
        const { result } = renderScreen()

        await act(() => result.current.handleContinue())

        expect(mocks.errorToast).toHaveBeenCalledWith(
            'onboarding.asb_import.select.errors.title',
            'onboarding.asb_import.select.errors.body',
        )
        expect(result.current.isProcessing).toBe(false)
    })

    it('ignores a second continue while an import is running', async () => {
        loadPayload('A')
        let finishImport: () => void = () => undefined
        mocks.importAccount.mockReturnValueOnce(
            new Promise<void>(resolve => {
                finishImport = resolve
            }),
        )
        const { result } = renderScreen()

        let first: Promise<void> = Promise.resolve()
        act(() => {
            first = result.current.handleContinue()
        })
        expect(result.current.isProcessing).toBe(true)
        expect(result.current.canContinue).toBe(false)

        await act(() => result.current.handleContinue())
        await act(async () => {
            finishImport()
            await first
        })

        expect(mocks.importAccount).toHaveBeenCalledTimes(1)
    })

    it('wipes the decrypted payload when the app leaves the foreground', () => {
        loadPayload('A')
        renderScreen()

        act(() => appStateListener()('active'))
        expect(useAsbImportFlowStore.getState().payload).not.toBeNull()

        act(() => appStateListener()('inactive'))
        expect(useAsbImportFlowStore.getState().payload).toBeNull()
    })

    it('wipes the decrypted payload and stops listening when the screen unmounts', () => {
        const remove = vi.fn()
        vi.mocked(AppState.addEventListener).mockReturnValueOnce({ remove })
        loadPayload('A')
        const { unmount } = renderScreen()

        unmount()

        expect(remove).toHaveBeenCalledTimes(1)
        expect(useAsbImportFlowStore.getState().payload).toBeNull()
    })
})
