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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    resolveImportAccountType,
    setPendingImportMnemonic,
} from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { Networks } from '@perawallet/wallet-core-config'
import { DeeplinkType } from '@modules/deeplink/types'
import {
    useImportAccountOptionsScreen,
    type UseImportAccountOptionsScreenResult,
} from '../useImportAccountOptionsScreen'

const mockPush = vi.fn()
const mockGoBack = vi.fn()

const { mockCapabilities } = vi.hoisted(() => ({
    mockCapabilities: {} as Record<string, boolean>,
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
        buildAccountDeeplink: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        resolveImportAccountType: vi.fn(),
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

const mockQuantumFlag = vi.hoisted(() => ({ enabled: false }))
vi.mock('@hooks/useIsQuantumAccountsEnabled', () => ({
    useIsQuantumAccountsEnabled: () => mockQuantumFlag.enabled,
}))

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

vi.mock('@modules/cloud-backup', () => ({
    useRestoreBackupOptions: () => ({
        chooseRestoreRoute: mockChooseRestoreRoute,
        isReadingCredentials: false,
    }),
}))

const pressCloudBackupOption = async (result: {
    current: UseImportAccountOptionsScreenResult
}) => {
    const option = result.current.options.find(
        o => o.testID === 'import_account_options_cloud_backup_button',
    )!

    await act(async () => {
        await option.onPress()
    })
}

describe('useImportAccountOptionsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCapabilities.ledgerUsb = false
        mockRequestBottomSheet.mockResolvedValue(undefined)
        mockQuantumFlag.enabled = false
        mockCloudBackupFlag.enabled = false
        mockCloudBackupState.isConfigured = false
        mockLedgerSupport.isReady = false
        mockLedgerSupport.supportedTransportTypes = []
        vi.mocked(useNetwork).mockReturnValue({
            network: Networks.mainnet,
        } as ReturnType<typeof useNetwork>)
    })

    it('returns 5 options without Ledger USB', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        expect(result.current.options).toHaveLength(5)
    })

    it('returns 6 options with Ledger USB', () => {
        mockCapabilities.ledgerUsb = true

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        expect(result.current.options).toHaveLength(6)
    })

    it('options have correct testIDs', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const testIDs = result.current.options.map(o => o.testID)

        expect(testIDs).toContain(
            'import_account_options_recover_wallet_button',
        )
        expect(testIDs).toContain('import_account_options_recover_qr_button')
        expect(testIDs).toContain('import_account_options_pair_ledger_button')
        expect(testIDs).toContain('import_account_options_pera_web_button')
        expect(testIDs).toContain('import_account_options_asb_button')
    })

    it('hides the USB option without Ledger USB', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const testIDs = result.current.options.map(o => o.testID)

        expect(testIDs).not.toContain(
            'import_account_options_pair_ledger_usb_button',
        )
    })

    it('shows the USB option with Ledger USB', () => {
        mockCapabilities.ledgerUsb = true

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const testIDs = result.current.options.map(o => o.testID)

        expect(testIDs).toContain(
            'import_account_options_pair_ledger_usb_button',
        )
    })

    it('recover wallet option requests import options bottom sheet', async () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const recoverOption = result.current.options.find(
            o => o.testID === 'import_account_options_recover_wallet_button',
        )!

        await act(async () => {
            await recoverOption.onPress()
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })

    it('navigates to ImportInfo when the import options sheet resolves with a result', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce('algo25')
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const recoverOption = result.current.options.find(
            o => o.testID === 'import_account_options_recover_wallet_button',
        )!

        await act(async () => {
            await recoverOption.onPress()
        })

        expect(mockPush).toHaveBeenCalledWith('ImportInfo', {
            accountType: 'algo25',
        })
    })

    it('QR option opens QR scanner', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        expect(result.current.isQRScannerVisible).toBe(false)

        const qrOption = result.current.options.find(
            o => o.testID === 'import_account_options_recover_qr_button',
        )!

        act(() => {
            qrOption.onPress()
        })

        expect(result.current.isQRScannerVisible).toBe(true)
    })

    it('Ledger BLE option navigates to LedgerPair', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const ledgerOption = result.current.options.find(
            o => o.testID === 'import_account_options_pair_ledger_button',
        )!

        act(() => {
            ledgerOption.onPress()
        })

        expect(mockPush).toHaveBeenCalledWith('LedgerPair')
    })

    it('Ledger USB option navigates to LedgerInstructions with usb transportType', () => {
        mockCapabilities.ledgerUsb = true

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const usbOption = result.current.options.find(
            o => o.testID === 'import_account_options_pair_ledger_usb_button',
        )!

        act(() => {
            usbOption.onPress()
        })

        expect(mockPush).toHaveBeenCalledWith('LedgerInstructions', {
            transportType: 'usb',
        })
    })

    it('Pera Web option navigates to the Pera Web import wizard', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const peraWebOption = result.current.options.find(
            o => o.testID === 'import_account_options_pera_web_button',
        )!

        act(() => {
            peraWebOption.onPress()
        })

        expect(mockPush).toHaveBeenCalledWith('PeraWebImportInfo')
    })

    it('ASB option navigates to the ASB recovery wizard', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const asbOption = result.current.options.find(
            o => o.testID === 'import_account_options_asb_button',
        )!

        act(() => {
            asbOption.onPress()
        })

        expect(mockPush).toHaveBeenCalledWith('AsbImportInfo')
    })

    it('ASB option keeps its Algorand Secure Backup title when cloud backup is off', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const asbOption = result.current.options.find(
            o => o.testID === 'import_account_options_asb_button',
        )!

        expect(asbOption.titleKey).toBe(
            'onboarding.import_account_options.asb_title',
        )
    })

    it('ASB option is titled as the legacy backup when cloud backup is on', () => {
        mockCloudBackupFlag.enabled = true

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const asbOption = result.current.options.find(
            o => o.testID === 'import_account_options_asb_button',
        )!

        expect(asbOption.titleKey).toBe(
            'onboarding.import_account_options.asb_legacy_title',
        )
    })

    it('handleCloseQRScanner closes the QR scanner', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        // Open the QR scanner
        act(() => {
            result.current.options
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
        vi.mocked(resolveImportAccountType).mockReturnValue({
            success: true,
            accountType: 'hdWallet',
        })

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        act(() => {
            result.current.handleQRScannerSuccess('perawallet://recover/...')
        })

        // Mnemonic goes through the in-memory store, never the route params.
        expect(setPendingImportMnemonic).toHaveBeenCalledWith(mnemonic)
        expect(mockPush).toHaveBeenCalledWith('ImportAccount', {
            accountType: 'hdWallet',
        })
    })

    it('handleQRScannerSuccess hands the mnemonic to the store and pushes the Import screen without it (Algo25 path)', () => {
        const mnemonic = new Array(25).fill('word').join(' ')
        mockParseDeeplink.mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic,
        })
        vi.mocked(resolveImportAccountType).mockReturnValue({
            success: true,
            accountType: 'algo25',
        })

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        act(() => {
            result.current.handleQRScannerSuccess('perawallet://recover/...')
        })

        expect(setPendingImportMnemonic).toHaveBeenCalledWith(mnemonic)
        expect(mockPush).toHaveBeenCalledWith('ImportAccount', {
            accountType: 'algo25',
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
        vi.mocked(resolveImportAccountType).mockReturnValue({
            success: false,
        } as never)
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

    describe('quantum import option', () => {
        it('is absent when the quantum accounts flag is off', () => {
            mockQuantumFlag.enabled = false

            const { result } = renderHook(() => useImportAccountOptionsScreen())

            const testIDs = result.current.options.map(o => o.testID)

            expect(testIDs).not.toContain('import_account_quantum_button')
        })

        it('is present with the quantum title when the flag is on and adds exactly one option', () => {
            mockQuantumFlag.enabled = false
            const { result: offResult } = renderHook(() =>
                useImportAccountOptionsScreen(),
            )
            const offLength = offResult.current.options.length

            mockQuantumFlag.enabled = true
            const { result: onResult } = renderHook(() =>
                useImportAccountOptionsScreen(),
            )

            const quantumOption = onResult.current.options.find(
                o => o.testID === 'import_account_quantum_button',
            )

            expect(quantumOption).toBeDefined()
            expect(quantumOption!.titleKey).toBe(
                'onboarding.import_account_options.quantum_title',
            )
            expect(onResult.current.options).toHaveLength(offLength + 1)
        })

        it('navigates to ImportAccount with the quantum account type on press', () => {
            mockQuantumFlag.enabled = true

            const { result } = renderHook(() => useImportAccountOptionsScreen())

            const quantumOption = result.current.options.find(
                o => o.testID === 'import_account_quantum_button',
            )!

            act(() => {
                quantumOption.onPress()
            })

            expect(mockPush).toHaveBeenCalledWith('ImportAccount', {
                accountType: 'quantum',
            })
        })
    })

    describe('cloud backup import option', () => {
        it('is absent when the cloud backup flag is off', () => {
            const { result } = renderHook(() => useImportAccountOptionsScreen())

            const testIDs = result.current.options.map(o => o.testID)

            expect(testIDs).not.toContain(
                'import_account_options_cloud_backup_button',
            )
        })

        it('sits directly above the ASB option when the flag is on', () => {
            mockCloudBackupFlag.enabled = true

            const { result } = renderHook(() => useImportAccountOptionsScreen())

            const testIDs = result.current.options.map(o => o.testID)

            expect(testIDs.indexOf('import_account_options_asb_button')).toBe(
                testIDs.indexOf('import_account_options_cloud_backup_button') +
                    1,
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

    describe('non-Pera-backed networks', () => {
        it.each([Networks.betanet, Networks.custom])(
            'disables the Pera Web option with the network-unavailable reason on %s',
            network => {
                vi.mocked(useNetwork).mockReturnValue({
                    network,
                } as ReturnType<typeof useNetwork>)

                const { result } = renderHook(() =>
                    useImportAccountOptionsScreen(),
                )

                const peraWebOption = result.current.options.find(
                    o => o.testID === 'import_account_options_pera_web_button',
                )!

                expect(peraWebOption.isDisabled).toBe(true)
                expect(peraWebOption.descriptionKey).toBe(
                    'common.network_unavailable.body',
                )
            },
        )

        it('keeps the other options untouched on a non-Pera-backed network', () => {
            vi.mocked(useNetwork).mockReturnValue({
                network: Networks.betanet,
            } as ReturnType<typeof useNetwork>)

            const { result } = renderHook(() => useImportAccountOptionsScreen())

            const otherOptions = result.current.options.filter(
                o => o.testID !== 'import_account_options_pera_web_button',
            )

            expect(otherOptions.every(o => !o.isDisabled)).toBe(true)
        })

        it('enables the Pera Web option with its original description on mainnet', () => {
            vi.mocked(useNetwork).mockReturnValue({
                network: Networks.mainnet,
            } as ReturnType<typeof useNetwork>)

            const { result } = renderHook(() => useImportAccountOptionsScreen())

            const peraWebOption = result.current.options.find(
                o => o.testID === 'import_account_options_pera_web_button',
            )!

            expect(peraWebOption.isDisabled).toBe(false)
            expect(peraWebOption.descriptionKey).toBe(
                'onboarding.import_account_options.pera_web_description',
            )
        })
    })

    describe('Ledger transport support', () => {
        const findOption = (
            result: { current: UseImportAccountOptionsScreenResult },
            testID: string,
        ) => result.current.options.find(o => o.testID === testID)!

        beforeEach(() => {
            mockCapabilities.ledgerUsb = true
        })

        it('keeps both Ledger rows enabled until the browser check resolves', () => {
            const { result } = renderHook(() => useImportAccountOptionsScreen())

            expect(
                findOption(result, 'import_account_options_pair_ledger_button')
                    .isDisabled,
            ).toBe(false)
            expect(
                findOption(
                    result,
                    'import_account_options_pair_ledger_usb_button',
                ).isDisabled,
            ).toBe(false)
        })

        it('disables Bluetooth pairing, and says why, in a browser without Web Bluetooth', () => {
            mockLedgerSupport.isReady = true
            mockLedgerSupport.supportedTransportTypes = ['usb']

            const { result } = renderHook(() => useImportAccountOptionsScreen())
            const ble = findOption(
                result,
                'import_account_options_pair_ledger_button',
            )

            expect(ble.isDisabled).toBe(true)
            expect(ble.descriptionKey).toBe(
                'onboarding.import_account_options.pair_ledger_unsupported_description',
            )
            expect(
                findOption(
                    result,
                    'import_account_options_pair_ledger_usb_button',
                ).isDisabled,
            ).toBe(false)
        })

        it('disables USB pairing in a browser without WebHID', () => {
            mockLedgerSupport.isReady = true
            mockLedgerSupport.supportedTransportTypes = ['ble']

            const { result } = renderHook(() => useImportAccountOptionsScreen())
            const usb = findOption(
                result,
                'import_account_options_pair_ledger_usb_button',
            )

            expect(usb.isDisabled).toBe(true)
            expect(usb.descriptionKey).toBe(
                'onboarding.import_account_options.pair_ledger_unsupported_description',
            )
        })
    })
})
