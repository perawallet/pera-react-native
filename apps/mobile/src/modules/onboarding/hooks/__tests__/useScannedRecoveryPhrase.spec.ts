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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRecoveryPhrase } from '@perawallet/wallet-core-accounts'
import { DeeplinkType } from '@perawallet/wallet-core-deeplinks'
import { useScannedRecoveryPhrase } from '../useScannedRecoveryPhrase'

const mockErrorToast = vi.fn()
const mockParseDeeplink = vi.fn()

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mockErrorToast }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@modules/deeplink/core', async () => ({
    DeeplinkType: (
        await vi.importActual<
            typeof import('@perawallet/wallet-core-deeplinks')
        >('@perawallet/wallet-core-deeplinks')
    ).DeeplinkType,
    parseDeeplink: (url: string) => mockParseDeeplink(url),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    checkRecoveryPhrase: vi.fn(),
}))

const TWELVE = new Array(12).fill('abandon')

const read = (scanned: string) =>
    renderHook(() =>
        useScannedRecoveryPhrase('algorand'),
    ).result.current.readScannedRecoveryPhrase(scanned)

describe('useScannedRecoveryPhrase', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockParseDeeplink.mockReturnValue(null)
        vi.mocked(checkRecoveryPhrase).mockReturnValue({
            success: true,
            seed: 'bip39',
            wordCount: 12,
        })
    })

    it.each([
        ['plain text', TWELVE.join(' ')],
        ['newline-separated words', TWELVE.join('\n')],
        ['capitalised words', TWELVE.map(w => w.toUpperCase()).join(' ')],
    ])(
        'reads %s as the lower-case words and names the kind and count',
        (_, scanned) => {
            const phrase = read(scanned)

            expect(checkRecoveryPhrase).toHaveBeenCalledWith('algorand', TWELVE)
            expect(phrase).toEqual({
                seed: 'bip39',
                wordCount: 12,
                mnemonic: TWELVE.join(' '),
            })
            expect(mockErrorToast).not.toHaveBeenCalled()
        },
    )

    it("takes the words from a Pera recovery link's comma-separated mnemonic", () => {
        mockParseDeeplink.mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic: TWELVE.join(','),
        })

        const phrase = read('perawallet://app/recover-address?mnemonic=...')

        expect(checkRecoveryPhrase).toHaveBeenCalledWith('algorand', TWELVE)
        expect(phrase?.mnemonic).toBe(TWELVE.join(' '))
    })

    it("hands a Pera link's non-letter token to the check instead of calling the link not a phrase", () => {
        mockParseDeeplink.mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic: 'abandon,abando1,about',
        })

        read('perawallet://app/recover-address?mnemonic=...')

        expect(checkRecoveryPhrase).toHaveBeenCalledWith('algorand', [
            'abandon',
            'abando1',
            'about',
        ])
    })

    it.each([
        [
            'another Pera link',
            'perawallet://app/account',
            { type: DeeplinkType.ACCOUNT_DETAIL },
        ],
        ['a URL', 'https://example.com/a b', null],
        ['a WalletConnect URI', 'wc:topic@2?relay-protocol=irn', null],
        ['empty text', '   ', null],
    ])(
        'refuses %s as not a phrase, without checking it',
        (_, scanned, link) => {
            mockParseDeeplink.mockReturnValue(link)

            expect(read(scanned)).toBeUndefined()

            expect(checkRecoveryPhrase).not.toHaveBeenCalled()
            expect(mockErrorToast).toHaveBeenCalledWith(
                'onboarding.add_account.qr_scan_invalid_title',
                'onboarding.add_account.qr_scan_invalid_body',
            )
        },
    )

    it.each([
        ['word-count', 'onboarding.add_account.qr_scan_invalid_mnemonic_body'],
        ['unknown-word', 'onboarding.add_account.qr_scan_unknown_word_body'],
        ['checksum', 'onboarding.add_account.qr_scan_invalid_checksum_body'],
    ] as const)('toasts the %s reason and returns nothing', (reason, body) => {
        vi.mocked(checkRecoveryPhrase).mockReturnValue({
            success: false,
            reason,
        })

        expect(read(TWELVE.join(' '))).toBeUndefined()

        expect(mockErrorToast).toHaveBeenCalledWith(
            'onboarding.add_account.qr_scan_invalid_mnemonic_title',
            body,
        )
    })

    it('never puts a scanned word in a toast', () => {
        vi.mocked(checkRecoveryPhrase).mockReturnValue({
            success: false,
            reason: 'unknown-word',
        })

        read('zebra '.repeat(11) + 'qwerty')

        expect(JSON.stringify(mockErrorToast.mock.calls)).not.toContain(
            'qwerty',
        )
    })
})
