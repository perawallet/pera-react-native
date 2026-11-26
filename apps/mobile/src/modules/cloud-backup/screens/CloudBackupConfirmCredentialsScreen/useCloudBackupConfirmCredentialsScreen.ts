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

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    BackupMnemonicParseError,
    matchesBackupEncryptionKey,
    normalizeBackupEncryptionKey,
    useCloudBackupStore,
    withBackupMnemonicIndices,
} from '@perawallet/wallet-core-backup'
import {
    MNEMONIC_WORDLIST,
    type MnemonicWordAtPosition,
} from '@perawallet/wallet-core-kms'
import { logger, toError, type Nullable } from '@perawallet/wallet-core-shared'
import { useBackupQuiz, type BackupQuizQuestion } from '@modules/backup'
import { useHaptics } from '@hooks/useHaptics'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { usePinGatedScreen } from '@modules/security'
import type { PassphraseStatus } from '../../components/BackupCredentialsSheet'
import type { CloudBackupStackParamList } from '../../routes/types'
import { pickVerificationPairs } from '../../utils/verificationPairs'

const NO_PAIRS: MnemonicWordAtPosition[] = []

type UseCloudBackupConfirmCredentialsScreenResult = {
    items: BackupQuizQuestion[]
    onSelect: (questionIndex: number, word: string) => void
    encryptionKey: string
    handleKeyChange: (value: string) => void
    passphraseStatus: PassphraseStatus
    canConfirm: boolean
    handleConfirm: () => void
    wordsError: Nullable<string>
    keyError: Nullable<string>
    confirmHint: Nullable<string>
}

type StoredPairs = {
    correctPairs: MnemonicWordAtPosition[]
    passphraseStatus: PassphraseStatus
    /** Re-samples which positions the quiz asks about. */
    reroll: () => void
}

const useStoredPairs = (isPinGateResolved: boolean): StoredPairs => {
    const [round, setRound] = useState(0)
    const [correctPairs, setCorrectPairs] = useState(NO_PAIRS)
    const [passphraseStatus, setPassphraseStatus] =
        useState<PassphraseStatus>('loading')

    useEffect(() => {
        if (!isPinGateResolved) return
        let cancelled = false
        withBackupMnemonicIndices(indices => {
            const pairs = pickVerificationPairs(indices)
            if (!cancelled) setCorrectPairs(pairs)
        })
            .then(loaded => {
                if (cancelled) return
                setPassphraseStatus(loaded === null ? 'unavailable' : 'ready')
            })
            .catch(error => {
                logger.error(
                    'CloudBackupConfirmCredentials: failed to load mnemonic',
                    {
                        error: toError(error).message,
                        isParseError: error instanceof BackupMnemonicParseError,
                    },
                )
                if (!cancelled) setPassphraseStatus('unreadable')
            })
        return () => {
            cancelled = true
        }
    }, [isPinGateResolved, round])

    return {
        correctPairs,
        passphraseStatus,
        // Back to loading so the quiz is hidden while the keystore is re-read:
        // until the new positions land, useBackupQuiz still shows the old ones
        // and would wipe any answer tapped there.
        reroll: useCallback(() => {
            setPassphraseStatus('loading')
            setRound(value => value + 1)
        }, []),
    }
}

const getConfirmHint = (
    passphraseStatus: PassphraseStatus,
    isFilled: boolean,
    encryptionKey: string,
    t: ReturnType<typeof useLanguage>['t'],
): Nullable<string> => {
    if (passphraseStatus !== 'ready') return null
    if (!isFilled) return t('cloud_backup.confirm_credentials.hint_words')
    if (encryptionKey.length === 0) {
        return t('cloud_backup.confirm_credentials.hint_key')
    }
    return null
}

export const useCloudBackupConfirmCredentialsScreen =
    (): UseCloudBackupConfirmCredentialsScreenResult => {
        const { t } = useLanguage()
        const navigation =
            useNavigation<
                NativeStackNavigationProp<
                    CloudBackupStackParamList,
                    'CloudBackupConfirmCredentials'
                >
            >()
        const { successToast } = useToast()
        const haptics = useHaptics()
        const salt = useCloudBackupStore(state => state.salt)
        const confirmCredentials = useCloudBackupStore(
            state => state.confirmCredentials,
        )
        // Without the gate, repeated wrong answers re-sample positions and
        // distractors, which would let anyone holding an unlocked phone piece
        // the phrase together.
        const isPinGateResolved = usePinGatedScreen()
        const { correctPairs, passphraseStatus, reroll } =
            useStoredPairs(isPinGateResolved)
        const [encryptionKey, setEncryptionKey] = useState('')
        const [areWordsWrong, setAreWordsWrong] = useState(false)
        const [isKeyWrong, setIsKeyWrong] = useState(false)
        const hasConfirmedRef = useRef(false)

        const isKeyCorrect = matchesBackupEncryptionKey(encryptionKey, salt)

        const onWordsCorrect = useCallback(() => {
            if (!isKeyCorrect) {
                haptics.error()
                setIsKeyWrong(true)
                return
            }
            // Confirm stays tappable while the screen pops; a second tap must not toast or pop again.
            if (hasConfirmedRef.current) {
                return
            }
            hasConfirmedRef.current = true
            confirmCredentials()
            successToast(t('cloud_backup.confirm_credentials.success'), '')
            navigation.goBack()
        }, [
            isKeyCorrect,
            haptics,
            confirmCredentials,
            successToast,
            t,
            navigation,
        ])

        const onWordsWrong = useCallback(() => {
            reroll()
            haptics.error()
            setAreWordsWrong(true)
            setIsKeyWrong(!isKeyCorrect)
        }, [reroll, haptics, isKeyCorrect])

        const {
            items,
            onSelect: onQuizSelect,
            onSubmit,
            isFilled,
        } = useBackupQuiz(
            correctPairs,
            MNEMONIC_WORDLIST,
            onWordsCorrect,
            onWordsWrong,
        )

        const handleKeyChange = useCallback((value: string) => {
            setEncryptionKey(normalizeBackupEncryptionKey(value))
            setIsKeyWrong(false)
        }, [])

        const onSelect = useCallback(
            (questionIndex: number, word: string) => {
                setAreWordsWrong(false)
                onQuizSelect(questionIndex, word)
            },
            [onQuizSelect],
        )

        const confirmHint = getConfirmHint(
            passphraseStatus,
            isFilled,
            encryptionKey,
            t,
        )

        return {
            items,
            onSelect,
            encryptionKey,
            handleKeyChange,
            passphraseStatus,
            canConfirm:
                passphraseStatus === 'ready' &&
                isFilled &&
                encryptionKey.length > 0,
            handleConfirm: onSubmit,
            wordsError: areWordsWrong
                ? t('cloud_backup.confirm_credentials.error_words')
                : null,
            keyError: isKeyWrong
                ? t('cloud_backup.confirm_credentials.error_key')
                : null,
            confirmHint,
        }
    }
