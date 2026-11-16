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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { CloudBackupRestoreError } from '@perawallet/wallet-core-backup'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'

const {
    completeMock,
    discardMock,
    clearDraftMock,
    showToastMock,
    goBackMock,
    onDoneMock,
    lockMock,
    allowNavigationMock,
    state,
} = vi.hoisted(() => ({
    completeMock: vi.fn(),
    discardMock: vi.fn(),
    clearDraftMock: vi.fn(),
    showToastMock: vi.fn(),
    goBackMock: vi.fn(),
    onDoneMock: vi.fn(),
    lockMock: vi.fn(),
    allowNavigationMock: vi.fn(),
    state: {
        accounts: [] as unknown[],
        deviceAccounts: [] as unknown[],
        isPending: false,
        callbacks: null as null | {
            onSuccess: (result: unknown) => void
            onError: (error: unknown) => void
        },
    },
}))

vi.mock('@perawallet/wallet-core-backup', async importOriginal => ({
    ...(await importOriginal<object>()),
    useCloudBackupRestoreSessionStore: (sel: (s: unknown) => unknown) =>
        sel({ session: { prepared: { accounts: state.accounts } } }),
    useCloudBackupRestoreDraftStore: (sel: (s: unknown) => unknown) =>
        sel({ clearDraft: clearDraftMock }),
    useDiscardCloudBackupRestore: () => ({ discard: discardMock }),
    useCompleteCloudBackupRestoreMutation: (
        _scope: unknown,
        options: NonNullable<typeof state.callbacks>,
    ) => {
        state.callbacks = options
        return { mutate: completeMock, isPending: state.isPending }
    },
}))
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<object>()),
    useAccountsStore: (sel: (s: unknown) => unknown) =>
        sel({ accounts: state.deviceAccounts }),
}))
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    useSelectedScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
}))
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ goBack: goBackMock }),
}))
vi.mock('@hooks/useNavigationLock', () => ({
    useNavigationLock: (isLocked: boolean) => {
        lockMock(isLocked)
        return { allowProgrammaticNavigation: allowNavigationMock }
    },
}))
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: showToastMock }),
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: unknown) =>
            options ? `${key}:${JSON.stringify(options)}` : key,
    }),
}))

import { useCloudBackupRestoreSelectAccountsScreen } from '../useCloudBackupRestoreSelectAccountsScreen'

const ALPHA = {
    group: 'ALPHA',
    name: 'Alpha',
    chains: [
        { chain: 'algorand', address: 'ALPHAADDRESSALPHAADDRESS' },
        { chain: 'ethereum', address: '0xalpha' },
    ],
}
const BRAVO = {
    group: 'BRAVO',
    name: null,
    chains: [{ chain: 'algorand', address: 'BRAVOADDRESSBRAVOADDRESS' }],
}

const renderScreen = () =>
    renderHook(() =>
        useCloudBackupRestoreSelectAccountsScreen({ onDone: onDoneMock }),
    )

describe('useCloudBackupRestoreSelectAccountsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        state.accounts = [ALPHA, BRAVO]
        state.deviceAccounts = []
        state.isPending = false
        state.callbacks = null
    })

    it('offers every backup account, restoring all of them by default', () => {
        const { result } = renderScreen()

        expect(result.current.accountCount).toBe(2)
        expect(result.current.mode).toBe('all')
        expect(result.current.canRestore).toBe(true)

        act(() => result.current.handleRestore())

        expect(completeMock).toHaveBeenCalledWith('all')
    })

    it('names an unnamed account by its address alone and shows chains only for a multichain one', () => {
        const { result } = renderScreen()
        const [alpha, bravo] = result.current.rows

        expect(alpha).toMatchObject({
            title: 'Alpha',
            subtitle: expect.stringContaining('ALPHA'),
            chainIds: ['algorand', 'ethereum'],
        })
        expect(bravo?.title).toContain('BRAVO')
        expect(bravo?.subtitle).toBeUndefined()
        expect(bravo?.chainIds).toEqual([])
    })

    it('leaves out the subtitle when the name is the short address itself', () => {
        const shortAddress = truncateAlgorandAddress(BRAVO.chains[0]!.address)
        state.accounts = [{ ...BRAVO, name: shortAddress }]

        const { result } = renderScreen()

        expect(result.current.rows[0]?.title).toBe(shortAddress)
        expect(result.current.rows[0]?.subtitle).toBeUndefined()
    })

    it('restores only the accounts the user checks', () => {
        const { result } = renderScreen()

        act(() => result.current.handleSelectMode('selected'))
        expect(result.current.canRestore).toBe(false)

        act(() => result.current.handleToggleAccount('BRAVO'))
        act(() => result.current.handleToggleAccount('ALPHA'))
        act(() => result.current.handleToggleAccount('ALPHA'))

        expect(result.current.rows.map(row => row.isSelected)).toEqual([
            false,
            true,
        ])
        expect(result.current.canRestore).toBe(true)

        act(() => result.current.handleRestore())

        expect(completeMock).toHaveBeenCalledWith(new Set(['BRAVO']))
    })

    it('counts the accounts already on this device, which the restore adds to the backup', () => {
        state.deviceAccounts = [{}, {}, {}]

        const { result } = renderScreen()

        expect(result.current.deviceAccountCount).toBe(3)
    })

    it('blocks a second restore while one is in flight', () => {
        state.isPending = true

        const { result } = renderScreen()

        expect(result.current.canRestore).toBe(false)
    })

    it('locks leaving the screen from the moment the restore starts', () => {
        const { result } = renderScreen()
        expect(lockMock).toHaveBeenLastCalledWith(false)

        act(() => result.current.handleRestore())

        expect(lockMock).toHaveBeenLastCalledWith(true)
    })

    it('unlocks before its own exit once restored', () => {
        renderScreen()

        act(() =>
            state.callbacks?.onSuccess({
                incompleteAccountCount: 0,
                newerAccountCount: 0,
            }),
        )

        expect(allowNavigationMock.mock.invocationCallOrder[0]).toBeLessThan(
            onDoneMock.mock.invocationCallOrder[0]!,
        )
    })

    it('clears the draft and hands the exit back to the caller once restored', () => {
        renderScreen()

        act(() =>
            state.callbacks?.onSuccess({
                incompleteAccountCount: 0,
                newerAccountCount: 0,
            }),
        )

        expect(clearDraftMock).toHaveBeenCalled()
        expect(onDoneMock).toHaveBeenCalled()
    })

    it('reports a failed restore and goes back, since the restore has to start over', () => {
        renderScreen()

        act(() =>
            state.callbacks?.onError(new CloudBackupRestoreError('UNKNOWN')),
        )

        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'cloud_backup.restore.error_unknown',
                type: 'error',
            }),
        )
        expect(allowNavigationMock.mock.invocationCallOrder[0]).toBeLessThan(
            goBackMock.mock.invocationCallOrder[0]!,
        )
        expect(onDoneMock).not.toHaveBeenCalled()
    })

    it('ends the waiting restore when the user leaves the screen', () => {
        const { unmount } = renderScreen()
        expect(discardMock).not.toHaveBeenCalled()

        unmount()

        expect(discardMock).toHaveBeenCalledTimes(1)
    })
})
