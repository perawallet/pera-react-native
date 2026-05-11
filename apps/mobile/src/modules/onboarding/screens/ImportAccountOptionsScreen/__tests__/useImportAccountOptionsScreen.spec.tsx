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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Platform } from 'react-native'
import { useImportAccountOptionsScreen } from '../useImportAccountOptionsScreen'

const mockPush = vi.fn()
const mockGoBack = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        push: mockPush,
        goBack: mockGoBack,
    }),
}))

const mockShowToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
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

describe('useImportAccountOptionsScreen', () => {
    const originalOS = Platform.OS

    beforeEach(() => {
        vi.clearAllMocks()
        Platform.OS = 'ios'
        mockRequestBottomSheet.mockResolvedValue(undefined)
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

    it('Ledger BLE option navigates to LedgerInstructions with ble transportType', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const ledgerOption = result.current.options.find(
            o => o.testID === 'import_account_options_pair_ledger_button',
        )!

        act(() => {
            ledgerOption.onPress()
        })

        expect(mockPush).toHaveBeenCalledWith('LedgerInstructions', {
            transportType: 'ble',
        })
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

    it('Pera Web option shows not implemented toast', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const peraWebOption = result.current.options.find(
            o => o.testID === 'import_account_options_pera_web_button',
        )!

        act(() => {
            peraWebOption.onPress()
        })

        expect(mockShowToast).toHaveBeenCalledWith({
            title: 'common.not_implemented.title',
            body: 'common.not_implemented.body',
            type: 'error',
        })
    })

    it('ASB option shows not implemented toast', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        const asbOption = result.current.options.find(
            o => o.testID === 'import_account_options_asb_button',
        )!

        act(() => {
            asbOption.onPress()
        })

        expect(mockShowToast).toHaveBeenCalledWith({
            title: 'common.not_implemented.title',
            body: 'common.not_implemented.body',
            type: 'error',
        })
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
})
