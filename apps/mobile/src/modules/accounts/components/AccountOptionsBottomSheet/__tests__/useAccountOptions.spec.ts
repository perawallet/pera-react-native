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
const { mockAllAccounts } = vi.hoisted(() => ({
    mockAllAccounts: vi.fn((): WalletAccount[] => []),
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
        useAllAccounts: () => mockAllAccounts(),
    }
})

describe('useAccountOptions', () => {
    const mockOnClose = vi.fn()
    const mockOnShowAddress = vi.fn()

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

    const rekeyedWatchAccount: WalletAccount = {
        id: 'acc-5',
        address: 'REKEYEDWATCHADDRESS',
        type: AccountTypes.watch,
        rekeyAddress: 'ALGO25ADDRESS',
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
        mockAllAccounts.mockReturnValue([algo25Account, watchAccount])
    })

    describe('option visibility', () => {
        it('shows all options for a regular algo25 account', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const optionIds = result.current.options.map(o => o.id)
            expect(optionIds).toEqual([
                'copy-address',
                'show-address',
                'view-passphrase',
                'rekey-to-ledger',
                'rekey-to-standard',
                'rename-account',
                'toggle-notifications',
                'remove-account',
            ])
        })

        it('shows only applicable options for a watch account', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: watchAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const optionIds = result.current.options.map(o => o.id)
            expect(optionIds).toEqual([
                'copy-address',
                'show-address',
                'rename-account',
                'toggle-notifications',
                'remove-account',
            ])
        })

        it('shows all options including rekey for a rekeyed account', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: rekeyedAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const optionIds = result.current.options.map(o => o.id)
            expect(optionIds).toEqual([
                'copy-address',
                'show-address',
                'view-passphrase',
                'auth-address',
                'undo-rekey',
                'rekey-to-ledger',
                'rekey-to-standard',
                'rename-account',
                'toggle-notifications',
                'remove-account',
            ])
        })

        it('shows rekey options but hides undo-rekey for a rekeyed watch account with auth in wallet', () => {
            mockAllAccounts.mockReturnValue([
                algo25Account,
                rekeyedWatchAccount,
            ])

            const { result } = renderHook(() =>
                useAccountOptions({
                    account: rekeyedWatchAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const optionIds = result.current.options.map(o => o.id)
            expect(optionIds).toContain('auth-address')
            expect(optionIds).toContain('rekey-to-ledger')
            expect(optionIds).toContain('rekey-to-standard')
            expect(optionIds).not.toContain('undo-rekey')
            expect(optionIds).not.toContain('view-passphrase')
        })

        it('hides passphrase and rekey for a hardware account', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: hardwareAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const optionIds = result.current.options.map(o => o.id)
            expect(optionIds).toEqual([
                'copy-address',
                'show-address',
                'rename-account',
                'toggle-notifications',
                'remove-account',
            ])
        })
    })

    describe('handlers', () => {
        it('copies address and closes when copy address is pressed', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
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

        it('includes truncated address as subtitle on copy-address option', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const copyOption = result.current.options.find(
                o => o.id === 'copy-address',
            )

            expect(copyOption?.subtitle).toBeDefined()
            expect(copyOption?.subtitle).toBe('ALGO25ADDRESS')
        })

        it('toggles notifications from enabled to disabled', () => {
            mockIsAccountEnabled.mockReturnValue(true)

            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
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
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
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

        it('closes options sheet and opens rename sheet when rename is pressed', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            expect(result.current.isRenameVisible).toBe(false)

            const renameOption = result.current.options.find(
                o => o.id === 'rename-account',
            )

            act(() => {
                renameOption?.onPress()
            })

            expect(mockOnClose).toHaveBeenCalled()
            expect(result.current.isRenameVisible).toBe(true)
        })

        it('renames account and closes rename sheet when handleRename is called', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            act(() => {
                result.current.handleRename('New Name')
            })

            expect(mockUpdateAccount).toHaveBeenCalledWith({
                ...algo25Account,
                name: 'New Name',
            })
            expect(result.current.isRenameVisible).toBe(false)
        })

        it('closes options sheet and opens remove confirm when remove is pressed', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            expect(result.current.isRemoveConfirmVisible).toBe(false)

            const removeOption = result.current.options.find(
                o => o.id === 'remove-account',
            )

            act(() => {
                removeOption?.onPress()
            })

            expect(mockOnClose).toHaveBeenCalled()
            expect(result.current.isRemoveConfirmVisible).toBe(true)
        })

        it('removes account and navigates home when confirm remove is called', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            act(() => {
                result.current.handleConfirmRemove()
            })

            expect(mockRemoveAccountById).toHaveBeenCalledWith('acc-1')
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Home',
            })
        })

        it('copies rekey auth address when auth address option is pressed', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: rekeyedAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
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
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const notifOption = result.current.options.find(
                o => o.id === 'toggle-notifications',
            )

            expect(notifOption?.title).toBe(
                'account_options.mute_notifications',
            )
            expect(notifOption?.icon).toBe('bell')
        })

        it('shows notification unmute label when notifications are disabled', () => {
            mockIsAccountEnabled.mockReturnValue(false)

            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const notifOption = result.current.options.find(
                o => o.id === 'toggle-notifications',
            )

            expect(notifOption?.title).toBe(
                'account_options.unmute_notifications',
            )
            expect(notifOption?.icon).toBe('bell')
        })

        it('calls onShowAddress when show-address option is pressed', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const showOption = result.current.options.find(
                o => o.id === 'show-address',
            )

            act(() => {
                showOption?.onPress()
            })

            expect(mockOnClose).toHaveBeenCalled()
            expect(mockOnShowAddress).toHaveBeenCalled()
        })

        it('shows not implemented toast for view-passphrase', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const passphraseOption = result.current.options.find(
                o => o.id === 'view-passphrase',
            )

            act(() => {
                passphraseOption?.onPress()
            })

            expect(mockShowToast).toHaveBeenCalledWith({
                title: 'common.not_implemented.title',
                body: 'common.not_implemented.body',
                type: 'error',
            })
            expect(mockOnClose).toHaveBeenCalled()
        })

        it('shows not implemented toast for rekey-to-ledger', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const rekeyOption = result.current.options.find(
                o => o.id === 'rekey-to-ledger',
            )

            act(() => {
                rekeyOption?.onPress()
            })

            expect(mockShowToast).toHaveBeenCalledWith({
                title: 'common.not_implemented.title',
                body: 'common.not_implemented.body',
                type: 'error',
            })
        })

        it('shows not implemented toast for rekey-to-standard', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const rekeyOption = result.current.options.find(
                o => o.id === 'rekey-to-standard',
            )

            act(() => {
                rekeyOption?.onPress()
            })

            expect(mockShowToast).toHaveBeenCalledWith({
                title: 'common.not_implemented.title',
                body: 'common.not_implemented.body',
                type: 'error',
            })
        })

        it('shows not implemented toast for undo-rekey', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: rekeyedAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const undoOption = result.current.options.find(
                o => o.id === 'undo-rekey',
            )

            act(() => {
                undoOption?.onPress()
            })

            expect(mockShowToast).toHaveBeenCalledWith({
                title: 'common.not_implemented.title',
                body: 'common.not_implemented.body',
                type: 'error',
            })
        })

        it('does not navigate when removing the last account', () => {
            mockAllAccounts.mockReturnValue([algo25Account])

            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            act(() => {
                result.current.handleConfirmRemove()
            })

            expect(mockRemoveAccountById).toHaveBeenCalledWith('acc-1')
            expect(mockNavigate).not.toHaveBeenCalled()
        })
    })
})
