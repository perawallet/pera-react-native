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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAccountOptions } from '../useAccountOptions'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const { mockCopyToClipboard } = vi.hoisted(() => ({
    mockCopyToClipboard: vi.fn(),
}))
const { mockShowToast } = vi.hoisted(() => ({ mockShowToast: vi.fn() }))
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
const { mockIsAccountEnabled, mockSetAccountEnabled } = vi.hoisted(() => ({
    mockIsAccountEnabled: vi.fn(() => true),
    mockSetAccountEnabled: vi.fn(),
}))
const { mockRemoveAccountByAddress } = vi.hoisted(() => ({
    mockRemoveAccountByAddress: vi.fn(),
}))
const { mockAllAccounts } = vi.hoisted(() => ({
    mockAllAccounts: vi.fn((): WalletAccount[] => []),
}))
const { mockUpdateAccount } = vi.hoisted(() => ({
    mockUpdateAccount: vi.fn(),
}))
const { mockUseCanSignWith } = vi.hoisted(() => ({
    mockUseCanSignWith: vi.fn<(account?: WalletAccount | null) => boolean>(
        () => true,
    ),
}))
const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))
const { mockOpenViewPassphraseFlow } = vi.hoisted(() => ({
    mockOpenViewPassphraseFlow: vi.fn(),
}))
const { mockToggleAccountNotification, mockIsTogglePending } = vi.hoisted(
    () => ({
        mockToggleAccountNotification: vi.fn(),
        mockIsTogglePending: vi.fn(() => false),
    }),
)

vi.mock('@hooks/useAccountNotificationToggle', () => ({
    useAccountNotificationToggle: () => ({
        toggleAccountNotification: mockToggleAccountNotification,
        isTogglePending: mockIsTogglePending,
    }),
}))

vi.mock('@modules/view-passphrase', () => ({
    useViewPassphraseFlow: () => ({
        openViewPassphraseFlow: mockOpenViewPassphraseFlow,
    }),
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

vi.mock('@perawallet/wallet-core-messages', () => ({
    useNotificationPreferences: () => ({
        disabledAccounts: [],
        isAccountEnabled: mockIsAccountEnabled,
        setAccountEnabled: mockSetAccountEnabled,
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useRemoveAccountByAddress: () => mockRemoveAccountByAddress,
        useUpdateAccount: () => mockUpdateAccount,
        useAllAccounts: () => mockAllAccounts(),
        useCanSignWith: (account?: WalletAccount | null) =>
            mockUseCanSignWith(account),
        useMultisigDetailsBackfill: () => ({ isBackfilling: false }),
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

    const quantumAccount: WalletAccount = {
        id: 'acc-q',
        address: 'QUANTUMADDRESS',
        type: AccountTypes.quantum,
        keyPairId: 'key-q',
        name: 'My Quantum Account',
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
        hardwareDetails: {
            manufacturer: 'ledger',
            deviceId: 'test-device',
            deviceName: 'Ledger Nano X',
            accountIndex: 0,
            transportType: 'ble',
        },
    }

    const multisigAccount: WalletAccount = {
        id: 'acc-6',
        address: 'MULTISIGADDRESS',
        type: AccountTypes.multisig,
        multisigDetails: {
            threshold: 2,
            addresses: ['ALGO25ADDRESS', 'HARDWAREADDRESS'],
            version: 1,
        },
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockIsAccountEnabled.mockReturnValue(true)
        mockToggleAccountNotification.mockResolvedValue(true)
        mockIsTogglePending.mockReturnValue(false)
        mockAllAccounts.mockReturnValue([algo25Account, watchAccount])
        mockUseCanSignWith.mockImplementation(account => {
            switch (account?.address) {
                case algo25Account.address:
                case quantumAccount.address:
                case rekeyedAccount.address:
                case rekeyedWatchAccount.address:
                case hardwareAccount.address:
                case multisigAccount.address: {
                    return true
                }
                default: {
                    return false
                }
            }
        })
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
                'scan-rekeyed',
                'rename-account',
                'toggle-notifications',
                'remove-account',
            ])
        })

        it('offers view-passphrase for a quantum account (25-word recovery phrase)', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: quantumAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const passphraseOption = result.current.options.find(
                o => o.id === 'view-passphrase',
            )
            // Distinct label: a quantum account can share its 25 words with an
            // algo25 twin (same mnemonic, different address). Reusing the algo25
            // "View wallet passphrase" copy would read as a duplicate/bug, so
            // quantum gets its own string.
            expect(passphraseOption).toBeDefined()
            expect(passphraseOption?.title).toBe(
                'account_options.view_passphrase_quantum',
            )
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
                'rekey-to-ledger',
                'rekey-to-standard',
                'scan-rekeyed',
                'rename-account',
                'toggle-notifications',
                'remove-account',
            ])
        })

        it('shows rekey options but hides passphrase for a hardware account', () => {
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
                'rekey-to-ledger',
                'rekey-to-standard',
                'scan-rekeyed',
                'rename-account',
                'toggle-notifications',
                'remove-account',
            ])
        })

        it('shows rekey-to-shared and export options for a shared account', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: multisigAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const optionIds = result.current.options.map(o => o.id)
            expect(optionIds).toEqual([
                'shared-account-detail',
                'copy-address',
                'show-address',
                'rekey-to-shared',
                'export-share-account',
                'scan-rekeyed',
                'rename-account',
                'toggle-notifications',
                'remove-account',
            ])
            expect(optionIds).not.toContain('rekey-to-ledger')
            expect(optionIds).not.toContain('rekey-to-standard')
        })
    })

    describe('handlers', () => {
        // Removal is an inline state machine (none → backup-warning → remove-confirm) rather than
        // stacked confirm bottom-sheets. Drive it: onPress → acknowledge backup → confirm remove.
        // handleConfirmBackupWarning is a harmless no-op when already on 'remove-confirm' (watch
        // accounts skip the backup step), so this works for every account type.
        const driveFullRemoval = async (result: {
            current: ReturnType<typeof useAccountOptions>
        }): Promise<void> => {
            const removeOption = result.current.options.find(
                o => o.id === 'remove-account',
            )
            await act(async () => {
                await removeOption?.onPress()
            })
            await act(async () => {
                result.current.handleConfirmBackupWarning()
            })
            await act(async () => {
                result.current.handleConfirmRemove()
            })
        }

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

        it('toggles notifications from enabled to disabled', async () => {
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

            await act(async () => {
                await notifOption?.onPress()
            })

            expect(mockToggleAccountNotification).toHaveBeenCalledWith(
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

        it('toggles notifications from disabled to enabled', async () => {
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

            await act(async () => {
                await notifOption?.onPress()
            })

            expect(mockToggleAccountNotification).toHaveBeenCalledWith(
                'ALGO25ADDRESS',
                true,
            )
            expect(mockShowToast).toHaveBeenCalledWith({
                title: 'account_options.notifications_unmuted',
                body: '',
                type: 'success',
            })
        })

        it('closes options sheet and requests rename bottom sheet when pressed', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce(undefined)
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const renameOption = result.current.options.find(
                o => o.id === 'rename-account',
            )

            await act(async () => {
                await renameOption?.onPress()
            })

            expect(mockOnClose).toHaveBeenCalled()
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
            const arg = mockRequestBottomSheet.mock.calls[0][0]
            expect(arg.options).toEqual({
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            })
        })

        it('updates the account with the trimmed name returned by the rename sheet', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce('New Name')
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const renameOption = result.current.options.find(
                o => o.id === 'rename-account',
            )

            await act(async () => {
                await renameOption?.onPress()
            })

            expect(mockUpdateAccount).toHaveBeenCalledWith({
                ...algo25Account,
                name: 'New Name',
            })
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'account_options.rename_success',
                    type: 'success',
                }),
                expect.anything(),
            )
        })

        it('does not update the account when rename is cancelled', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce(undefined)
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const renameOption = result.current.options.find(
                o => o.id === 'rename-account',
            )

            await act(async () => {
                await renameOption?.onPress()
            })

            expect(mockUpdateAccount).not.toHaveBeenCalled()
        })

        it('shows the backup warning inline when remove is pressed for a non-watch account', async () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const removeOption = result.current.options.find(
                o => o.id === 'remove-account',
            )

            await act(async () => {
                await removeOption?.onPress()
            })

            // Inline confirmation: signing accounts see the backup warning first.
            expect(result.current.removeConfirmView).toBe('backup-warning')
            expect(mockRemoveAccountByAddress).not.toHaveBeenCalled()
        })

        it('skips the backup warning and goes straight to remove confirm for a watch account', async () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: watchAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const removeOption = result.current.options.find(
                o => o.id === 'remove-account',
            )

            await act(async () => {
                await removeOption?.onPress()
            })

            // Watch accounts have no signing keys → no backup warning.
            expect(result.current.removeConfirmView).toBe('remove-confirm')
        })

        it('advances to remove confirm when the backup warning is acknowledged', async () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const removeOption = result.current.options.find(
                o => o.id === 'remove-account',
            )

            await act(async () => {
                await removeOption?.onPress()
            })
            await act(async () => {
                result.current.handleConfirmBackupWarning()
            })

            expect(result.current.removeConfirmView).toBe('remove-confirm')
            expect(mockRemoveAccountByAddress).not.toHaveBeenCalled()
        })

        it('cancelling the confirmation does not remove the account', async () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const removeOption = result.current.options.find(
                o => o.id === 'remove-account',
            )

            await act(async () => {
                await removeOption?.onPress()
            })
            await act(async () => {
                result.current.handleCancelRemove()
            })

            expect(result.current.removeConfirmView).toBe('none')
            expect(mockRemoveAccountByAddress).not.toHaveBeenCalled()
        })

        it('removes account and navigates home when the inline confirm is pressed', async () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await driveFullRemoval(result)

            expect(mockRemoveAccountByAddress).toHaveBeenCalledWith(
                'ALGO25ADDRESS',
            )
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Home',
            })
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

        it('dismisses the parent sheet and opens the view-passphrase flow when view-passphrase is pressed', () => {
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

            // Parent options sheet is dismissed before the flow opens so
            // we don't end up with stacked sheets.
            expect(mockOnClose).toHaveBeenCalled()
            expect(mockOpenViewPassphraseFlow).toHaveBeenCalledWith(
                algo25Account.address,
            )
        })

        it('navigates to RekeyToLedger intro for rekey-to-ledger', () => {
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

            expect(mockOnClose).toHaveBeenCalled()
            expect(mockNavigate).toHaveBeenCalledWith('RekeyToLedger', {
                screen: 'RekeyToLedgerIntro',
                params: { sourceAddress: algo25Account.address },
            })
        })

        it('navigates to RekeyToStandard intro for rekey-to-standard', () => {
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

            expect(mockOnClose).toHaveBeenCalled()
            expect(mockNavigate).toHaveBeenCalledWith('RekeyToStandard', {
                screen: 'RekeyToStandardIntro',
                params: { sourceAddress: algo25Account.address },
            })
        })

        it('navigates to RekeyToShared intro for rekey-to-shared', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: multisigAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const rekeyOption = result.current.options.find(
                o => o.id === 'rekey-to-shared',
            )

            act(() => {
                rekeyOption?.onPress()
            })

            expect(mockOnClose).toHaveBeenCalled()
            expect(mockNavigate).toHaveBeenCalledWith('RekeyToShared', {
                screen: 'RekeyToSharedIntro',
                params: { sourceAddress: multisigAccount.address },
            })
        })

        it('navigates to RescanRekeyed select for scan-rekeyed', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const scanOption = result.current.options.find(
                o => o.id === 'scan-rekeyed',
            )

            act(() => {
                scanOption?.onPress()
            })

            expect(mockOnClose).toHaveBeenCalled()
            expect(mockNavigate).toHaveBeenCalledWith('RescanRekeyed', {
                screen: 'RescanRekeyedSelect',
                params: { sourceAddress: algo25Account.address },
            })
        })

        it('closes the options sheet and requests shared account details when shared-account-detail is pressed', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce(undefined)
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: multisigAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const detailOption = result.current.options.find(
                o => o.id === 'shared-account-detail',
            )

            await act(async () => {
                await detailOption?.onPress()
            })

            expect(mockOnClose).toHaveBeenCalled()
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
            const arg = mockRequestBottomSheet.mock.calls[0][0]
            expect(arg.options).toEqual({
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            })
        })

        it('closes the options sheet and requests the export-share sheet when pressed', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce(undefined)
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: multisigAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const exportOption = result.current.options.find(
                o => o.id === 'export-share-account',
            )

            await act(async () => {
                await exportOption?.onPress()
            })

            expect(mockOnClose).toHaveBeenCalled()
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
            const arg = mockRequestBottomSheet.mock.calls[0][0]
            expect(arg.options).toEqual({
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            })
        })

        it('does not navigate when removing the last account', async () => {
            mockAllAccounts.mockReturnValue([algo25Account])

            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await driveFullRemoval(result)

            expect(mockRemoveAccountByAddress).toHaveBeenCalledWith(
                'ALGO25ADDRESS',
            )
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('shows error toast and prevents removal when account has rekeyed dependents', async () => {
            const rekeyedToAlgo25: WalletAccount = {
                id: 'acc-rekeyed',
                address: 'SOMEOTHERADDRESS',
                type: AccountTypes.algo25,
                keyPairId: 'key-rekeyed',
                rekeyAddress: 'ALGO25ADDRESS',
            }
            mockAllAccounts.mockReturnValue([algo25Account, rekeyedToAlgo25])

            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await driveFullRemoval(result)

            expect(mockRemoveAccountByAddress).not.toHaveBeenCalled()
            expect(mockShowToast).toHaveBeenCalledWith({
                title: 'account_options.remove_rekey_error_title',
                body: 'account_options.remove_rekey_error_message',
                type: 'error',
            })
        })

        it('allows removal when no other accounts are rekeyed to it', async () => {
            mockAllAccounts.mockReturnValue([algo25Account, rekeyedAccount])

            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await driveFullRemoval(result)

            expect(mockRemoveAccountByAddress).toHaveBeenCalledWith(
                'ALGO25ADDRESS',
            )
        })

        it('removes a Ledger (hardware) account via the address path', async () => {
            // Removal keys on address, not id (regression: silent no-op with
            // a success toast).
            const ledgerAccount: WalletAccount = {
                id: 'acc-ledger',
                address: 'LEDGERADDRESS',
                type: AccountTypes.hardware,
                hardwareDetails: {
                    manufacturer: 'ledger',
                    deviceId: 'test-device',
                    deviceName: 'Ledger Nano X',
                    accountIndex: 0,
                    transportType: 'ble',
                },
            }
            mockAllAccounts.mockReturnValue([algo25Account, ledgerAccount])

            const { result } = renderHook(() =>
                useAccountOptions({
                    account: ledgerAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await driveFullRemoval(result)

            expect(mockRemoveAccountByAddress).toHaveBeenCalledWith(
                'LEDGERADDRESS',
            )
        })
    })

    describe('notification toggle', () => {
        beforeEach(() => {
            mockToggleAccountNotification.mockResolvedValue(true)
            mockIsAccountEnabled.mockReturnValue(true)
        })

        it('sends the change to the backend instead of only writing the store', async () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await act(async () => {
                result.current.handleToggleNotifications()
            })

            expect(mockToggleAccountNotification).toHaveBeenCalledWith(
                'ALGO25ADDRESS',
                false,
            )
            // The "instead of" half: the store is written by the shared hook,
            // never directly from here.
            expect(mockSetAccountEnabled).not.toHaveBeenCalled()
        })

        it('confirms with a success toast only once the backend accepted it', async () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await act(async () => {
                result.current.handleToggleNotifications()
            })

            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'account_options.notifications_muted',
                    type: 'success',
                }),
            )
        })

        it('shows no success toast when the backend rejected the change', async () => {
            mockToggleAccountNotification.mockResolvedValue(false)

            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await act(async () => {
                result.current.handleToggleNotifications()
            })

            expect(mockShowToast).not.toHaveBeenCalled()
        })

        // R3 (PERA-4585 residual): docs/OFFLINE_PAUSED_STATE.md says screens
        // should use the pending flag to disable the control rather than let
        // a tap silently resolve `false`. This row now does.
        it('disables the toggle-notifications option while a toggle for this address is pending', () => {
            mockIsTogglePending.mockReturnValue(true)

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

            expect(mockIsTogglePending).toHaveBeenCalledWith('ALGO25ADDRESS')
            expect(notifOption?.disabled).toBe(true)
        })

        it('leaves the toggle-notifications option enabled when nothing is pending', () => {
            mockIsTogglePending.mockReturnValue(false)

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

            expect(notifOption?.disabled).toBe(false)
        })

        it('closes the sheet immediately, without waiting for the backend', () => {
            mockToggleAccountNotification.mockReturnValue(
                new Promise(() => undefined),
            )

            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            act(() => {
                result.current.handleToggleNotifications()
            })

            expect(mockOnClose).toHaveBeenCalledTimes(1)
        })
    })
})
