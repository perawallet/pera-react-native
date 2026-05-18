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

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    ASB_RECOVERY_MNEMONIC_WORD_COUNT,
    AsbErrorReason,
    AsbImportError,
    decryptBackupPayload,
} from '@perawallet/wallet-core-backup'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { MNEMONIC_WORDLIST } from '@perawallet/wallet-core-kms'
import type { PWInputRef } from '@components/core'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import {
    useAsbImportFlowStore,
    useMnemonicWordEntry,
} from '@modules/onboarding/hooks'

type UseAsbImportKeyScreenResult = {
    words: string[]
    focused: number
    canContinue: boolean
    isProcessing: boolean
    suggestions: string[]
    wordCount: number
    setFocused: (index: number) => void
    handleWordChange: (value: string, index: number) => Promise<void>
    handleSelectSuggestion: (suggestion: string) => void
    handleContinue: () => Promise<void>
    refCallbacks: ((ref: Nullable<PWInputRef>) => void)[]
    handleSubmitEditing: (index: number) => void
}

const WORDLIST_SET = new Set(MNEMONIC_WORDLIST)

export const useAsbImportKeyScreen = (): UseAsbImportKeyScreenResult => {
    const navigation = useAppNavigation()
    const { t } = useLanguage()
    const { errorToast } = useToast()
    const envelope = useAsbImportFlowStore(state => state.envelope)
    const setPayload = useAsbImportFlowStore(state => state.setPayload)

    const [isProcessing, setIsProcessing] = useState(false)

    // The flow store is wiped after a successful import (and on backgrounding,
    // for the decrypted payload). If the user navigates back into this screen
    // afterwards — Android system back from the Result screen, for example —
    // there's no envelope to decrypt against, so the screen is non-functional.
    // Redirect them back to the file-pick step instead of leaving Continue
    // silently no-op'ing.
    useEffect(() => {
        if (!envelope) {
            navigation.replace('AsbImportBackup')
        }
    }, [envelope, navigation])

    const onTooManyWords = useCallback(() => {
        errorToast(
            t('onboarding.asb_import.key.too_many_words_title'),
            t('onboarding.asb_import.key.too_many_words_body'),
        )
    }, [errorToast, t])

    const onInsufficientSlots = useCallback(() => {
        errorToast(
            t('onboarding.asb_import.key.insufficient_slots_title'),
            t('onboarding.asb_import.key.insufficient_slots_body'),
        )
    }, [errorToast, t])

    const {
        words,
        focused,
        suggestions,
        setFocused,
        handleWordChange,
        handleSelectSuggestion,
        refCallbacks,
        handleSubmitEditing,
    } = useMnemonicWordEntry({
        wordCount: ASB_RECOVERY_MNEMONIC_WORD_COUNT,
        onTooManyWords,
        onInsufficientSlots,
    })

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
            // `replace` (not `push`) so the Key screen unmounts and the
            // typed recovery mnemonic stored in the input hook is dropped
            // for GC. Strings can't be zeroed in JS, but the reference goes
            // away. Bonus: back-navigating from SelectAccounts / Result no
            // longer lands on a stale Key screen with prefilled words.
            navigation.replace('AsbImportSelectAccounts')
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
        refCallbacks,
        handleSubmitEditing,
    }
}
