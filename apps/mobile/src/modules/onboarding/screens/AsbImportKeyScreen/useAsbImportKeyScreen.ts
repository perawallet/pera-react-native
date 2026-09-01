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

import { useCallback, useEffect, useState } from 'react'
import {
    ASB_RECOVERY_MNEMONIC_WORD_COUNT,
    AsbErrorReason,
    AsbImportError,
    decryptBackupPayload,
} from '@perawallet/wallet-core-backup'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import {
    useAsbImportFlowStore,
    useMnemonicWordEntry,
} from '@modules/onboarding/hooks'

import type { PWInputRef } from '@components/core'

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
        areAllWordsValid,
        getMnemonicIndices,
    } = useMnemonicWordEntry({
        wordCount: ASB_RECOVERY_MNEMONIC_WORD_COUNT,
        onTooManyWords,
        onInsufficientSlots,
    })

    const canContinue = areAllWordsValid && !isProcessing

    const handleContinue = useCallback(async () => {
        if (!envelope || isProcessing) return

        setIsProcessing(true)
        let mnemonicIndices: Uint16Array | null = null
        try {
            // Zeroable indices straight from the slot state — no word array
            // is assembled. `canContinue` gates on every word being a
            // wordlist word, so null only means an out-of-band invocation —
            // same user copy as a bad key.
            mnemonicIndices = getMnemonicIndices()
            if (!mnemonicIndices) {
                throw new AsbImportError(AsbErrorReason.InvalidRecoveryKey)
            }
            // The crypto stack is synchronous but `setIsProcessing` triggers a
            // re-render before the heavy work runs; without an await/microtask
            // boundary the loading indicator never paints.
            await Promise.resolve()
            const payload = decryptBackupPayload(envelope, mnemonicIndices)
            setPayload(payload)
            // `replace` (not `push`) so the Key screen unmounts on success: the
            // input hook wipes the typed words on unmount, and back-navigating
            // from SelectAccounts / Result won't land on a stale prefilled Key
            // screen.
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
            // Don't wipe the words here: on error we keep them so the user can
            // fix a typo and retry; on success the unmount wipe handles it.
            zeroBytes(mnemonicIndices)
            setIsProcessing(false)
        }
    }, [
        envelope,
        isProcessing,
        getMnemonicIndices,
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
