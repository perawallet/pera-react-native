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
import { Keyboard, Platform } from 'react-native'
import { RouteProp, useRoute } from '@react-navigation/native'
import { OnboardingStackParamList } from '../../routes/types'
import {
    useImportAccount,
    ImportAccountType,
} from '@perawallet/wallet-core-accounts'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'

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
}

export function useImportAccountScreen(): UseImportAccountScreenResult {
    const {
        params: { accountType },
    } = useRoute<RouteProp<OnboardingStackParamList, 'ImportAccount'>>()
    const navigation = useAppNavigation()
    const importAccount = useImportAccount()
    const { showToast } = useToast()
    const { t } = useLanguage()

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

    const canImport = useMemo(() => words.every(w => w.length > 0), [words])

    const updateWord = useCallback(
        (word: string, index: number) => {
            const splitWords = word.split('\n')

            if (splitWords.length === mnemonicLength) {
                setWords(splitWords)
            } else {
                setWords(prev => {
                    const next = [...prev]
                    next[index] = word.trim()
                    return next
                })
            }
        },
        [mnemonicLength],
    )

    const goToHome = useCallback(() => {
        navigation.replace('TabBar', {
            screen: 'Home',
        })
    }, [navigation])

    const handleImportAccount = useCallback(() => {
        setProcessing(true)
        setTimeout(async () => {
            try {
                await importAccount({
                    mnemonic: words.join(' '),
                    type: accountType,
                })
                goToHome()
            } catch {
                showToast({
                    title: t('onboarding.import_account.failed_title'),
                    body: t('onboarding.import_account.failed_body'),
                    type: 'error',
                })
            } finally {
                setProcessing(false)
            }
        }, 0)
    }, [importAccount, words, goToHome, showToast, t])

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
    }
}
