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

import { useCallback, useMemo, useState } from 'react'
import {
    ASB_RECOVERY_MNEMONIC_WORD_COUNT,
    AsbErrorReason,
    AsbImportError,
    decryptBackupPayload,
} from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'
import { MNEMONIC_WORDLIST } from '@perawallet/wallet-core-kms'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useAsbImportFlowStore } from '@modules/onboarding/hooks'

type UseAsbImportKeyScreenResult = {
    words: string[]
    focused: number
    canContinue: boolean
    isProcessing: boolean
    suggestions: string[]
    wordCount: number
    setFocused: (index: number) => void
    handleWordChange: (value: string, index: number) => void
    handleSelectSuggestion: (suggestion: string) => void
    handleContinue: () => Promise<void>
}

const WORDLIST_SET = new Set(MNEMONIC_WORDLIST)
const MAX_SUGGESTIONS = 4

export const useAsbImportKeyScreen = (): UseAsbImportKeyScreenResult => {
    const navigation = useAppNavigation()
    const { t } = useLanguage()
    const { errorToast } = useToast()
    const envelope = useAsbImportFlowStore(state => state.envelope)
    const setPayload = useAsbImportFlowStore(state => state.setPayload)

    const [words, setWords] = useState<string[]>(
        new Array(ASB_RECOVERY_MNEMONIC_WORD_COUNT).fill(''),
    )
    const [focused, setFocused] = useState(0)
    const [isProcessing, setIsProcessing] = useState(false)

    const trimmedWords = useMemo(
        () => words.map(w => w.trim().toLowerCase()),
        [words],
    )

    const canContinue = useMemo(
        () =>
            trimmedWords.every(w => w.length > 0 && WORDLIST_SET.has(w)) &&
            !isProcessing,
        [trimmedWords, isProcessing],
    )

    const suggestions = useMemo(() => {
        const current = trimmedWords[focused]
        if (!current || current.length < 2) return []
        return MNEMONIC_WORDLIST.filter(w => w.startsWith(current)).slice(
            0,
            MAX_SUGGESTIONS,
        )
    }, [trimmedWords, focused])

    const handleWordChange = useCallback((value: string, index: number) => {
        setWords(prev => {
            const next = [...prev]
            next[index] = value
            return next
        })
    }, [])

    const handleSelectSuggestion = useCallback(
        (suggestion: string) => {
            setWords(prev => {
                const next = [...prev]
                next[focused] = suggestion
                return next
            })
            if (focused < ASB_RECOVERY_MNEMONIC_WORD_COUNT - 1) {
                setFocused(focused + 1)
            }
        },
        [focused],
    )

    const handleContinue = useCallback(async () => {
        if (!envelope || isProcessing) return

        setIsProcessing(true)
        try {
            const mnemonic = trimmedWords.join(' ')
            // The crypto stack is synchronous but `setIsProcessing` triggers a
            // re-render before the heavy work runs; without an await/microtask
            // boundary the loading indicator never paints.
            await Promise.resolve()
            const payload = decryptBackupPayload(envelope, mnemonic)
            setPayload(payload)
            navigation.push('AsbImportSelectAccounts')
        } catch (e) {
            const reason =
                e instanceof AsbImportError
                    ? e.reason
                    : AsbErrorReason.DecryptionFailed
            if (!(e instanceof AsbImportError)) {
                logger.error('Unexpected ASB decryption error', { error: e })
            }
            errorToast(
                t('onboarding.asb_import.key.errors.title'),
                t(`onboarding.asb_import.key.errors.${reason}` as const),
            )
        } finally {
            setIsProcessing(false)
        }
    }, [
        envelope,
        isProcessing,
        trimmedWords,
        setPayload,
        navigation,
        errorToast,
        t,
    ])

    return {
        words,
        focused,
        canContinue,
        isProcessing,
        suggestions,
        wordCount: ASB_RECOVERY_MNEMONIC_WORD_COUNT,
        setFocused,
        handleWordChange,
        handleSelectSuggestion,
        handleContinue,
    }
}
