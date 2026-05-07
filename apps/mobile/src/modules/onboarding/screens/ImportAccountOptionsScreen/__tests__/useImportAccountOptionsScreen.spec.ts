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
import {
    resolveImportAccountType,
    useImportAccount,
} from '@perawallet/wallet-core-accounts'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'
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

const mockImportAccount = vi.fn()
const mockMarkBackupComplete = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        resolveImportAccountType: vi.fn(),
        useImportAccount: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-core-backup', () => ({
    useMarkMnemonicBackupComplete: vi.fn(),
}))

describe('useImportAccountOptionsScreen', () => {
    const originalOS = Platform.OS

    beforeEach(() => {
        vi.clearAllMocks()
        Platform.OS = 'ios'
        vi.mocked(useImportAccount).mockReturnValue(mockImportAccount)
        vi.mocked(useMarkMnemonicBackupComplete).mockReturnValue(
            mockMarkBackupComplete,
        )
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

    it('recover wallet option opens import options bottom sheet', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        expect(result.current.isImportOptionsVisible).toBe(false)

        const recoverOption = result.current.options.find(
            o => o.testID === 'import_account_options_recover_wallet_button',
        )!

        act(() => {
            recoverOption.onPress()
        })

        expect(result.current.isImportOptionsVisible).toBe(true)
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

    it('handleHDWalletPress closes import options and navigates to ImportInfo', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        // Open the import options first
        act(() => {
            result.current.options
                .find(
                    o =>
                        o.testID ===
                        'import_account_options_recover_wallet_button',
                )!
                .onPress()
        })
        expect(result.current.isImportOptionsVisible).toBe(true)

        act(() => {
            result.current.handleHDWalletPress()
        })

        expect(result.current.isImportOptionsVisible).toBe(false)
        expect(mockPush).toHaveBeenCalledWith('ImportInfo', {
            accountType: 'hdWallet',
        })
    })

    it('handleAlgo25Press closes import options and navigates to ImportInfo', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        // Open the import options first
        act(() => {
            result.current.options
                .find(
                    o =>
                        o.testID ===
                        'import_account_options_recover_wallet_button',
                )!
                .onPress()
        })
        expect(result.current.isImportOptionsVisible).toBe(true)

        act(() => {
            result.current.handleAlgo25Press()
        })

        expect(result.current.isImportOptionsVisible).toBe(false)
        expect(mockPush).toHaveBeenCalledWith('ImportInfo', {
            accountType: 'algo25',
        })
    })

    it('handleCloseImportOptions closes the import options bottom sheet', () => {
        const { result } = renderHook(() => useImportAccountOptionsScreen())

        // Open the import options
        act(() => {
            result.current.options
                .find(
                    o =>
                        o.testID ===
                        'import_account_options_recover_wallet_button',
                )!
                .onPress()
        })
        expect(result.current.isImportOptionsVisible).toBe(true)

        act(() => {
            result.current.handleCloseImportOptions()
        })

        expect(result.current.isImportOptionsVisible).toBe(false)
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

    it('handleQRScannerSuccess imports the mnemonic and pushes SearchAccounts (HD path)', async () => {
        const mnemonic = new Array(24).fill('word').join(' ')
        mockParseDeeplink.mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic,
        })
        vi.mocked(resolveImportAccountType).mockReturnValue({
            success: true,
            accountType: 'hdWallet',
        })
        mockImportAccount.mockResolvedValue({
            type: 'hdWallet',
            walletKeyId: 'test-wallet-key-id',
            derivationType: 9,
        })

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        await act(async () => {
            await result.current.handleQRScannerSuccess(
                'perawallet://recover/...',
            )
        })

        expect(mockImportAccount).toHaveBeenCalledWith({
            mnemonic,
            type: 'hdWallet',
        })
        expect(mockPush).toHaveBeenCalledWith('SearchAccounts', {
            mode: 'import',
            walletKeyId: 'test-wallet-key-id',
            derivationType: 9,
        })
        expect(mockMarkBackupComplete).not.toHaveBeenCalled()
    })

    it('handleQRScannerSuccess imports the mnemonic and pushes SearchAccounts (Algo25 path)', async () => {
        const mnemonic = new Array(25).fill('word').join(' ')
        const algo25Account = {
            id: 'algo25-id',
            address: 'TEST_ADDRESS',
            type: 'algo25' as const,
            keyPairId: 'algo25-keypair-id',
        }
        mockParseDeeplink.mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic,
        })
        vi.mocked(resolveImportAccountType).mockReturnValue({
            success: true,
            accountType: 'algo25',
        })
        mockImportAccount.mockResolvedValue(algo25Account)

        const { result } = renderHook(() => useImportAccountOptionsScreen())

        await act(async () => {
            await result.current.handleQRScannerSuccess(
                'perawallet://recover/...',
            )
        })

        expect(mockImportAccount).toHaveBeenCalledWith({
            mnemonic,
            type: 'algo25',
        })
        expect(mockMarkBackupComplete).toHaveBeenCalledWith(algo25Account)
        expect(mockPush).toHaveBeenCalledWith('SearchAccounts', {
            account: algo25Account,
        })
    })
})
