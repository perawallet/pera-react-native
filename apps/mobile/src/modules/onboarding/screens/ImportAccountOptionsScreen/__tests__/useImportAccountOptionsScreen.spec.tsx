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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Platform } from 'react-native'
import {
    resolveImportAccountType,
    setPendingImportMnemonic,
} from '@perawallet/wallet-core-accounts'
import { DeeplinkType } from '@hooks/deeplink/types'
import { useImportAccountOptionsScreen } from '../useImportAccountOptionsScreen'

const mockPush = vi.fn()
const mockGoBack = vi.fn()

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
vi.mock('@hooks/useDeepLink', () => ({
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

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
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

describe('useImportAccountOptionsScreen', () => {
    const originalOS = Platform.OS

    beforeEach(() => {
        vi.clearAllMocks()
        Platform.OS = 'ios'
        mockRequestBottomSheet.mockResolvedValue(undefined)
        mockQuantumFlag.enabled = false
    })

    afterEach(() => {
        Platform.OS = originalOS
    })

    it('returns 5 options on iOS', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        expect(result.current.options).toHaveLength(5)
    })

    it('returns 6 options on Android (includes USB)', () => {
        Platform.OS = 'android'

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

    it('USB option is hidden on iOS', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const testIDs = result.current.options.map(o => o.testID)

        expect(testIDs).not.toContain(
            'import_account_options_pair_ledger_usb_button',
        )
    })

    it('USB option is shown on Android', () => {
        Platform.OS = 'android'

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const testIDs = result.current.options.map(o => o.testID)

        expect(testIDs).toContain(
            'import_account_options_pair_ledger_usb_button',
        )
    })

    it('returns 6 options on web (includes USB)', () => {
        Platform.OS = 'web'

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        expect(result.current.options).toHaveLength(6)
    })

    it('USB option is shown on web', () => {
        Platform.OS = 'web'

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

    it('Ledger USB option navigates to LedgerInstructions with usb transportType on Android', () => {
        Platform.OS = 'android'

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

    it('Ledger USB option navigates to LedgerInstructions with usb transportType on web', () => {
        Platform.OS = 'web'

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
})
