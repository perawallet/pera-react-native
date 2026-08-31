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

import { useCallback, useMemo } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { useCloudBackupRestoreDraftStore } from '@perawallet/wallet-core-backup'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { PWInputRef } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useMnemonicWordEntry } from '@modules/onboarding/hooks'
import type { CloudBackupStackParamList } from '../../routes'

const CLOUD_BACKUP_MNEMONIC_LENGTH = 12

type UseCloudBackupRestorePassphraseScreenResult = {
    words: string[]
    mnemonicLength: number
    canContinue: boolean
    focused: number
    suggestions: string[]
    refCallbacks: ((ref: Nullable<PWInputRef>) => void)[]
    handleWordChange: (value: string, index: number) => void
    handleFocus: (index: number) => void
    handleSubmitEditing: (index: number) => void
    handleSelectSuggestion: (word: string) => void
    handleContinue: () => void
    t: ReturnType<typeof useLanguage>['t']
}

export const useCloudBackupRestorePassphraseScreen =
    (): UseCloudBackupRestorePassphraseScreenResult => {
        const navigation =
            useNavigation<
                NativeStackNavigationProp<CloudBackupStackParamList>
            >()
        const { t } = useLanguage()
        const { errorToast } = useToast()
        const setMnemonic = useCloudBackupRestoreDraftStore(
            state => state.setMnemonic,
        )

        // The entered recovery phrase is scrubbed from the draft store when the
        // RestoreEncryptionKey screen unmounts (it is the terminal consumer of
        // the mnemonic). Scrubbing here on this screen's unmount would wipe the
        // mnemonic the moment the user navigates forward, since native-stack may
        // unmount this screen behind the next one.

        const onTooManyWords = useCallback(() => {
            errorToast(
                t('cloud_backup.restore.too_many_words_title'),
                t('cloud_backup.restore.too_many_words_body'),
            )
        }, [errorToast, t])

        const onInsufficientSlots = useCallback(() => {
            errorToast(
                t('cloud_backup.restore.insufficient_slots_title'),
                t('cloud_backup.restore.insufficient_slots_body'),
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
            wordCount: CLOUD_BACKUP_MNEMONIC_LENGTH,
            onTooManyWords,
            onInsufficientSlots,
        })

        const canContinue = useMemo(
            () => words.every(word => word.length > 0),
            [words],
        )

        const handleContinue = useCallback(() => {
            if (!canContinue) return
            setMnemonic(words)
            navigation.navigate('CloudBackupRestoreEncryptionKey')
        }, [canContinue, setMnemonic, words, navigation])

        return {
            words,
            mnemonicLength: CLOUD_BACKUP_MNEMONIC_LENGTH,
            canContinue,
            focused,
            suggestions,
            refCallbacks,
            handleWordChange: (value: string, index: number) =>
                void handleWordChange(value, index),
            handleFocus: setFocused,
            handleSubmitEditing,
            handleSelectSuggestion,
            handleContinue,
            t,
        }
    }
