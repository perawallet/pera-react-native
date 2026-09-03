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

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Linking } from 'react-native'

import { type RouteProp, useRoute } from '@react-navigation/native'
import type { OnboardingStackParamList } from '../../routes/types'
import {
    consumePendingImportMnemonic,
    DuplicateAccountError,
    MNEMONIC_WORD_COUNT,
    useImportAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'
import { config } from '@perawallet/wallet-core-config'
import { zeroBytes } from '@perawallet/wallet-core-kms'

import type { UseImportAccountScreenResult } from './types'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { deferToNextCycle, logger } from '@perawallet/wallet-core-shared'
import { useClipboard } from '@hooks/useClipboard'
import { useModalState } from '@hooks/useModalState'
import { useDeepLink } from '@hooks/useDeepLink'
import { DeeplinkType } from '@hooks/deeplink/types'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useMnemonicWordEntry } from '@modules/onboarding/hooks'
import {
    ImportAccountSupportOptionsContent,
    type ImportAccountSupportOptionsContentResult,
} from './ImportAccountSupportOptionsContent'

export function useImportAccountScreen(): UseImportAccountScreenResult {
    const {
        params: { accountType },
    } = useRoute<RouteProp<OnboardingStackParamList, 'ImportAccount'>>()
    const navigation = useAppNavigation()
    const importAccount = useImportAccount()
    const markBackupComplete = useMarkMnemonicBackupComplete()
    const { showToast, errorToast } = useToast()
    const { t } = useLanguage()
    const { parseDeeplink } = useDeepLink()
    const { request: requestBottomSheet } = useBottomSheet()
    const { readText } = useClipboard()

    const mnemonicLength = MNEMONIC_WORD_COUNT[accountType]

    const isQuantum = accountType === 'quantum'
    const titleKey = isQuantum
        ? 'onboarding.import_account.quantum_title'
        : 'onboarding.import_account.title'
    const infoNoteKey = isQuantum
        ? 'onboarding.import_account.quantum_info_note'
        : null

    const onTooManyWords = useCallback(() => {
        errorToast(
            t('onboarding.import_account.invalid_mnemonic_title'),
            t('onboarding.import_account.invalid_mnemonic_body'),
        )
    }, [errorToast, t])

    const onInsufficientSlots = useCallback(() => {
        errorToast(
            t('onboarding.import_account.insufficient_slots_title'),
            t('onboarding.import_account.insufficient_slots_body'),
        )
    }, [errorToast, t])

    const {
        words,
        focused,
        suggestions,
        setFocused,
        updateWord,
        handleWordChange,
        handleSelectSuggestion,
        refCallbacks,
        handleSubmitEditing,
        invalidWordIndices,
        areAllWordsValid,
        getMnemonicIndices,
    } = useMnemonicWordEntry({
        wordCount: mnemonicLength,
        onTooManyWords,
        onInsufficientSlots,
    })

    const [processing, setProcessing] = useState(false)
    const {
        isOpen: isQRScannerVisible,
        open: openQRScanner,
        close: handleCloseQRScanner,
    } = useModalState()

    const canImport = useMemo(() => areAllWordsValid, [areAllWordsValid])

    // Pre-populate the passphrase from a scanned QR / recover-address deeplink
    // so the user reviews and confirms the words before importing. The mnemonic
    // is handed off via an in-memory store (as scrubbable bytes, not a route
    // param) so the secret never enters the navigation state tree; consuming it
    // here reads and scrubs the store in one step. Runs once on mount;
    // `updateWord` distributes a full space-separated mnemonic across the word
    // fields starting at index 0.
    useEffect(() => {
        const pendingMnemonic = consumePendingImportMnemonic()
        if (pendingMnemonic) {
            updateWord(pendingMnemonic, 0)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleImportAccount = useCallback(() => {
        setProcessing(true)
        void deferToNextCycle(async () => {
            // Zeroable indices straight from the slot state — no mnemonic
            // string or word array is assembled on the import path.
            // `canImport` already gates on every word being a wordlist word,
            // so null only means an out-of-band invocation.
            const mnemonicIndices = getMnemonicIndices()
            if (!mnemonicIndices) {
                errorToast(
                    t('onboarding.import_account.invalid_mnemonic_title'),
                    t('onboarding.import_account.invalid_mnemonic_body'),
                )
                setProcessing(false)
                return
            }

            try {
                const result = await importAccount({
                    mnemonicIndices,
                    type: accountType,
                })

                if (Array.isArray(result)) {
                    // Quantum import: one 25-word phrase backs up every
                    // derivation that got minted, so mark them all complete;
                    // the first entry (canonical when it was minted, else
                    // the sole legacy import) carries the flow forward.
                    result.forEach(account => markBackupComplete(account))
                    navigation.replace('SearchAccounts', {
                        account: result[0],
                    })
                } else if (
                    result.type === 'hdWallet' &&
                    'walletKeyId' in result
                ) {
                    navigation.replace('SearchAccounts', {
                        mode: 'import',
                        walletKeyId: result.walletKeyId,
                        derivationType: result.derivationType,
                    })
                } else {
                    markBackupComplete(result as WalletAccount)
                    navigation.replace('SearchAccounts', {
                        account: result as WalletAccount,
                    })
                }
            } catch (e) {
                logger.error('Import account failed', { error: e })
                const isDuplicate = e instanceof DuplicateAccountError
                // lanekeep-ignore-next-line pera/no-error-toast-in-catch reason: on DuplicateAccountError showError resolves to the generic errors.account.generic copy, not the specific import_account.duplicate_account_* strings this needs
                showToast({
                    title: t(
                        isDuplicate
                            ? 'onboarding.import_account.duplicate_account_title'
                            : 'onboarding.import_account.failed_title',
                    ),
                    body: t(
                        isDuplicate
                            ? 'onboarding.import_account.duplicate_account_body'
                            : 'onboarding.import_account.failed_body',
                    ),
                    type: 'error',
                })
            } finally {
                zeroBytes(mnemonicIndices)
                setProcessing(false)
            }
        })
    }, [
        importAccount,
        markBackupComplete,
        getMnemonicIndices,
        accountType,
        navigation,
        showToast,
        errorToast,
        t,
    ])

    const handlePastePassphrase = useCallback(async () => {
        const content = await readText()

        if (content) {
            updateWord(content, 0)
        }
    }, [updateWord, readText])

    const handleScanQRCode = useCallback(() => {
        openQRScanner()
    }, [openQRScanner])

    const handleQRScannerSuccess = useCallback(
        (url: string) => {
            handleCloseQRScanner()

            const parsedDeeplink = parseDeeplink(url)

            if (parsedDeeplink?.type === DeeplinkType.RECOVER_ADDRESS) {
                updateWord(parsedDeeplink.mnemonic, 0)
                return
            }

            errorToast(
                t('onboarding.import_account.invalid_mnemonic_title'),
                t('onboarding.import_account.invalid_mnemonic_body'),
            )
        },
        [handleCloseQRScanner, parseDeeplink, errorToast, t, updateWord],
    )

    const handleLearnMore = useCallback(() => {
        void Linking.openURL(config.recoveryPassphraseSupportUrl)
    }, [])

    const handleOpenSupportOptions = useCallback(async () => {
        const result =
            await requestBottomSheet<ImportAccountSupportOptionsContentResult>({
                contents: <ImportAccountSupportOptionsContent />,
                options: {
                    size: 'auto',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
        if (!result) return
        if (result === 'paste') {
            await handlePastePassphrase()
        } else if (result === 'scan') {
            handleScanQRCode()
        } else if (result === 'learn-more') {
            handleLearnMore()
        }
    }, [
        requestBottomSheet,
        handlePastePassphrase,
        handleScanQRCode,
        handleLearnMore,
    ])

    return {
        words,
        focused,
        setFocused,
        canImport,
        invalidWordIndices,
        processing,
        updateWord,
        handleWordChange: (word: string, index: number) =>
            void handleWordChange(word, index),
        handleImportAccount,
        mnemonicLength,
        titleKey,
        infoNoteKey,
        t,
        handleOpenSupportOptions: () => void handleOpenSupportOptions(),
        isQRScannerVisible,
        handleCloseQRScanner,
        handleQRScannerSuccess,
        suggestions,
        handleSelectSuggestion,
        refCallbacks,
        handleSubmitEditing,
    }
}
