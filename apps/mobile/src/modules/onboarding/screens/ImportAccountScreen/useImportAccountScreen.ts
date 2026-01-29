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

import { useState, useCallback, useMemo, useEffect } from 'react'
import { Keyboard, Platform, Linking } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'

import { RouteProp, useRoute } from '@react-navigation/native'
import { OnboardingStackParamList } from '../../routes/types'
import {
    useImportAccount,
    ImportAccountType,
} from '@perawallet/wallet-core-accounts'
import { RECOVERY_PASSPHRASE_SUPPORT_URL } from '@perawallet/wallet-core-config'

import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'
import { useModalState } from '@hooks/useModalState'
import { useDeepLink } from '@hooks/useDeepLink'
import { DeeplinkType } from '@hooks/deeplink/types'

const MNEMONIC_LENGTH_MAP: Record<ImportAccountType, number> = {
    hdWallet: 24,
    algo25: 25,
}


export type UseImportAccountScreenResult = {
    words: string[]
    focused: number
    setFocused: (index: number) => void
    canImport: boolean
    processing: boolean
    updateWord: (word: string, index: number) => void
    handleImportAccount: () => void
    mnemonicLength: number
    t: (key: string) => string
    isKeyboardVisible: boolean
    keyboardHeight: number
    isSupportOptionsVisible: boolean
    handleOpenSupportOptions: () => void
    handleCloseSupportOptions: () => void
    handlePastePassphrase: () => void
    handleScanQRCode: () => void
    handleLearnMore: () => void
    isQRScannerVisible: boolean
    handleCloseQRScanner: () => void
    handleQRScannerSuccess: (url: string) => void
}

export function useImportAccountScreen(): UseImportAccountScreenResult {
    const {
        params: { accountType },
    } = useRoute<RouteProp<OnboardingStackParamList, 'ImportAccount'>>()
    const navigation = useAppNavigation()
    const importAccount = useImportAccount()
    const { showToast } = useToast()
    const { t } = useLanguage()
    const { parseDeeplink } = useDeepLink()

    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
    const [keyboardHeight, setKeyboardHeight] = useState(0)

    useEffect(() => {
        const showEvent =
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
        const hideEvent =
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

        const showSubscription = Keyboard.addListener(showEvent, e => {
            setIsKeyboardVisible(true)
            setKeyboardHeight(e.endCoordinates.height)
        })
        const hideSubscription = Keyboard.addListener(hideEvent, () => {
            setIsKeyboardVisible(false)
            setKeyboardHeight(0)
        })

        return () => {
            showSubscription.remove()
            hideSubscription.remove()
        }
    }, [])

    const mnemonicLength = MNEMONIC_LENGTH_MAP[accountType]

    const [words, setWords] = useState<string[]>(
        new Array(mnemonicLength).fill(''),
    )
    const [focused, setFocused] = useState(0)
    const [processing, setProcessing] = useState(false)
    const {
        isOpen: isSupportOptionsVisible,
        open: openSupportOptions,
        close: handleCloseSupportOptions,
    } = useModalState()
    const {
        isOpen: isQRScannerVisible,
        open: openQRScanner,
        close: handleCloseQRScanner,
    } = useModalState()

    const canImport = useMemo(() => words.every(w => w.length > 0), [words])

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

    const handleImportAccount = useCallback(() => {
        setProcessing(true)
        deferToNextCycle(async () => {
            const mnemonic = words.join(' ')

            try {
                const importedAccount = await importAccount({
                    mnemonic,
                    type: accountType,
                })
                navigation.push('SearchAccounts', {
                    account: importedAccount,
                })
            } catch {
                showToast({
                    title: t('onboarding.import_account.failed_title'),
                    body: t('onboarding.import_account.failed_body'),
                    type: 'error',
                })
            } finally {
                setProcessing(false)
            }
        })
    }, [importAccount, words, accountType, navigation, showToast, t])

    const handleOpenSupportOptions = useCallback(() => {
        openSupportOptions()
    }, [openSupportOptions])

    const handlePastePassphrase = useCallback(async () => {
        const content = await Clipboard.getString()

        if (content) {
            updateWord(content, 0)
        }
        handleCloseSupportOptions()
    }, [updateWord, handleCloseSupportOptions])

    const handleScanQRCode = useCallback(() => {
        openQRScanner()
        handleCloseSupportOptions()
    }, [openQRScanner, handleCloseSupportOptions])

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
        Linking.openURL(RECOVERY_PASSPHRASE_SUPPORT_URL)
        handleCloseSupportOptions()
    }, [handleCloseSupportOptions])

    return {
        words,
        focused,
        setFocused,
        canImport,
        processing,
        updateWord,
        handleImportAccount,
        mnemonicLength,
        t,
        isKeyboardVisible,
        keyboardHeight,
        isSupportOptionsVisible,
        handleOpenSupportOptions,
        handleCloseSupportOptions,
        handlePastePassphrase,
        handleScanQRCode,
        handleLearnMore,
        isQRScannerVisible,
        handleCloseQRScanner,
        handleQRScannerSuccess,
    }
}
