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

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Linking } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { RouteProp, useRoute } from '@react-navigation/native'
import { OnboardingStackParamList } from '../../routes/types'
import {
    DuplicateAccountError,
    MNEMONIC_WORD_COUNT,
    useImportAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'
import { MNEMONIC_WORDLIST as WORDLIST } from '@perawallet/wallet-core-kms'
import { config } from '@perawallet/wallet-core-config'

import type { PWInputRef } from '@components/core'
import type { UseImportAccountScreenResult } from './types'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import {
    deferToNextCycle,
    logger,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useModalState } from '@hooks/useModalState'
import { useKeyboardHeight } from '@hooks/useKeyboardHeight'
import { useDeepLink } from '@hooks/useDeepLink'
import { DeeplinkType } from '@hooks/deeplink/types'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    ImportAccountSupportOptionsContent,
    type ImportAccountSupportOptionsContentResult,
} from './ImportAccountSupportOptionsContent'

const MAX_SUGGESTIONS = 4

export function useImportAccountScreen(): UseImportAccountScreenResult {
    const {
        params: { accountType },
    } = useRoute<RouteProp<OnboardingStackParamList, 'ImportAccount'>>()
    const navigation = useAppNavigation()
    const importAccount = useImportAccount()
    const markBackupComplete = useMarkMnemonicBackupComplete()
    const { showToast } = useToast()
    const { t } = useLanguage()
    const { parseDeeplink } = useDeepLink()
    const { request: requestBottomSheet } = useBottomSheet()

    const { isKeyboardVisible, keyboardHeight } = useKeyboardHeight()

    const mnemonicLength = MNEMONIC_WORD_COUNT[accountType]

    const [words, setWords] = useState<string[]>(
        new Array(mnemonicLength).fill(''),
    )
    const wordsRef = useRef(words)
    wordsRef.current = words
    const [focused, setFocused] = useState(0)
    const [processing, setProcessing] = useState(false)
    const {
        isOpen: isQRScannerVisible,
        open: openQRScanner,
        close: handleCloseQRScanner,
    } = useModalState()

    const inputRefs = useRef<Nullable<PWInputRef>[]>(
        new Array(mnemonicLength).fill(null),
    )

    const refCallbacks = useMemo(
        () =>
            Array.from(
                { length: mnemonicLength },
                (_, i) => (ref: Nullable<PWInputRef>) => {
                    inputRefs.current[i] = ref
                },
            ),
        [mnemonicLength],
    )

    const focusInput = useCallback((index: number) => {
        inputRefs.current[index]?.focus()
    }, [])

    useEffect(() => {
        focusInput(focused)
    }, [focused, focusInput])

    const canImport = useMemo(() => words.every(w => w.length > 0), [words])

    const suggestions = useMemo(() => {
        const currentWord = words[focused]?.toLowerCase() ?? ''

        if (currentWord.length === 0) {
            return []
        }

        const matches: string[] = []

        for (const word of WORDLIST) {
            if (word.startsWith(currentWord)) {
                matches.push(word)

                if (matches.length >= MAX_SUGGESTIONS) {
                    break
                }
            }
        }

        // If the only match is an exact match, no suggestions needed
        if (matches.length === 1 && matches[0] === currentWord) {
            return []
        }

        return matches
    }, [words, focused])

    const handleSelectSuggestion = useCallback(
        (word: string) => {
            setWords(prev => {
                const next = [...prev]

                next[focused] = word
                return next
            })

            const nextIndex = focused + 1

            if (nextIndex < mnemonicLength) {
                setFocused(nextIndex)
            }
        },
        [focused, mnemonicLength],
    )

    const updateWord = useCallback(
        (word: string, index: number) => {
            const trimmedValue = word.trim()
            const splitWords = trimmedValue.split(/\s+/).filter(Boolean)

            if (splitWords.length > 1) {
                // Case: Pasted content is a full mnemonic of the expected length
                if (splitWords.length === mnemonicLength) {
                    setWords(splitWords)
                    return
                }

                // Case: Pasted content is larger than the total expected mnemonic length
                if (splitWords.length > mnemonicLength) {
                    showToast({
                        title: t(
                            'onboarding.import_account.invalid_mnemonic_title',
                        ),
                        body: t(
                            'onboarding.import_account.invalid_mnemonic_body',
                        ),
                        type: 'error',
                    })
                    return
                }

                // Case: Pasted content is smaller than the total expected length
                const remainingSlots = mnemonicLength - index

                if (splitWords.length <= remainingSlots) {
                    setWords(prev => {
                        const next = [...prev]

                        splitWords.forEach((w, i) => {
                            next[index + i] = w
                        })
                        return next
                    })
                } else {
                    showToast({
                        title: t(
                            'onboarding.import_account.insufficient_slots_title',
                        ),
                        body: t(
                            'onboarding.import_account.insufficient_slots_body',
                        ),
                        type: 'error',
                    })
                }
                return
            }

            setWords(prev => {
                const next = [...prev]

                next[index] = word.trim()
                return next
            })
        },
        [mnemonicLength, showToast, t],
    )

    const handleWordChange = useCallback(
        async (text: string, index: number) => {
            const currentWord = wordsRef.current[index] ?? ''

            if (text.length - currentWord.length > 1) {
                try {
                    const clipboardContent = await Clipboard.getStringAsync()

                    if (clipboardContent) {
                        const clipboardWords = clipboardContent
                            .trim()
                            .split(/\s+/)
                            .filter(Boolean)
                        const receivedWords = text
                            .trim()
                            .split(/\s+/)
                            .filter(Boolean)

                        if (clipboardWords.length > receivedWords.length) {
                            updateWord(clipboardContent, index)
                            return
                        }
                    }
                } catch {
                    // Clipboard read failed; fall through
                }
            }

            updateWord(text, index)
        },
        [updateWord],
    )

    const handleImportAccount = useCallback(() => {
        setProcessing(true)
        deferToNextCycle(async () => {
            const mnemonic = words.join(' ')

            try {
                const result = await importAccount({
                    mnemonic,
                    type: accountType,
                })

                if (result.type === 'hdWallet' && 'walletKeyId' in result) {
                    // HD import: jump into the discovery flow. Backup is marked
                    // only after the user commits a selection (see
                    // ImportSelectAddressesScreen).
                    navigation.push('SearchAccounts', {
                        mode: 'import',
                        walletKeyId: result.walletKeyId,
                        derivationType: result.derivationType,
                    })
                } else {
                    // algo25 import: the account already exists. Mark backup and
                    // route through the existing post-create discovery.
                    markBackupComplete(result as WalletAccount)
                    navigation.push('SearchAccounts', {
                        account: result as WalletAccount,
                    })
                }
            } catch (e) {
                logger.error('Import account failed', { error: e })
                // Duplicate-account attempts get a tailored toast so the
                // user understands the import was a no-op rather than a
                // generic failure.
                const isDuplicate = e instanceof DuplicateAccountError
                // guardrails-ignore-next-line no-error-toast-in-catch reason: localized import_account.{failed,duplicate_account}_body preserved; raw error not surfaced to user
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
                setProcessing(false)
            }
        })
    }, [
        importAccount,
        markBackupComplete,
        words,
        accountType,
        navigation,
        showToast,
        t,
    ])

    const handlePastePassphrase = useCallback(async () => {
        const content = await Clipboard.getStringAsync()

        if (content) {
            updateWord(content, 0)
        }
    }, [updateWord])

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

            showToast({
                title: t('onboarding.import_account.invalid_mnemonic_title'),
                body: t('onboarding.import_account.invalid_mnemonic_body'),
                type: 'error',
            })
        },
        [handleCloseQRScanner, parseDeeplink, showToast, t, updateWord],
    )

    const handleLearnMore = useCallback(() => {
        Linking.openURL(config.recoveryPassphraseSupportUrl)
    }, [])

    const handleOpenSupportOptions = useCallback(async () => {
        const result =
            await requestBottomSheet<ImportAccountSupportOptionsContentResult>({
                contents: <ImportAccountSupportOptionsContent />,
                options: { size: 'auto', enablePanDownToClose: true },
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
        processing,
        updateWord,
        handleWordChange,
        handleImportAccount,
        mnemonicLength,
        t,
        isKeyboardVisible,
        keyboardHeight,
        handleOpenSupportOptions,
        isQRScannerVisible,
        handleCloseQRScanner,
        handleQRScannerSuccess,
        suggestions,
        handleSelectSuggestion,
        refCallbacks,
    }
}
