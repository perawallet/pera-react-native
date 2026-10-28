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

import { renderHook, act } from '@test-utils/render'
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'
import {
    detectImportKind,
    setPendingImportMnemonic,
} from '@perawallet/wallet-core-accounts'
import { DeeplinkType } from '@perawallet/wallet-core-deeplinks'
import {
    useImportAccountOptionsScreen,
    type UseImportAccountOptionsScreenResult,
} from '../useImportAccountOptionsScreen'
import { capabilityState } from '@test-utils/capability-mock'
import { useOnboardingStore } from '../../../hooks/useOnboardingStore'
import { registerAlgorandAccountsAdapter } from '@test-utils/algorandAccountsAdapter'
import {
    ETHEREUM_CHAIN_ID,
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { AnalyticsMetadataKey, OnboardingEvent, trackEvent } from '@analytics'

const mockPush = vi.fn()
const mockGoBack = vi.fn()

const { mockCapabilities, mockRouteParams, mockHandoff } = vi.hoisted(() => ({
    mockCapabilities: {} as Record<string, boolean>,
    mockRouteParams: {
        current: undefined as { isScannerOpen?: boolean } | undefined,
    },
    mockHandoff: { shouldHandOff: false, openTab: vi.fn() },
}))

vi.mock('@react-navigation/native', async importOriginal => ({
    ...(await importOriginal<object>()),
    useRoute: () => ({ params: mockRouteParams.current }),
}))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<object>()),
    trackEvent: vi.fn(),
}))

vi.mock('@hooks/useTabHandoff', () => ({
    useTabHandoff: () => mockHandoff,
}))
vi.mock('@routes/capabilities', async () => {
    const actual = await vi.importActual<typeof import('@routes/capabilities')>(
        '@routes/capabilities',
    )
    Object.assign(mockCapabilities, actual.routeCapabilities)
    return { ...actual, routeCapabilities: mockCapabilities }
})

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        push: mockPush,
        goBack: mockGoBack,
    }),
}))

const mockErrorToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: mockErrorToast,
    }),
}))

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<object>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => key,
            i18n: {
                changeLanguage: vi.fn(),
                language: 'en',
            },
        }),
    }
})

const mockParseDeeplink = vi.fn()
vi.mock('@modules/deeplink/hooks/useDeepLink', () => ({
    useDeepLink: () => ({
        parseDeeplink: mockParseDeeplink,
        handleDeepLink: vi.fn(),
        isValidDeepLink: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        detectImportKind: vi.fn(),
        setPendingImportMnemonic: vi.fn(),
    }
})

const { mockRequestBottomSheet, mockChooseRestoreRoute } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
    mockChooseRestoreRoute: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@hooks/useCapability', async () =>
    (await import('@test-utils/capability-mock')).capabilityHookMock(),
)

const setQuantumEnabled = (isEnabled: boolean): void => {
    capabilityState.reset()
    if (!isEnabled) {
        capabilityState.turnOff('quantumAccounts')
    }
}

const mockCloudBackupFlag = vi.hoisted(() => ({ enabled: false }))
vi.mock('@hooks/useIsCloudBackupEnabled', () => ({
    useIsCloudBackupEnabled: () => mockCloudBackupFlag.enabled,
}))

const mockCloudBackupState = vi.hoisted(() => ({ isConfigured: false }))
vi.mock('@perawallet/wallet-core-backup', () => ({
    useCloudBackupStore: (
        selector: (state: { isConfigured: () => boolean }) => unknown,
    ) => selector({ isConfigured: () => mockCloudBackupState.isConfigured }),
}))

const { mockLedgerSupport } = vi.hoisted(() => ({
    mockLedgerSupport: {
        isReady: false,
        supportedTransportTypes: [] as string[],
    },
}))

vi.mock('@modules/ledger', () => ({
    useSupportedLedgerTransports: () => mockLedgerSupport,
}))

const ledgerChains = vi.hoisted(() => ({ ids: ['algorand'] as string[] }))
vi.mock('@hooks/useCapableChainIds', () => ({
    useCapableChainIds: () => ledgerChains.ids,
}))

vi.mock('@modules/cloud-backup', () => ({
    useRestoreBackupOptions: () => ({
        chooseRestoreRoute: mockChooseRestoreRoute,
        isReadingCredentials: false,
    }),
}))

const optionsOf = (screen: UseImportAccountOptionsScreenResult) => [
    ...screen.mainOptions,
    ...screen.otherOptions,
]

const pressCloudBackupOption = async (result: {
    current: UseImportAccountOptionsScreenResult
}) => {
    const option = optionsOf(result.current).find(
        o => o.testID === 'import_account_options_cloud_backup_button',
    )!

    await act(async () => {
        await option.onPress()
    })
}

describe('useImportAccountOptionsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerAlgorandAccountsAdapter()
        mockRouteParams.current = undefined
        mockHandoff.shouldHandOff = false
        mockCapabilities.ledgerUsb = false
        mockRequestBottomSheet.mockResolvedValue(undefined)
        setQuantumEnabled(false)
        mockCloudBackupFlag.enabled = false
        mockCloudBackupState.isConfigured = false
        mockLedgerSupport.isReady = false
        mockLedgerSupport.supportedTransportTypes = []
        useOnboardingStore.getState().setIsOnboarding(false)
    })

    it('splits the rows into passphrase, cloud backup and Ledger first, the rest behind other options', () => {
        mockCloudBackupFlag.enabled = true

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        expect(result.current.mainOptions.map(o => o.testID)).toEqual([
            'import_account_options_recover_wallet_button',
            'import_account_options_cloud_backup_button',
            'import_account_options_pair_ledger_button',
        ])
        expect(result.current.otherOptions.map(o => o.testID)).toEqual([
            'import_account_options_pera_web_button',
            'import_account_options_asb_button',
            'import_account_options_recover_qr_button',
        ])
    })

    it('offers one Ledger row whether or not USB is possible', () => {
        mockCapabilities.ledgerUsb = true

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const ledgerIds = optionsOf(result.current)
            .map(o => o.testID)
            .filter(id => id.includes('ledger'))
        expect(ledgerIds).toEqual(['import_account_options_pair_ledger_button'])
    })

    it('hides the other options until toggled', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        expect(result.current.isOtherOptionsVisible).toBe(false)

        act(() => {
            result.current.handleToggleOtherOptions()
        })

        expect(result.current.isOtherOptionsVisible).toBe(true)
    })

    it('titles the screen Import Wallet during onboarding and Import Account otherwise', () => {
        const { result: addAccount } = renderHook(() =>
            useImportAccountOptionsScreen(),
        )
        expect(addAccount.current.titleKey).toBe(
            'onboarding.import_account_options.title',
        )

        act(() => {
            useOnboardingStore.getState().setIsOnboarding(true)
        })
        const { result: onboarding } = renderHook(() =>
            useImportAccountOptionsScreen(),
        )
        expect(onboarding.current.titleKey).toBe(
            'onboarding.import_account_options.onboarding_title',
        )
    })

    it('recover wallet option requests import options bottom sheet', async () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const recoverOption = optionsOf(result.current).find(
            o => o.testID === 'import_account_options_recover_wallet_button',
        )!

        await act(async () => {
            await recoverOption.onPress()
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })

    it('navigates to ImportInfo when the import options sheet resolves with a result', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(null)
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const recoverOption = optionsOf(result.current).find(
            o => o.testID === 'import_account_options_recover_wallet_button',
        )!

        await act(async () => {
            await recoverOption.onPress()
        })

        expect(mockPush).toHaveBeenCalledWith('ImportInfo', {
            accountType: null,
        })
    })

    it.each([
        ['bip39', OnboardingEvent.RecoverOneKey],
        [null, OnboardingEvent.RecoverAlgo25],
    ] as const)(
        "tracks the picked kind's recover event (%s)",
        async (seed, event) => {
            mockRequestBottomSheet.mockResolvedValueOnce(seed)
            const { result } = renderHook(() => useImportAccountOptionsScreen())

            await act(async () => {
                await optionsOf(result.current)
                    .find(
                        o =>
                            o.testID ===
                            'import_account_options_recover_wallet_button',
                    )!
                    .onPress()
            })

            expect(trackEvent).toHaveBeenCalledWith(event, {
                [AnalyticsMetadataKey.ChainId]: 'algorand',
            })
        },
    )

    it('takes a quantum pick from the passphrase sheet to ImportInfo without a recover event', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce('quantum')
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        await act(async () => {
            await optionsOf(result.current)
                .find(
                    o =>
                        o.testID ===
                        'import_account_options_recover_wallet_button',
                )!
                .onPress()
        })

        expect(trackEvent).not.toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('ImportInfo', {
            accountType: 'quantum',
        })
    })

    it('stays put when the import options sheet is dismissed', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const recoverOption = optionsOf(result.current).find(
            o => o.testID === 'import_account_options_recover_wallet_button',
        )!

        await act(async () => {
            await recoverOption.onPress()
        })

        expect(mockPush).not.toHaveBeenCalled()
    })

    it('hands the QR scan off to the expanded tab from the extension popup', () => {
        mockHandoff.shouldHandOff = true
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        act(() => {
            optionsOf(result.current)
                .find(
                    o =>
                        o.testID === 'import_account_options_recover_qr_button',
                )!
                .onPress()
        })

        expect(mockHandoff.openTab).toHaveBeenCalledTimes(1)
        expect(result.current.isQRScannerVisible).toBe(false)
    })

    it('opens the scanner on arrival when the popup handed the scan off', () => {
        mockRouteParams.current = { isScannerOpen: true }

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        expect(result.current.isQRScannerVisible).toBe(true)
    })

    it('QR option opens QR scanner', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        expect(result.current.isQRScannerVisible).toBe(false)

        const qrOption = optionsOf(result.current).find(
            o => o.testID === 'import_account_options_recover_qr_button',
        )!

        act(() => {
            qrOption.onPress()
        })

        expect(result.current.isQRScannerVisible).toBe(true)
    })

    it('Ledger BLE option navigates to LedgerPair on the only Ledger chain without asking', async () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const ledgerOption = optionsOf(result.current).find(
            o => o.testID === 'import_account_options_pair_ledger_button',
        )!

        await act(async () => {
            ledgerOption.onPress()
        })

        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('LedgerPair', {
            chainId: 'algorand',
        })
    })

    describe('with more than one Ledger chain', () => {
        beforeEach(() => {
            ledgerChains.ids = ['algorand', 'ethereum']
        })

        afterEach(() => {
            ledgerChains.ids = ['algorand']
        })

        it('asks for the chain and pairs on the one picked', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce('ethereum')
            const { result } = renderHook(() => useImportAccountOptionsScreen())
            const ledgerOption = optionsOf(result.current).find(
                o => o.testID === 'import_account_options_pair_ledger_button',
            )!

            await act(async () => {
                ledgerOption.onPress()
            })

            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
            expect(mockPush).toHaveBeenCalledWith('LedgerPair', {
                chainId: 'ethereum',
            })
        })

        it('stays put when the chain sheet is dismissed', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce(undefined)
            const { result } = renderHook(() => useImportAccountOptionsScreen())
            const ledgerOption = optionsOf(result.current).find(
                o => o.testID === 'import_account_options_pair_ledger_button',
            )!

            await act(async () => {
                ledgerOption.onPress()
            })

            expect(mockPush).not.toHaveBeenCalled()
        })
    })

    describe('where Ledger USB is possible', () => {
        beforeEach(() => {
            mockCapabilities.ledgerUsb = true
        })

        const pressLedger = async (result: {
            current: UseImportAccountOptionsScreenResult
        }) => {
            const ledgerOption = optionsOf(result.current).find(
                o => o.testID === 'import_account_options_pair_ledger_button',
            )!
            await act(async () => {
                ledgerOption.onPress()
            })
        }

        it('asks for the transport, then pairs over USB when picked', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce('usb')
            const { result } = renderHook(() => useImportAccountOptionsScreen())

            await pressLedger(result)

            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
            expect(mockPush).toHaveBeenCalledWith('LedgerInstructions', {
                transportType: 'usb',
                chainId: 'algorand',
            })
        })

        it('pairs over Bluetooth when picked', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce('ble')
            const { result } = renderHook(() => useImportAccountOptionsScreen())

            await pressLedger(result)

            expect(mockPush).toHaveBeenCalledWith('LedgerPair', {
                chainId: 'algorand',
            })
        })

        it('stays put when the transport sheet is dismissed', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce(undefined)
            const { result } = renderHook(() => useImportAccountOptionsScreen())

            await pressLedger(result)

            expect(mockPush).not.toHaveBeenCalled()
        })
    })

    it('Pera Web option navigates to the Pera Web import wizard', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const peraWebOption = optionsOf(result.current).find(
            o => o.testID === 'import_account_options_pera_web_button',
        )!

        act(() => {
            peraWebOption.onPress()
        })

        expect(mockPush).toHaveBeenCalledWith('PeraWebImportInfo')
    })

    it('ASB option navigates to the ASB recovery wizard', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const asbOption = optionsOf(result.current).find(
            o => o.testID === 'import_account_options_asb_button',
        )!

        act(() => {
            asbOption.onPress()
        })

        expect(mockPush).toHaveBeenCalledWith('AsbImportInfo')
    })

    it('ASB option keeps its Algorand Secure Backup title when cloud backup is off', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const asbOption = optionsOf(result.current).find(
            o => o.testID === 'import_account_options_asb_button',
        )!

        expect(asbOption.titleKey).toBe(
            'onboarding.import_account_options.asb_title',
        )
    })

    it('ASB option is titled as the legacy backup when cloud backup is on', () => {
        mockCloudBackupFlag.enabled = true

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const asbOption = optionsOf(result.current).find(
            o => o.testID === 'import_account_options_asb_button',
        )!

        expect(asbOption.titleKey).toBe(
            'onboarding.import_account_options.asb_legacy_title',
        )
    })

    it('drops the cloud restore row and the legacy ASB title when cloud backup is off on every chain', () => {
        mockCloudBackupFlag.enabled = true
        capabilityState.turnOff('cloudBackup')

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const testIDs = optionsOf(result.current).map(o => o.testID)
        const asbOption = optionsOf(result.current).find(
            o => o.testID === 'import_account_options_asb_button',
        )!

        expect(testIDs).not.toContain(
            'import_account_options_cloud_backup_button',
        )
        expect(asbOption.titleKey).toBe(
            'onboarding.import_account_options.asb_title',
        )
    })

    it('drops the ASB row without secure backup while the cloud restore row stays', () => {
        mockCloudBackupFlag.enabled = true
        capabilityState.turnOff('secureBackup')

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const testIDs = optionsOf(result.current).map(o => o.testID)

        expect(testIDs).not.toContain('import_account_options_asb_button')
        expect(testIDs).toContain(
            'import_account_options_recover_wallet_button',
        )
        expect(testIDs).toContain('import_account_options_cloud_backup_button')
    })

    it('handleCloseQRScanner closes the QR scanner', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        // Open the QR scanner
        act(() => {
            optionsOf(result.current)
                .find(
                    o =>
                        o.testID === 'import_account_options_recover_qr_button',
                )!
                .onPress()
        })
        expect(result.current.isQRScannerVisible).toBe(true)

        act(() => {
            result.current.handleCloseQRScanner()
        })

        expect(result.current.isQRScannerVisible).toBe(false)
    })

    it('handleQRScannerSuccess hands the mnemonic to the store and pushes the Import screen without it (HD path)', () => {
        const mnemonic = new Array(24).fill('word').join(' ')
        mockParseDeeplink.mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic,
        })
        vi.mocked(detectImportKind).mockReturnValue({
            success: true,
            seed: 'bip39',
        })

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        act(() => {
            result.current.handleQRScannerSuccess('perawallet://recover/...')
        })

        // Mnemonic goes through the in-memory store, never the route params.
        expect(setPendingImportMnemonic).toHaveBeenCalledWith(mnemonic)
        expect(mockPush).toHaveBeenCalledWith('ImportAccount', {
            accountType: 'bip39',
        })
    })

    it('handleQRScannerSuccess hands the mnemonic to the store and pushes the Import screen without it (Algo25 path)', () => {
        const mnemonic = new Array(25).fill('word').join(' ')
        mockParseDeeplink.mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic,
        })
        vi.mocked(detectImportKind).mockReturnValue({
            success: true,
            seed: null,
        })

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        act(() => {
            result.current.handleQRScannerSuccess('perawallet://recover/...')
        })

        expect(setPendingImportMnemonic).toHaveBeenCalledWith(mnemonic)
        expect(mockPush).toHaveBeenCalledWith('ImportAccount', {
            accountType: null,
        })
    })

    it('handleQRScannerSuccess shows an error and restarts scanning for a non-recover deeplink', () => {
        mockParseDeeplink.mockReturnValue({ type: DeeplinkType.ACCOUNT_DETAIL })
        const restartScanning = vi.fn()

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        act(() => {
            result.current.handleQRScannerSuccess(
                'perawallet://account/...',
                restartScanning,
            )
        })

        expect(mockErrorToast).toHaveBeenCalledTimes(1)
        expect(restartScanning).toHaveBeenCalledTimes(1)
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('handleQRScannerSuccess shows an error and restarts scanning for an invalid mnemonic', () => {
        mockParseDeeplink.mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic: 'too short',
        })
        vi.mocked(detectImportKind).mockReturnValue({
            success: false,
            wordCount: 2,
        })
        const restartScanning = vi.fn()

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        act(() => {
            result.current.handleQRScannerSuccess(
                'perawallet://recover/...',
                restartScanning,
            )
        })

        expect(mockErrorToast).toHaveBeenCalledTimes(1)
        expect(restartScanning).toHaveBeenCalledTimes(1)
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('offers no quantum row on the screen itself; the passphrase sheet does', () => {
        setQuantumEnabled(true)

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        expect(
            optionsOf(result.current).some(o => o.testID.includes('quantum')),
        ).toBe(false)
    })

    describe('cloud backup import option', () => {
        it('is absent when the cloud backup flag is off', () => {
            const { result } = renderHook(() => useImportAccountOptionsScreen())

            const testIDs = optionsOf(result.current).map(o => o.testID)

            expect(testIDs).not.toContain(
                'import_account_options_cloud_backup_button',
            )
        })

        it('sits right after the passphrase row when the flag is on', () => {
            mockCloudBackupFlag.enabled = true

            const { result } = renderHook(() => useImportAccountOptionsScreen())

            expect(result.current.mainOptions[1]?.testID).toBe(
                'import_account_options_cloud_backup_button',
            )
        })

        it.each([
            [['CloudBackupRestoreScan']],
            [['CloudBackupRestorePassphrase']],
            [
                [
                    'CloudBackupRestorePassphrase',
                    { importedKey: { salt: 'c2FsdA==' } },
                ],
            ],
        ])('pushes %j when the restore options pick it', async route => {
            mockCloudBackupFlag.enabled = true
            mockChooseRestoreRoute.mockResolvedValueOnce(route)

            const { result } = renderHook(() => useImportAccountOptionsScreen())

            await pressCloudBackupOption(result)

            expect(mockPush).toHaveBeenCalledWith(route[0], route[1])
        })

        it('pushes nothing when no route is picked', async () => {
            mockCloudBackupFlag.enabled = true
            mockChooseRestoreRoute.mockResolvedValueOnce(null)

            const { result } = renderHook(() => useImportAccountOptionsScreen())

            await pressCloudBackupOption(result)

            expect(mockPush).not.toHaveBeenCalled()
        })

        it('shows an error without opening the sheet when a backup is already configured on this device', async () => {
            mockCloudBackupFlag.enabled = true
            mockCloudBackupState.isConfigured = true

            const { result } = renderHook(() => useImportAccountOptionsScreen())

            await pressCloudBackupOption(result)

            expect(mockErrorToast).toHaveBeenCalledWith(
                'onboarding.import_account_options.cloud_backup_already_enabled_title',
                'onboarding.import_account_options.cloud_backup_already_enabled_body',
            )
            expect(mockChooseRestoreRoute).not.toHaveBeenCalled()
            expect(mockPush).not.toHaveBeenCalled()
        })
    })

    describe('private-key import option', () => {
        const PRIVATE_KEY_BUTTON = 'import_account_options_private_key_button'

        afterEach(() => {
            restoreAlgorandOnlyChains()
        })

        it('is absent with Algorand alone', () => {
            const { result } = renderHook(() => useImportAccountOptionsScreen())

            expect(optionsOf(result.current).map(o => o.testID)).not.toContain(
                PRIVATE_KEY_BUTTON,
            )
        })

        it('opens the private-key import on the chain that imports raw keys', () => {
            registerEthereumChain()
            const { result } = renderHook(() => useImportAccountOptionsScreen())

            const option = optionsOf(result.current).find(
                o => o.testID === PRIVATE_KEY_BUTTON,
            )
            act(() => option!.onPress!())

            expect(mockPush).toHaveBeenCalledWith('ImportPrivateKey', {
                chainId: ETHEREUM_CHAIN_ID,
            })
        })

        it('is absent while private keys are off', () => {
            registerEthereumChain()
            capabilityState.turnOff('privateKeys')

            const { result } = renderHook(() => useImportAccountOptionsScreen())

            expect(optionsOf(result.current).map(o => o.testID)).not.toContain(
                PRIVATE_KEY_BUTTON,
            )
        })
    })

    describe('capability gating', () => {
        const optionIds = (): string[] => {
            const { result } = renderHook(() => useImportAccountOptionsScreen())
            return optionsOf(result.current).map(o => o.testID)
        }

        it('removes the Pera Web row, and only it, when peraWebImport is off', () => {
            const before = optionIds()
            capabilityState.turnOff('peraWebImport')

            const after = optionIds()

            expect(after).not.toContain(
                'import_account_options_pera_web_button',
            )
            expect(after).toEqual(
                before.filter(
                    id => id !== 'import_account_options_pera_web_button',
                ),
            )
        })

        it('removes the Ledger row when the ledger capability is off', () => {
            mockCapabilities.ledgerUsb = true
            const before = optionIds()
            expect(before).toContain(
                'import_account_options_pair_ledger_button',
            )
            capabilityState.turnOff('ledger')

            const after = optionIds()

            expect(after).not.toContain(
                'import_account_options_pair_ledger_button',
            )
        })

        it('keeps every other row enabled', () => {
            capabilityState.turnOff('peraWebImport')

            const { result } = renderHook(() => useImportAccountOptionsScreen())

            expect(optionsOf(result.current).every(o => !o.isDisabled)).toBe(
                true,
            )
        })
    })

    describe('Ledger transport support', () => {
        const ledgerOption = (result: {
            current: UseImportAccountOptionsScreenResult
        }) =>
            optionsOf(result.current).find(
                o => o.testID === 'import_account_options_pair_ledger_button',
            )!

        it('keeps the Ledger row enabled until the browser check resolves', () => {
            const { result } = renderHook(() => useImportAccountOptionsScreen())

            expect(ledgerOption(result).isDisabled).toBe(false)
        })

        it('keeps the Ledger row enabled while either transport works', () => {
            mockCapabilities.ledgerUsb = true
            mockLedgerSupport.isReady = true
            mockLedgerSupport.supportedTransportTypes = ['usb']

            const { result } = renderHook(() => useImportAccountOptionsScreen())

            expect(ledgerOption(result).isDisabled).toBe(false)
        })

        it('disables the Ledger row, and says why, when no offered transport works', () => {
            mockLedgerSupport.isReady = true
            mockLedgerSupport.supportedTransportTypes = ['usb']

            const { result } = renderHook(() => useImportAccountOptionsScreen())

            expect(ledgerOption(result).isDisabled).toBe(true)
            expect(ledgerOption(result).descriptionKey).toBe(
                'onboarding.import_account_options.pair_ledger_unsupported_description',
            )
        })

        it('tells the transport sheet which transports this browser supports', async () => {
            mockCapabilities.ledgerUsb = true
            mockLedgerSupport.isReady = true
            mockLedgerSupport.supportedTransportTypes = ['ble']

            const { result } = renderHook(() => useImportAccountOptionsScreen())

            await act(async () => {
                ledgerOption(result).onPress()
            })

            const sheet = mockRequestBottomSheet.mock.calls[0]![0] as {
                contents: {
                    props: { isBleAvailable: boolean; isUsbAvailable: boolean }
                }
            }
            expect(sheet.contents.props).toEqual({
                isBleAvailable: true,
                isUsbAvailable: false,
            })
        })
    })
})
