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

import { useCallback } from 'react'
import {
    checkRecoveryPhrase,
    type MnemonicImportFormat,
    type RecoveryPhraseRejection,
} from '@perawallet/wallet-core-accounts'
import {
    i18nKey,
    type ChainId,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
// The core entry, not the barrel: the barrel loads every deeplink handler.
import { DeeplinkType, parseDeeplink } from '@modules/deeplink/core'
import { splitMnemonic } from '../utils'

export type ScannedRecoveryPhrase = MnemonicImportFormat & {
    /** Lower-case words joined by single spaces. */
    mnemonic: string
}

export type UseScannedRecoveryPhraseResult = {
    /** Toasts and returns `undefined` when the scan is not a phrase that would import. */
    readScannedRecoveryPhrase: (
        scanned: string,
    ) => Optional<ScannedRecoveryPhrase>
}

const REJECTION_BODY_KEYS: Record<RecoveryPhraseRejection, I18nKey> = {
    'word-count': i18nKey(
        'onboarding.add_account.qr_scan_invalid_mnemonic_body',
    ),
    'unknown-word': i18nKey('onboarding.add_account.qr_scan_unknown_word_body'),
    checksum: i18nKey('onboarding.add_account.qr_scan_invalid_checksum_body'),
}

const IS_WORD = /^\p{L}+$/u

// A Pera recovery link or legacy JSON carries the phrase, whatever its tokens;
// any other link is not one. Raw text must be letters only, which keeps URLs,
// addresses and pairing URIs from being read as words.
const wordsOfScan = (scanned: string): Optional<string[]> => {
    const link = parseDeeplink(scanned)
    if (link && link.type !== DeeplinkType.RECOVER_ADDRESS) return undefined
    const words = splitMnemonic(link ? link.mnemonic : scanned).map(word =>
        word.toLowerCase(),
    )
    if (words.length === 0) return undefined
    return link || words.every(word => IS_WORD.test(word)) ? words : undefined
}

export const useScannedRecoveryPhrase = (
    chainId: ChainId,
): UseScannedRecoveryPhraseResult => {
    const { errorToast } = useToast()
    const { t } = useLanguage()

    const readScannedRecoveryPhrase = useCallback(
        (scanned: string): Optional<ScannedRecoveryPhrase> => {
            const words = wordsOfScan(scanned)
            if (!words) {
                errorToast(
                    t('onboarding.add_account.qr_scan_invalid_title'),
                    t('onboarding.add_account.qr_scan_invalid_body'),
                )
                return undefined
            }

            const checked = checkRecoveryPhrase(chainId, words)
            if (!checked.success) {
                errorToast(
                    t('onboarding.add_account.qr_scan_invalid_mnemonic_title'),
                    t(REJECTION_BODY_KEYS[checked.reason]),
                )
                return undefined
            }

            return {
                seed: checked.seed,
                wordCount: checked.wordCount,
                mnemonic: words.join(' '),
            }
        },
        [chainId, errorToast, t],
    )

    return { readScannedRecoveryPhrase }
}
