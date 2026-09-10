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
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useCloudBackupDraftStore } from '@perawallet/wallet-core-backup'
import {
    MNEMONIC_WORDLIST,
    mnemonicIndexToWord,
    pickDistinctIndexes,
    type MnemonicWordAtPosition,
} from '@perawallet/wallet-core-kms'
import { useBackupQuiz, type BackupQuizQuestion } from '@modules/backup'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import {
    EncryptionKeyConfirmSheet,
    type EncryptionKeyConfirmResult,
} from '../../components/EncryptionKeyConfirmSheet'
import { useEnableCloudBackup } from '../../hooks'
import type { CloudBackupStackParamList } from '../../routes/types'

const VERIFICATION_WORD_COUNT = 3

const CONFIRM_SHEET_OPTIONS = {
    size: 'auto',
    enablePanDownToClose: true,
} as const

type EnableBackup = ReturnType<typeof useEnableCloudBackup>['enableBackup']

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

/**
 * Takes `enableBackup` rather than calling `useEnableCloudBackup` itself: a
 * second call would spin up a second mutation, leaving the screen's
 * `isEnabling` bound to an instance nothing ever runs.
 */
const useEncryptionKeyConfirmation = (
    enableBackup: EnableBackup,
): (() => void) => {
    const { request: requestBottomSheet } = useBottomSheet()
    const navigation =
        useNavigation<NativeStackNavigationProp<CloudBackupStackParamList>>()

    const confirmEncryptionKey = useCallback(async () => {
        const result = await requestBottomSheet<EncryptionKeyConfirmResult>({
            contents: <EncryptionKeyConfirmSheet />,
            options: CONFIRM_SHEET_OPTIONS,
        })

        if (result === 'show-credentials') {
            navigation.popTo('CloudBackupSetup')
        } else if (result === 'enable') {
            enableBackup()
        }
    }, [requestBottomSheet, navigation, enableBackup])

    // `useBackupQuiz` types its callback `() => void`.
    return useCallback(
        () => void confirmEncryptionKey(),
        [confirmEncryptionKey],
    )
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
    isEnabling: boolean
}

export const useCloudBackupVerifyScreen =
    (): UseCloudBackupVerifyScreenResult => {
        const { enableBackup, isEnabling } = useEnableCloudBackup()
        const { correctPairs, reroll } = useVerificationPairs()
        const onSuccess = useEncryptionKeyConfirmation(enableBackup)
        const showWrongAnswerFeedback = useWrongAnswerFeedback()

        const onWrong = useCallback(() => {
            reroll()
            showWrongAnswerFeedback()
        }, [reroll, showWrongAnswerFeedback])

        const { items, onSelect, onSubmit, isFilled } = useBackupQuiz(
            correctPairs,
            MNEMONIC_WORDLIST,
            onSuccess,
            onWrong,
        )

        return { items, onSelect, onSubmit, isFilled, isEnabling }
    }
