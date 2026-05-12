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

import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Platform } from 'react-native'
import { ImportAccountOptionsScreen } from '../ImportAccountOptionsScreen'

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

const mockImportAccount = vi.fn()
const mockMarkBackupComplete = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        resolveImportAccountType: vi.fn(),
        useImportAccount: () => mockImportAccount,
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

vi.mock('@perawallet/wallet-core-backup', () => ({
    useMarkMnemonicBackupComplete: () => mockMarkBackupComplete,
}))

describe('ImportAccountOptionsScreen', () => {
    const originalOS = Platform.OS

    beforeEach(() => {
        vi.clearAllMocks()
        Platform.OS = 'ios'
        mockRequestBottomSheet.mockResolvedValue(undefined)
    })

    afterEach(() => {
        Platform.OS = originalOS
    })

    it('renders the screen title', () => {
        render(<ImportAccountOptionsScreen />)

        expect(
            screen.getByText('onboarding.import_account_options.title'),
        ).toBeTruthy()
    })

    it('renders all import options', () => {
        render(<ImportAccountOptionsScreen />)

        expect(
            screen.getByText(
                'onboarding.import_account_options.recover_wallet_title',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.import_account_options.recover_qr_title',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.import_account_options.pair_ledger_title',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.import_account_options.pera_web_title',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText('onboarding.import_account_options.asb_title'),
        ).toBeTruthy()
    })

    it('navigates to LedgerInstructions with ble transportType when Pair Ledger is pressed', () => {
        render(<ImportAccountOptionsScreen />)

        const ledgerButton = screen.getByText(
            'onboarding.import_account_options.pair_ledger_title',
        )
        fireEvent.click(ledgerButton)

        expect(mockPush).toHaveBeenCalledWith('LedgerInstructions', {
            transportType: 'ble',
        })
    })

    it('does not render the USB option on iOS', () => {
        render(<ImportAccountOptionsScreen />)

        expect(
            screen.queryByText(
                'onboarding.import_account_options.pair_ledger_usb_title',
            ),
        ).toBeNull()
    })

    it('renders the USB option on Android', () => {
        Platform.OS = 'android'

        render(<ImportAccountOptionsScreen />)

        expect(
            screen.getByText(
                'onboarding.import_account_options.pair_ledger_usb_title',
            ),
        ).toBeTruthy()
    })

    it('navigates to LedgerInstructions with usb transportType when Pair Ledger USB is pressed on Android', () => {
        Platform.OS = 'android'

        render(<ImportAccountOptionsScreen />)

        const usbButton = screen.getByText(
            'onboarding.import_account_options.pair_ledger_usb_title',
        )
        fireEvent.click(usbButton)

        expect(mockPush).toHaveBeenCalledWith('LedgerInstructions', {
            transportType: 'usb',
        })
    })

    it('shows not implemented toast when Pera Web is pressed', () => {
        render(<ImportAccountOptionsScreen />)

        const peraWebButton = screen.getByText(
            'onboarding.import_account_options.pera_web_title',
        )
        fireEvent.click(peraWebButton)

        expect(mockErrorToast).toHaveBeenCalledWith(
            'common.not_implemented.title',
            'common.not_implemented.body',
        )
    })

    it('shows not implemented toast when ASB is pressed', () => {
        render(<ImportAccountOptionsScreen />)

        const asbButton = screen.getByText(
            'onboarding.import_account_options.asb_title',
        )
        fireEvent.click(asbButton)

        expect(mockErrorToast).toHaveBeenCalledWith(
            'common.not_implemented.title',
            'common.not_implemented.body',
        )
    })

    it('requests import options bottom sheet when Recover Wallet is pressed', () => {
        render(<ImportAccountOptionsScreen />)

        const recoverButton = screen.getByText(
            'onboarding.import_account_options.recover_wallet_title',
        )
        fireEvent.click(recoverButton)

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })

    it('navigates to ImportInfo with the selected option when bottom sheet resolves', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce('hdWallet')
        render(<ImportAccountOptionsScreen />)

        const recoverButton = screen.getByText(
            'onboarding.import_account_options.recover_wallet_title',
        )
        fireEvent.click(recoverButton)

        await vi.waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('ImportInfo', {
                accountType: 'hdWallet',
            })
        })
    })
})
