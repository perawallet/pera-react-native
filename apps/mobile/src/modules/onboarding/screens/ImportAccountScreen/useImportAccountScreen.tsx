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

import React, { useState, useCallback, useMemo } from 'react'
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
import { config } from '@perawallet/wallet-core-config'

import type { UseImportAccountScreenResult } from './types'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { deferToNextCycle, logger } from '@perawallet/wallet-core-shared'
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
    const { showToast } = useToast()
    const { t } = useLanguage()
    const { parseDeeplink } = useDeepLink()
    const { request: requestBottomSheet } = useBottomSheet()

    const mnemonicLength = MNEMONIC_WORD_COUNT[accountType]

    const onTooManyWords = useCallback(() => {
        showToast({
            title: t('onboarding.import_account.invalid_mnemonic_title'),
            body: t('onboarding.import_account.invalid_mnemonic_body'),
            type: 'error',
        })
    }, [showToast, t])

    const onInsufficientSlots = useCallback(() => {
        showToast({
            title: t('onboarding.import_account.insufficient_slots_title'),
            body: t('onboarding.import_account.insufficient_slots_body'),
            type: 'error',
        })
    }, [showToast, t])

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

    const canImport = useMemo(() => words.every(w => w.length > 0), [words])

    const handleImportAccount = useCallback(() => {
        setProcessing(true)
        deferToNextCycle(async () => {
            const mnemonic = words.join(' ')

            try {
                const result = await importAccount({
                    mnemonic,
                    type: accountType,
                })

                // `replace` (not `push`) so this screen unmounts and the typed
                // mnemonic held in the input hook is dropped for GC. Strings
                // can't be zeroed in JS, but the reference goes away — and
                // back-navigating from later steps no longer lands on a
                // stale Import screen with prefilled words.
                if (result.type === 'hdWallet' && 'walletKeyId' in result) {
                    // HD import: jump into the discovery flow. Backup is marked
                    // only after the user commits a selection (see
                    // ImportSelectAddressesScreen).
                    navigation.replace('SearchAccounts', {
                        mode: 'import',
                        walletKeyId: result.walletKeyId,
                        derivationType: result.derivationType,
                    })
                } else {
                    // algo25 import: the account already exists. Mark backup and
                    // route through the existing post-create discovery.
                    markBackupComplete(result as WalletAccount)
                    navigation.replace('SearchAccounts', {
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
        handleOpenSupportOptions,
        isQRScannerVisible,
        handleCloseQRScanner,
        handleQRScannerSuccess,
        suggestions,
        handleSelectSuggestion,
        refCallbacks,
        handleSubmitEditing,
    }
}
