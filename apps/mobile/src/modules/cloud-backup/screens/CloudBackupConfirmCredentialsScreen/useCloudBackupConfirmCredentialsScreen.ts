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
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    BackupMnemonicParseError,
    useCloudBackupStore,
    withBackupMnemonicIndices,
} from '@perawallet/wallet-core-backup'
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import {
    MNEMONIC_WORDLIST,
    type MnemonicWordAtPosition,
} from '@perawallet/wallet-core-kms'
import { logger, toError } from '@perawallet/wallet-core-shared'
import { useBackupQuiz, type BackupQuizQuestion } from '@modules/backup'
import { useHaptics } from '@hooks/useHaptics'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useRequirePinVerification } from '@modules/security'
import type { PassphraseStatus } from '../../components/BackupCredentialsSheet'
import type { CloudBackupStackParamList } from '../../routes/types'
import { pickVerificationPairs } from '../../utils/verificationPairs'

type WrongCredentialsPart = 'words' | 'key' | 'both'

const WRONG_CREDENTIALS_MESSAGE = {
    words: i18nKey('cloud_backup.confirm_credentials.error_words'),
    key: i18nKey('cloud_backup.confirm_credentials.error_key'),
    both: i18nKey('cloud_backup.confirm_credentials.error_both'),
} satisfies Record<WrongCredentialsPart, I18nKey>

const NO_PAIRS: MnemonicWordAtPosition[] = []

type UseCloudBackupConfirmCredentialsScreenResult = {
    items: BackupQuizQuestion[]
    onSelect: (questionIndex: number, word: string) => void
    encryptionKey: string
    handleKeyChange: (value: string) => void
    passphraseStatus: PassphraseStatus
    canConfirm: boolean
    handleConfirm: () => void
}

// Without the gate, repeated wrong answers re-sample positions and distractors,
// which would let anyone holding an unlocked phone piece the phrase together.
const usePinGate = (): boolean => {
    const navigation =
        useNavigation<
            NativeStackNavigationProp<
                CloudBackupStackParamList,
                'CloudBackupConfirmCredentials'
            >
        >()
    const { requirePinVerification } = useRequirePinVerification()
    const [isPinGateResolved, setIsPinGateResolved] = useState(false)

    useEffect(() => {
        let cancelled = false
        void requirePinVerification().then(isVerified => {
            if (cancelled) return
            if (isVerified) {
                setIsPinGateResolved(true)
            } else {
                navigation.goBack()
            }
        })
        return () => {
            cancelled = true
        }
    }, [requirePinVerification, navigation])

    return isPinGateResolved
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
        reroll: useCallback(() => setRound(value => value + 1), []),
    }
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
        const { errorToast, successToast } = useToast()
        const haptics = useHaptics()
        const salt = useCloudBackupStore(state => state.salt)
        const confirmCredentials = useCloudBackupStore(
            state => state.confirmCredentials,
        )
        const isPinGateResolved = usePinGate()
        const { correctPairs, passphraseStatus, reroll } =
            useStoredPairs(isPinGateResolved)
        const [encryptionKey, setEncryptionKey] = useState('')

        const isKeyCorrect = salt != null && encryptionKey === salt

        const showWrong = useCallback(
            (part: WrongCredentialsPart) => {
                haptics.error()
                errorToast(t(WRONG_CREDENTIALS_MESSAGE[part]), '')
            },
            [errorToast, haptics, t],
        )

        const onWordsCorrect = useCallback(() => {
            if (!isKeyCorrect) {
                showWrong('key')
                return
            }
            confirmCredentials()
            successToast(t('cloud_backup.confirm_credentials.success'), '')
            navigation.goBack()
        }, [
            isKeyCorrect,
            showWrong,
            confirmCredentials,
            successToast,
            t,
            navigation,
        ])

        const onWordsWrong = useCallback(() => {
            reroll()
            showWrong(isKeyCorrect ? 'words' : 'both')
        }, [reroll, showWrong, isKeyCorrect])

        const { items, onSelect, onSubmit, isFilled } = useBackupQuiz(
            correctPairs,
            MNEMONIC_WORDLIST,
            onWordsCorrect,
            onWordsWrong,
        )

        const handleKeyChange = useCallback(
            (value: string) => setEncryptionKey(value.trim()),
            [],
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
        }
    }
