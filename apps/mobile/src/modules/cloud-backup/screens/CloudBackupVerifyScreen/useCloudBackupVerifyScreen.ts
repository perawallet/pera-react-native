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

import { useCallback, useMemo, useState } from 'react'
import * as Haptics from 'expo-haptics'
import { useCloudBackupDraftStore } from '@perawallet/wallet-core-backup'
import {
    MNEMONIC_WORDLIST,
    mnemonicIndexToWord,
    pickDistinctIndexes,
    type MnemonicWordAtPosition,
} from '@perawallet/wallet-core-kms'
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useBackupQuiz, type BackupQuizQuestion } from '@modules/backup'
import { useBackRemovalGuard } from '@hooks/useBackRemovalGuard'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useRegisterCloudBackup } from '../../hooks/useRegisterCloudBackup'

const VERIFICATION_WORD_COUNT = 3

/** Positions are picked first and a word resolved for only those — the rest of
 *  the phrase never leaves the index buffer. */
const buildVerificationPairs = (
    mnemonicIndices: Uint16Array,
): MnemonicWordAtPosition[] =>
    pickDistinctIndexes(VERIFICATION_WORD_COUNT, mnemonicIndices.length).map(
        index => ({
            index,
            word: mnemonicIndexToWord(mnemonicIndices[index]),
        }),
    )

type VerificationPairs = {
    correctPairs: MnemonicWordAtPosition[]
    /** Re-samples which positions the quiz asks about. */
    reroll: () => void
}

const useVerificationPairs = (): VerificationPairs => {
    const mnemonicIndices = useCloudBackupDraftStore(
        state => state.mnemonicIndices,
    )
    const [round, setRound] = useState(0)

    const correctPairs = useMemo(
        () =>
            mnemonicIndices && mnemonicIndices.length > 0
                ? buildVerificationPairs(mnemonicIndices)
                : [],
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `round` is the re-roll trigger
        [mnemonicIndices, round],
    )

    return {
        correctPairs,
        reroll: useCallback(() => setRound(value => value + 1), []),
    }
}

const useWrongAnswerFeedback = (): (() => void) => {
    const { t } = useLanguage()
    const { showToast } = useToast()

    return useCallback(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        showToast({
            title: t('cloud_backup.verify.error_message'),
            body: '',
            type: 'error',
        })
    }, [showToast, t])
}

type UseCloudBackupVerifyScreenResult = {
    items: BackupQuizQuestion[]
    onSelect: (questionIndex: number, word: string) => void
    onSubmit: () => void
    isFilled: boolean
    isRegistering: boolean
}

export const useCloudBackupVerifyScreen =
    (): UseCloudBackupVerifyScreenResult => {
        const { registerBackup, isRegistering } = useRegisterCloudBackup()
        const { correctPairs, reroll } = useVerificationPairs()
        const showWrongAnswerFeedback = useWrongAnswerFeedback()

        // Leaving mid-registration strands it: the mutation completes after the
        // unmount, but the `replace` it navigates with is dropped once this
        // route has left the stack.
        useBackRemovalGuard({ isBlocking: isRegistering })

        const onWrong = useCallback(() => {
            reroll()
            showWrongAnswerFeedback()
        }, [reroll, showWrongAnswerFeedback])

        const { items, onSelect, onSubmit, isFilled } = useBackupQuiz(
            correctPairs,
            MNEMONIC_WORDLIST,
            registerBackup,
            onWrong,
        )

        const handleSubmit = useCallback(() => {
            trackEvent(CloudBackupEvent.VerifyProceed)
            onSubmit()
        }, [onSubmit])

        return {
            items,
            onSelect,
            onSubmit: handleSubmit,
            isFilled,
            isRegistering,
        }
    }
