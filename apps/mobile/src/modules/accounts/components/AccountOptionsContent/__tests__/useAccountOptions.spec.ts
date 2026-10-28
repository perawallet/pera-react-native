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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
    trackEvent,
    AccountOptionsEvent,
    AnalyticsMetadataKey,
} from '@analytics'
import { useAccountOptions } from '../useAccountOptions'
import {
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { BackupActionOutcome } from '@perawallet/wallet-core-backup'
import {
    registerAlgorandAccountsAdapter,
    registerAlgorandMultisigAdapter,
    seedAuthority,
} from '@test-utils/algorandAccountsAdapter'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import {
    ETHEREUM_CHAIN_ID,
    registerEthereumChain,
    registerLegacyAddressCodec,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'

const { mockCopyToClipboard } = vi.hoisted(() => ({
    mockCopyToClipboard: vi.fn(),
}))
const { mockShowToast, mockErrorToast } = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
    mockErrorToast: vi.fn(),
}))
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
const { mockIsAccountEnabled, mockSetAccountEnabled } = vi.hoisted(() => ({
    mockIsAccountEnabled: vi.fn(() => true),
    mockSetAccountEnabled: vi.fn(),
}))
const { mockRemoveAccount } = vi.hoisted(() => ({
    mockRemoveAccount: vi.fn(),
}))
const { mockAllAccounts } = vi.hoisted(() => ({
    mockAllAccounts: vi.fn((): WalletAccount[] => []),
}))
const { mockUpdateAccount } = vi.hoisted(() => ({
    mockUpdateAccount: vi.fn(),
}))
const { mockEnableChain } = vi.hoisted(() => ({
    mockEnableChain: vi.fn(),
}))
const { mockUseCanSignWith } = vi.hoisted(() => ({
    mockUseCanSignWith: vi.fn<(account?: WalletAccount | null) => boolean>(
        () => true,
    ),
}))
const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))
const { mockOpenViewPassphraseFlow, mockOpenRevealPrivateKeyFlow } = vi.hoisted(
    () => ({
        mockOpenViewPassphraseFlow: vi.fn(),
        mockOpenRevealPrivateKeyFlow: vi.fn(),
    }),
)
const { mockToggleAccountNotification, mockIsTogglePending } = vi.hoisted(
    () => ({
        mockToggleAccountNotification: vi.fn(),
        mockIsTogglePending: vi.fn(() => false),
    }),
)
const { mockIsBackedUp } = vi.hoisted(() => ({
    mockIsBackedUp: vi.fn(() => true),
}))
const { mockIsCloudBackupEnabled } = vi.hoisted(() => ({
    mockIsCloudBackupEnabled: vi.fn(() => true),
}))
const {
    mockDeleteAccountFromBackup,
    mockKeepAccountInBackup,
    mockGetBackupSyncManager,
} = vi.hoisted(() => {
    const mockDeleteAccountFromBackup = vi.fn(
        async (): Promise<BackupActionOutcome> => 'settled',
    )
    const mockKeepAccountInBackup = vi.fn(async () => true)
    return {
        mockDeleteAccountFromBackup,
        mockKeepAccountInBackup,
        mockGetBackupSyncManager: vi.fn(() => ({
            deleteAccountFromBackup: mockDeleteAccountFromBackup,
            keepAccountInBackup: mockKeepAccountInBackup,
        })),
    }
})

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
    useRevealPrivateKeyFlow: () => ({
        openRevealPrivateKeyFlow: mockOpenRevealPrivateKeyFlow,
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
        errorToast: mockErrorToast,
    }),
}))

vi.mock('@hooks/useLanguage')

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

vi.mock('@modules/cloud-backup', () => ({
    useIsAccountBackedUp: () => mockIsBackedUp(),
    DeleteFromBackupSheet: () => null,
}))

vi.mock('@hooks/useIsCloudBackupEnabled', () => ({
    useIsCloudBackupEnabled: mockIsCloudBackupEnabled,
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    getBackupSyncManager: mockGetBackupSyncManager,
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics/events/contexts')),
    ...(await vi.importActual<object>('@analytics/events/metadata-keys')),
    trackEvent: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useRemoveAccount: () => mockRemoveAccount,
        useUpdateAccount: () => mockUpdateAccount,
        useAllAccounts: () => mockAllAccounts(),
        useCanSignWith: (account?: WalletAccount | null) =>
            mockUseCanSignWith(account),
        useMultisigDetailsBackfill: () => ({ isBackfilling: false }),
        useEnableChain: () => mockEnableChain,
    }
})

const addressOf = (account: WalletAccount): string | undefined =>
    account.chains.algorand?.address

afterEach(() => addressCodecs.reset())

const sheetOptionsOf = (result: ReturnType<typeof useAccountOptions>) => [
    ...result.topActions,
    ...result.sharedAccountOptions,
]

describe('useAccountOptions', () => {
    const mockOnClose = vi.fn()
    const mockOnShowAddress = vi.fn()

    const algo25Account: WalletAccount = {
        id: 'acc-1',
        chains: { algorand: { address: 'ALGO25ADDRESS', keyPairId: 'key-1' } },
        custody: { kind: 'local', seed: null },
        name: 'My Account',
    }

    const watchAccount: WalletAccount = {
        id: 'acc-2',
        chains: { algorand: { address: 'WATCHADDRESS' } },
        custody: { kind: 'watch' },
    }

    const quantumAccount: WalletAccount = {
        id: 'acc-q',
        chains: { algorand: { address: 'QUANTUMADDRESS', keyPairId: 'key-q' } },
        custody: { kind: 'local', seed: 'quantum' },
        name: 'My Quantum Account',
    }

    const rekeyedAccount: WalletAccount = {
        id: 'acc-3',
        chains: { algorand: { address: 'REKEYEDADDRESS', keyPairId: 'key-3' } },
        custody: { kind: 'local', seed: null },
    }

    const rekeyedWatchAccount: WalletAccount = {
        id: 'acc-5',
        chains: { algorand: { address: 'REKEYEDWATCHADDRESS' } },
        custody: { kind: 'watch' },
    }

    const hardwareAccount: WalletAccount = {
        id: 'acc-4',
        chains: { algorand: { address: 'HARDWAREADDRESS' } },
        custody: {
            kind: 'hardware',
            device: {
                manufacturer: 'ledger',
                deviceId: 'test-device',
                deviceName: 'Ledger Nano X',
                transportType: 'ble',
            },
            accountIndex: 0,
        },
    }

    const multisigAccount: WalletAccount = {
        id: 'acc-6',
        chains: {
            algorand: {
                address: 'MULTISIGADDRESS',
                native: {
                    family: 'algorand',
                    multisig: {
                        threshold: 2,
                        addresses: ['ALGO25ADDRESS', 'HARDWAREADDRESS'],
                        version: 1,
                    },
                },
            },
        },
        custody: { kind: 'multisig' },
    }

    beforeEach(() => {
        registerLegacyAddressCodec(() => true)
        registerAlgorandAccountsAdapter()
        registerAlgorandMultisigAdapter()
        vi.clearAllMocks()
        useAccountChainStateStore.getState().resetState()
        seedAuthority('REKEYEDADDRESS', 'AUTHADDRESS')
        seedAuthority('REKEYEDWATCHADDRESS', 'ALGO25ADDRESS')
        useRemoteConfigStore.getState().resetState()
        mockIsAccountEnabled.mockReturnValue(true)
        mockIsBackedUp.mockReturnValue(false)
        mockIsCloudBackupEnabled.mockReturnValue(true)
        mockDeleteAccountFromBackup.mockResolvedValue('settled')
        mockKeepAccountInBackup.mockResolvedValue(true)
        mockToggleAccountNotification.mockResolvedValue(true)
        mockIsTogglePending.mockReturnValue(false)
        mockAllAccounts.mockReturnValue([algo25Account, watchAccount])
        mockUseCanSignWith.mockImplementation(account => {
            switch (account ? addressOf(account) : undefined) {
                case addressOf(algo25Account):
                case addressOf(quantumAccount):
                case addressOf(rekeyedAccount):
                case addressOf(rekeyedWatchAccount):
                case addressOf(hardwareAccount):
                case addressOf(multisigAccount): {
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

            const optionIds = sheetOptionsOf(result.current).map(o => o.id)
            expect(optionIds).toEqual([
                'rename-account',
                'toggle-notifications',
                'remove-account',
                'view-passphrase',
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

            const passphraseOption = sheetOptionsOf(result.current).find(
                o => o.id === 'view-passphrase',
            )
            expect(passphraseOption).toBeDefined()
            expect(passphraseOption?.title).toBe(
                'account_options.view_passphrase',
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

            const optionIds = sheetOptionsOf(result.current).map(o => o.id)
            expect(optionIds).toEqual([
                'rename-account',
                'toggle-notifications',
                'remove-account',
            ])
        })

        it('hides the passphrase of a rekeyed account', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: rekeyedAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const optionIds = sheetOptionsOf(result.current).map(o => o.id)
            expect(optionIds).toEqual([
                'rename-account',
                'toggle-notifications',
                'remove-account',
            ])
        })

        it('hides the passphrase for a hardware account', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: hardwareAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const optionIds = sheetOptionsOf(result.current).map(o => o.id)
            expect(optionIds).toEqual([
                'rename-account',
                'toggle-notifications',
                'remove-account',
            ])
        })

        it('lists the shared-account rows after the top actions for a shared account', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: multisigAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const optionIds = sheetOptionsOf(result.current).map(o => o.id)
            expect(optionIds).toEqual([
                'rename-account',
                'toggle-notifications',
                'remove-account',
                'shared-account-detail',
                'export-share-account',
            ])
        })
    })

    describe('an imported private-key account', () => {
        const privateKeyAccount: WalletAccount = {
            id: 'acc-pk',
            chains: {
                [ETHEREUM_CHAIN_ID]: {
                    address: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
                    keyPairId: 'key-pk',
                },
            },
            custody: { kind: 'local', seed: null },
        }

        const idsFor = (account: WalletAccount): string[] => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )
            return sheetOptionsOf(result.current).map(o => o.id)
        }

        beforeEach(registerEthereumChain)
        afterEach(restoreAlgorandOnlyChains)

        it('offers View private key', () => {
            expect(idsFor(privateKeyAccount)).toContain('view-private-key')
        })

        it('reports actions on the account record and its address on its own chain', async () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: privateKeyAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await act(async () => {
                await sheetOptionsOf(result.current)
                    .find(o => o.id === 'rename-account')
                    ?.onPress()
            })
            act(() => {
                result.current.networks.handleCopyAddress(ETHEREUM_CHAIN_ID)
            })

            expect(trackEvent).toHaveBeenCalledWith(
                AccountOptionsEvent.Rename,
                { [AnalyticsMetadataKey.ChainId]: 'ethereum' },
            )
            expect(trackEvent).toHaveBeenCalledWith(
                AccountOptionsEvent.CopyAddress,
                { [AnalyticsMetadataKey.ChainId]: 'ethereum' },
            )
        })

        it('offers it for no HD, Algo25 or watch account', () => {
            const hdAccount: WalletAccount = {
                id: 'acc-hd',
                chains: { algorand: { address: 'HDADDRESS', keyPairId: 'k' } },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            }
            for (const account of [hdAccount, algo25Account, watchAccount]) {
                expect(idsFor(account)).not.toContain('view-private-key')
            }
        })

        it('hides it when private keys are off on the chain', () => {
            setCapabilityOverrides({ privateKeys: false }, ETHEREUM_CHAIN_ID)

            expect(idsFor(privateKeyAccount)).not.toContain('view-private-key')
        })

        it('dismisses the menu, then opens the reveal flow on the chain', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: privateKeyAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            act(() => {
                sheetOptionsOf(result.current)
                    .find(o => o.id === 'view-private-key')
                    ?.onPress()
            })

            expect(mockOnClose).toHaveBeenCalled()
            expect(mockOpenRevealPrivateKeyFlow).toHaveBeenCalledWith(
                'acc-pk',
                ETHEREUM_CHAIN_ID,
            )
        })
    })

    describe('network rows', () => {
        const hdAccount: WalletAccount = {
            id: 'acc-hd',
            chains: { algorand: { address: 'HDADDRESS', keyPairId: 'k' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }

        const render = (account: WalletAccount) =>
            renderHook(() =>
                useAccountOptions({
                    account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

        const chainIdsOf = (result: ReturnType<typeof useAccountOptions>) =>
            result.networks.visibleRows.map(row => row.chainId)

        afterEach(restoreAlgorandOnlyChains)

        it('shows an Algorand-only account as one enabled Algorand row with QR', () => {
            const { result } = render(algo25Account)

            expect(result.current.networks.visibleRows).toEqual([
                expect.objectContaining({
                    chainId: 'algorand',
                    isEnabled: true,
                    canShowQr: true,
                }),
            ])
        })

        it('copies the Algorand address, as its codec normalizes it, and closes the sheet', () => {
            const { result } = render(algo25Account)

            act(() => {
                result.current.networks.handleCopyAddress('algorand')
            })

            expect(mockCopyToClipboard).toHaveBeenCalledWith(
                addressCodecs.get('algorand').normalize('ALGO25ADDRESS'),
            )
            expect(mockOnClose).toHaveBeenCalled()
        })

        it("opens the row's chain receive from its QR", () => {
            const { result } = render(algo25Account)

            act(() => {
                result.current.networks.handleShowQr('algorand')
            })

            expect(mockOnClose).toHaveBeenCalled()
            expect(mockOnShowAddress).toHaveBeenCalledWith(
                algo25Account,
                'algorand',
            )
        })

        it('offers an HD account Ethereum to add, and adds it for the user', async () => {
            registerEthereumChain()
            mockEnableChain.mockReturnValue(new Promise(() => {}))
            const { result } = render(hdAccount)

            expect(result.current.networks.visibleRows[1]).toMatchObject({
                chainId: ETHEREUM_CHAIN_ID,
                isEnabled: false,
            })

            act(() => {
                result.current.networks.handleAddNetwork(ETHEREUM_CHAIN_ID)
            })

            await waitFor(() =>
                expect(mockEnableChain).toHaveBeenCalledWith(
                    'acc-hd',
                    ETHEREUM_CHAIN_ID,
                    'user',
                ),
            )
        })

        it('offers a watch account no chain its codec rejects the address on', () => {
            registerEthereumChain()

            const { result } = render(watchAccount)

            expect(chainIdsOf(result.current)).toEqual(['algorand'])
        })

        it('offers a hardware account only the chains it is on', () => {
            registerEthereumChain()

            const { result } = render(hardwareAccount)

            expect(chainIdsOf(result.current)).toEqual(['algorand'])
        })
    })

    describe('capability gating', () => {
        const idsFor = (account: WalletAccount): string[] => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )
            return sheetOptionsOf(result.current).map(o => o.id)
        }

        it('keeps a rekeyed account recognised and signable, with only its undo entry hidden', () => {
            setCapabilityOverrides({ rekey: false })

            const { result } = renderHook(() =>
                useAccountOptions({
                    account: rekeyedAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            expect(result.current.isRekeyed).toBe(true)
            expect(result.current.authAddress).toBe('AUTHADDRESS')
            expect(result.current.canUndoRekey).toBe(false)
            expect(mockUseCanSignWith).toHaveReturnedWith(true)
        })

        it('hides the shared-account rows when multisig is off', () => {
            setCapabilityOverrides({ multisig: false })

            const ids = idsFor(multisigAccount)

            expect(ids).not.toContain('shared-account-detail')
            expect(ids).not.toContain('export-share-account')
            expect(ids).toContain('rename-account')
        })

        it('hides view-passphrase for every passphrase-backed account when mnemonic backup is off', () => {
            setCapabilityOverrides({ mnemonicBackup: false })

            for (const account of [algo25Account, quantumAccount]) {
                const ids = idsFor(account)

                expect(ids).not.toContain('view-passphrase')
                expect(ids).toContain('rename-account')
            }
        })

        it('removes a backed-up account without the backup choice when cloud backup is off on every chain', async () => {
            mockIsBackedUp.mockReturnValue(true)
            setCapabilityOverrides({ cloudBackup: false })
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            expect(result.current.isCloudBackupAvailable).toBe(false)
            await act(async () => {
                await sheetOptionsOf(result.current)
                    .find(o => o.id === 'remove-account')
                    ?.onPress()
            })
            await act(async () => {
                result.current.handleConfirmBackupWarning()
            })
            await act(async () => {
                await result.current.handleConfirmRemove()
            })

            expect(result.current.removeConfirmView).not.toBe(
                'cloud-backup-delete',
            )
            expect(mockRemoveAccount).toHaveBeenCalledWith('acc-1')
        })

        it('keeps the mute toggle when notifications are off, since pushes already registered still arrive', () => {
            setCapabilityOverrides({ notifications: false })

            expect(idsFor(algo25Account)).toContain('toggle-notifications')
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
            const removeOption = sheetOptionsOf(result.current).find(
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

        it('toggles notifications from enabled to disabled', async () => {
            mockIsAccountEnabled.mockReturnValue(true)

            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const notifOption = sheetOptionsOf(result.current).find(
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

            const notifOption = sheetOptionsOf(result.current).find(
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

            const renameOption = sheetOptionsOf(result.current).find(
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

            const renameOption = sheetOptionsOf(result.current).find(
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

            const renameOption = sheetOptionsOf(result.current).find(
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

            const removeOption = sheetOptionsOf(result.current).find(
                o => o.id === 'remove-account',
            )

            await act(async () => {
                await removeOption?.onPress()
            })

            // Inline confirmation: signing accounts see the backup warning first.
            expect(result.current.removeConfirmView).toBe('backup-warning')
            expect(mockRemoveAccount).not.toHaveBeenCalled()
        })

        it('skips the backup warning and goes straight to remove confirm for a watch account', async () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: watchAccount,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const removeOption = sheetOptionsOf(result.current).find(
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

            const removeOption = sheetOptionsOf(result.current).find(
                o => o.id === 'remove-account',
            )

            await act(async () => {
                await removeOption?.onPress()
            })
            await act(async () => {
                result.current.handleConfirmBackupWarning()
            })

            expect(result.current.removeConfirmView).toBe('remove-confirm')
            expect(mockRemoveAccount).not.toHaveBeenCalled()
        })

        it('cancelling the confirmation does not remove the account', async () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const removeOption = sheetOptionsOf(result.current).find(
                o => o.id === 'remove-account',
            )

            await act(async () => {
                await removeOption?.onPress()
            })
            await act(async () => {
                result.current.handleCancelRemove()
            })

            expect(result.current.removeConfirmView).toBe('none')
            expect(mockRemoveAccount).not.toHaveBeenCalled()
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

            expect(mockRemoveAccount).toHaveBeenCalledWith('acc-1')
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Home',
            })
        })

        it('asks about the cloud backup before removing a backed-up account', async () => {
            mockIsBackedUp.mockReturnValue(true)
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await driveFullRemoval(result)

            expect(result.current.removeConfirmView).toBe('cloud-backup-delete')
            expect(mockRemoveAccount).not.toHaveBeenCalled()
        })

        it('removes without asking when cloud backup is off', async () => {
            mockIsCloudBackupEnabled.mockReturnValue(false)
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await driveFullRemoval(result)

            expect(mockRemoveAccount).toHaveBeenCalledWith('acc-1')
        })

        it('deletes from the backup, then removes locally', async () => {
            mockIsBackedUp.mockReturnValue(true)
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await driveFullRemoval(result)
            await act(async () => {
                await result.current.handleDeleteFromBackup()
            })

            expect(trackEvent).toHaveBeenCalledWith(
                AccountOptionsEvent.DeleteFromCloudBackup,
                { [AnalyticsMetadataKey.ChainId]: 'algorand' },
            )
            expect(mockDeleteAccountFromBackup).toHaveBeenCalledWith(
                'ALGO25ADDRESS',
            )
            expect(mockRemoveAccount).toHaveBeenCalledWith('acc-1')
        })

        it('ignores a second choice while the first is still being recorded', async () => {
            mockIsBackedUp.mockReturnValue(true)
            let release: (outcome: BackupActionOutcome) => void = () => {}
            mockDeleteAccountFromBackup.mockImplementationOnce(
                () =>
                    new Promise<BackupActionOutcome>(resolve => {
                        release = resolve
                    }),
            )
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )
            await driveFullRemoval(result)

            let first: Promise<void> = Promise.resolve()
            act(() => {
                first = result.current.handleDeleteFromBackup()
            })
            expect(result.current.pendingBackupChoice).toBe('delete')
            await act(() => result.current.handleKeepInBackup())

            await act(async () => {
                release('settled')
                await first
            })

            expect(mockKeepAccountInBackup).not.toHaveBeenCalled()
            expect(mockRemoveAccount).toHaveBeenCalledTimes(1)
            expect(result.current.pendingBackupChoice).toBeUndefined()
        })

        it('keeps the backup copy, then removes locally', async () => {
            mockIsBackedUp.mockReturnValue(true)
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await driveFullRemoval(result)
            await act(async () => {
                await result.current.handleKeepInBackup()
            })

            expect(trackEvent).toHaveBeenCalledWith(
                AccountOptionsEvent.KeepInCloudBackup,
                { [AnalyticsMetadataKey.ChainId]: 'algorand' },
            )
            expect(mockKeepAccountInBackup).toHaveBeenCalledWith(
                'ALGO25ADDRESS',
            )
            expect(mockDeleteAccountFromBackup).not.toHaveBeenCalled()
            expect(mockRemoveAccount).toHaveBeenCalledWith('acc-1')
        })

        it('reports a refused keep as a device removal failure', async () => {
            mockIsBackedUp.mockReturnValue(true)
            mockKeepAccountInBackup.mockResolvedValueOnce(false)
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await driveFullRemoval(result)
            await act(async () => {
                await result.current.handleKeepInBackup()
            })

            expect(mockRemoveAccount).not.toHaveBeenCalled()
            expect(mockErrorToast).toHaveBeenCalledWith(
                'cloud_backup.accounts.keep_error',
                '',
            )
        })

        it('removes locally even when the cloud delete is only queued', async () => {
            mockIsBackedUp.mockReturnValue(true)
            mockDeleteAccountFromBackup.mockResolvedValueOnce('queued')
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await driveFullRemoval(result)
            await act(async () => {
                await result.current.handleDeleteFromBackup()
            })

            expect(mockRemoveAccount).toHaveBeenCalledWith('acc-1')
        })

        it('does not remove locally when the backup refused the choice', async () => {
            mockIsBackedUp.mockReturnValue(true)
            mockDeleteAccountFromBackup.mockResolvedValueOnce('refused')
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await driveFullRemoval(result)
            await act(async () => {
                await result.current.handleDeleteFromBackup()
            })

            expect(mockRemoveAccount).not.toHaveBeenCalled()
            expect(mockErrorToast).toHaveBeenCalledWith(
                'cloud_backup.accounts.delete_error',
                '',
            )
        })

        it('does not remove locally when the backup choice throws', async () => {
            mockIsBackedUp.mockReturnValue(true)
            mockGetBackupSyncManager.mockImplementationOnce(() => {
                throw new Error('Backup sync manager is not initialised')
            })
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await driveFullRemoval(result)
            await act(async () => {
                await result.current.handleDeleteFromBackup()
            })

            expect(mockRemoveAccount).not.toHaveBeenCalled()
            expect(mockErrorToast).toHaveBeenCalledWith(
                'cloud_backup.accounts.delete_error',
                '',
            )
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

            const notifOption = sheetOptionsOf(result.current).find(
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

            const notifOption = sheetOptionsOf(result.current).find(
                o => o.id === 'toggle-notifications',
            )

            expect(notifOption?.title).toBe(
                'account_options.unmute_notifications',
            )
            expect(notifOption?.icon).toBe('bell')
        })

        it('dismisses the parent sheet and opens the view-passphrase flow when view-passphrase is pressed', () => {
            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            const passphraseOption = sheetOptionsOf(result.current).find(
                o => o.id === 'view-passphrase',
            )

            act(() => {
                passphraseOption?.onPress()
            })

            // Parent options sheet is dismissed before the flow opens so
            // we don't end up with stacked sheets.
            expect(mockOnClose).toHaveBeenCalled()
            expect(mockOpenViewPassphraseFlow).toHaveBeenCalledWith(
                addressOf(algo25Account),
            )
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

            const detailOption = sheetOptionsOf(result.current).find(
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

            const exportOption = sheetOptionsOf(result.current).find(
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

            expect(mockRemoveAccount).toHaveBeenCalledWith('acc-1')
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('shows error toast and prevents removal when account has rekeyed dependents', async () => {
            const rekeyedToAlgo25: WalletAccount = {
                id: 'acc-rekeyed',
                chains: {
                    algorand: {
                        address: 'SOMEOTHERADDRESS',
                        keyPairId: 'key-rekeyed',
                    },
                },
                custody: { kind: 'local', seed: null },
            }
            seedAuthority('SOMEOTHERADDRESS', 'ALGO25ADDRESS')
            mockAllAccounts.mockReturnValue([algo25Account, rekeyedToAlgo25])

            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await driveFullRemoval(result)

            expect(mockRemoveAccount).not.toHaveBeenCalled()
            expect(mockErrorToast).toHaveBeenCalledWith(
                'account_options.remove_rekey_error_title',
                'account_options.remove_rekey_error_message',
            )
        })

        it('blocks a rekeyed-to account before touching the backup', async () => {
            mockIsBackedUp.mockReturnValue(true)
            const rekeyedToAlgo25: WalletAccount = {
                id: 'acc-rekeyed',
                chains: {
                    algorand: {
                        address: 'SOMEOTHERADDRESS',
                        keyPairId: 'key-rekeyed',
                    },
                },
                custody: { kind: 'local', seed: null },
            }
            seedAuthority('SOMEOTHERADDRESS', 'ALGO25ADDRESS')
            mockAllAccounts.mockReturnValue([algo25Account, rekeyedToAlgo25])

            const { result } = renderHook(() =>
                useAccountOptions({
                    account: algo25Account,
                    onClose: mockOnClose,
                    onShowAddress: mockOnShowAddress,
                }),
            )

            await driveFullRemoval(result)

            expect(result.current.removeConfirmView).toBe('none')
            expect(mockDeleteAccountFromBackup).not.toHaveBeenCalled()
            expect(mockKeepAccountInBackup).not.toHaveBeenCalled()
            expect(mockRemoveAccount).not.toHaveBeenCalled()
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

            expect(mockRemoveAccount).toHaveBeenCalledWith('acc-1')
        })

        it('removes a Ledger (hardware) account by its id', async () => {
            const ledgerAccount: WalletAccount = {
                id: 'acc-ledger',
                chains: { algorand: { address: 'LEDGERADDRESS' } },
                custody: {
                    kind: 'hardware',
                    device: {
                        manufacturer: 'ledger',
                        deviceId: 'test-device',
                        deviceName: 'Ledger Nano X',
                        transportType: 'ble',
                    },
                    accountIndex: 0,
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

            expect(mockRemoveAccount).toHaveBeenCalledWith('acc-ledger')
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

        // docs/OFFLINE_PAUSED_STATE.md says screens
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

            const notifOption = sheetOptionsOf(result.current).find(
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

            const notifOption = sheetOptionsOf(result.current).find(
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
