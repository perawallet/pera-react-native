/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAccountOptions } from '../useAccountOptions'
import { AccountTypes, WalletAccount } from '@perawallet/wallet-core-accounts'

const { mockCopyToClipboard } = vi.hoisted(() => ({
    mockCopyToClipboard: vi.fn(),
}))
const { mockShowToast } = vi.hoisted(() => ({ mockShowToast: vi.fn() }))
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
const { mockIsAccountEnabled, mockSetAccountEnabled } = vi.hoisted(() => ({
    mockIsAccountEnabled: vi.fn(() => true),
    mockSetAccountEnabled: vi.fn(),
}))
const { mockRemoveAccountById } = vi.hoisted(() => ({
    mockRemoveAccountById: vi.fn(),
}))
const { mockUpdateAccount } = vi.hoisted(() => ({
    mockUpdateAccount: vi.fn(),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({
        copyToClipboard: mockCopyToClipboard,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
    }),
}))

vi.mock('@perawallet/wallet-core-notifications', () => ({
    useNotificationPreferences: () => ({
        disabledAccounts: [],
        isAccountEnabled: mockIsAccountEnabled,
        setAccountEnabled: mockSetAccountEnabled,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useRemoveAccountById: () => mockRemoveAccountById,
        useUpdateAccount: () => mockUpdateAccount,
    }
})

describe('useAccountOptions', () => {
    const mockOnClose = vi.fn()

    const algo25Account: WalletAccount = {
        id: 'acc-1',
        address: 'ALGO25ADDRESS',
        type: AccountTypes.algo25,
        keyPairId: 'key-1',
        name: 'My Account',
    }

    const watchAccount: WalletAccount = {
        id: 'acc-2',
        address: 'WATCHADDRESS',
        type: AccountTypes.watch,
    }

    const rekeyedAccount: WalletAccount = {
        id: 'acc-3',
        address: 'REKEYEDADDRESS',
        type: AccountTypes.algo25,
        keyPairId: 'key-3',
        rekeyAddress: 'AUTHADDRESS',
    }

    const hardwareAccount: WalletAccount = {
        id: 'acc-4',
        address: 'HARDWAREADDRESS',
        type: AccountTypes.hardware,
        hardwareDetails: { manufacturer: 'ledger' },
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockIsAccountEnabled.mockReturnValue(true)
    })

    describe('option visibility', () => {
        it('shows base options for all account types', () => {
            const { result } = renderHook(() =>
                useAccountOptions(algo25Account, mockOnClose),
            )

            const optionIds = result.current.options.map(o => o.id)
            expect(optionIds).toContain('copy-address')
            expect(optionIds).toContain('show-qr')
            expect(optionIds).toContain('rename-account')
            expect(optionIds).toContain('toggle-notifications')
            expect(optionIds).toContain('remove-account')
        })

        it('shows view passphrase for algo25 accounts', () => {
            const { result } = renderHook(() =>
                useAccountOptions(algo25Account, mockOnClose),
            )

            const optionIds = result.current.options.map(o => o.id)
            expect(optionIds).toContain('view-passphrase')
        })

        it('does not show view passphrase for watch accounts', () => {
            const { result } = renderHook(() =>
                useAccountOptions(watchAccount, mockOnClose),
            )

            const optionIds = result.current.options.map(o => o.id)
            expect(optionIds).not.toContain('view-passphrase')
        })

        it('does not show view passphrase for hardware accounts', () => {
            const { result } = renderHook(() =>
                useAccountOptions(hardwareAccount, mockOnClose),
            )

            const optionIds = result.current.options.map(o => o.id)
            expect(optionIds).not.toContain('view-passphrase')
        })

        it('shows auth address for rekeyed accounts', () => {
            const { result } = renderHook(() =>
                useAccountOptions(rekeyedAccount, mockOnClose),
            )

            const optionIds = result.current.options.map(o => o.id)
            expect(optionIds).toContain('auth-address')
        })

        it('does not show auth address for non-rekeyed accounts', () => {
            const { result } = renderHook(() =>
                useAccountOptions(algo25Account, mockOnClose),
            )

            const optionIds = result.current.options.map(o => o.id)
            expect(optionIds).not.toContain('auth-address')
        })

        it('shows undo rekey for rekeyed accounts that can sign', () => {
            const { result } = renderHook(() =>
                useAccountOptions(rekeyedAccount, mockOnClose),
            )

            const optionIds = result.current.options.map(o => o.id)
            expect(optionIds).toContain('undo-rekey')
        })

        it('shows rekey options for accounts that can sign', () => {
            const { result } = renderHook(() =>
                useAccountOptions(algo25Account, mockOnClose),
            )

            const optionIds = result.current.options.map(o => o.id)
            expect(optionIds).toContain('rekey-to-ledger')
            expect(optionIds).toContain('rekey-to-standard')
        })

        it('does not show rekey options for watch accounts', () => {
            const { result } = renderHook(() =>
                useAccountOptions(watchAccount, mockOnClose),
            )

            const optionIds = result.current.options.map(o => o.id)
            expect(optionIds).not.toContain('rekey-to-ledger')
            expect(optionIds).not.toContain('rekey-to-standard')
        })
    })

    describe('handlers', () => {
        it('copies address and closes when copy address is pressed', () => {
            const { result } = renderHook(() =>
                useAccountOptions(algo25Account, mockOnClose),
            )

            const copyOption = result.current.options.find(
                o => o.id === 'copy-address',
            )

            act(() => {
                copyOption?.onPress()
            })

            expect(mockCopyToClipboard).toHaveBeenCalledWith('ALGO25ADDRESS')
            expect(mockOnClose).toHaveBeenCalled()
        })

        it('toggles notifications from enabled to disabled', () => {
            mockIsAccountEnabled.mockReturnValue(true)

            const { result } = renderHook(() =>
                useAccountOptions(algo25Account, mockOnClose),
            )

            const notifOption = result.current.options.find(
                o => o.id === 'toggle-notifications',
            )

            act(() => {
                notifOption?.onPress()
            })

            expect(mockSetAccountEnabled).toHaveBeenCalledWith(
                'ALGO25ADDRESS',
                false,
            )
            expect(mockShowToast).toHaveBeenCalledWith({
                title: 'account_options.notifications_muted',
                body: '',
                type: 'success',
            })
            expect(mockOnClose).toHaveBeenCalled()
        })

        it('toggles notifications from disabled to enabled', () => {
            mockIsAccountEnabled.mockReturnValue(false)

            const { result } = renderHook(() =>
                useAccountOptions(algo25Account, mockOnClose),
            )

            const notifOption = result.current.options.find(
                o => o.id === 'toggle-notifications',
            )

            act(() => {
                notifOption?.onPress()
            })

            expect(mockSetAccountEnabled).toHaveBeenCalledWith(
                'ALGO25ADDRESS',
                true,
            )
            expect(mockShowToast).toHaveBeenCalledWith({
                title: 'account_options.notifications_unmuted',
                body: '',
                type: 'success',
            })
        })

        it('opens rename sheet when rename is pressed', () => {
            const { result } = renderHook(() =>
                useAccountOptions(algo25Account, mockOnClose),
            )

            expect(result.current.isRenameVisible).toBe(false)

            const renameOption = result.current.options.find(
                o => o.id === 'rename-account',
            )

            act(() => {
                renameOption?.onPress()
            })

            expect(result.current.isRenameVisible).toBe(true)
        })

        it('renames account and closes when handleRename is called', () => {
            const { result } = renderHook(() =>
                useAccountOptions(algo25Account, mockOnClose),
            )

            act(() => {
                result.current.handleRename('New Name')
            })

            expect(mockUpdateAccount).toHaveBeenCalledWith({
                ...algo25Account,
                name: 'New Name',
            })
            expect(mockOnClose).toHaveBeenCalled()
        })

        it('opens remove confirm when remove is pressed', () => {
            const { result } = renderHook(() =>
                useAccountOptions(algo25Account, mockOnClose),
            )

            expect(result.current.isRemoveConfirmVisible).toBe(false)

            const removeOption = result.current.options.find(
                o => o.id === 'remove-account',
            )

            act(() => {
                removeOption?.onPress()
            })

            expect(result.current.isRemoveConfirmVisible).toBe(true)
        })

        it('removes account and navigates home when confirm remove is called', () => {
            const { result } = renderHook(() =>
                useAccountOptions(algo25Account, mockOnClose),
            )

            act(() => {
                result.current.handleConfirmRemove()
            })

            expect(mockRemoveAccountById).toHaveBeenCalledWith('acc-1')
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Home',
            })
            expect(mockOnClose).toHaveBeenCalled()
        })

        it('copies rekey auth address when auth address option is pressed', () => {
            const { result } = renderHook(() =>
                useAccountOptions(rekeyedAccount, mockOnClose),
            )

            const authOption = result.current.options.find(
                o => o.id === 'auth-address',
            )

            act(() => {
                authOption?.onPress()
            })

            expect(mockCopyToClipboard).toHaveBeenCalledWith('AUTHADDRESS')
            expect(mockOnClose).toHaveBeenCalled()
        })

        it('shows notification mute label when notifications are enabled', () => {
            mockIsAccountEnabled.mockReturnValue(true)

            const { result } = renderHook(() =>
                useAccountOptions(algo25Account, mockOnClose),
            )

            const notifOption = result.current.options.find(
                o => o.id === 'toggle-notifications',
            )

            expect(notifOption?.title).toBe(
                'account_options.mute_notifications',
            )
            expect(notifOption?.icon).toBe('bell-off')
        })

        it('shows notification unmute label when notifications are disabled', () => {
            mockIsAccountEnabled.mockReturnValue(false)

            const { result } = renderHook(() =>
                useAccountOptions(algo25Account, mockOnClose),
            )

            const notifOption = result.current.options.find(
                o => o.id === 'toggle-notifications',
            )

            expect(notifOption?.title).toBe(
                'account_options.unmute_notifications',
            )
            expect(notifOption?.icon).toBe('bell')
        })
    })
})
