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
    generateCloudBackupCredentials,
    useCloudBackupDraftStore,
    type CloudBackupCredentials,
} from '@perawallet/wallet-core-backup'
import { mnemonicIndexToWord, zeroBytes } from '@perawallet/wallet-core-kms'
import { useClipboard } from '@hooks/useClipboard'
import type { CloudBackupStackParamList } from '../../routes'

type UseCloudBackupSetupScreenResult = {
    mnemonicIndices: Uint16Array
    saltB64: string
    handleCopyPassphrase: () => void
    handleCopyEncryptionKey: () => void
    handleProceed: () => void
}

export const useCloudBackupSetupScreen =
    (): UseCloudBackupSetupScreenResult => {
        const { copyToClipboard } = useClipboard()
        const navigation =
            useNavigation<
                NativeStackNavigationProp<CloudBackupStackParamList>
            >()
        const setDraft = useCloudBackupDraftStore(state => state.setDraft)
        const clearDraft = useCloudBackupDraftStore(state => state.clearDraft)

        const [credentials] = useState<CloudBackupCredentials>(
            generateCloudBackupCredentials,
        )

        // Wipe the generated recovery credentials from memory when the user
        // leaves the setup flow. This screen stays mounted across Setup →
        // Verify, so it only unmounts on flow exit (back out or success), never
        // on the intermediate step. The success path also clears the draft in
        // useEnableCloudBackup; clearing here too is idempotent.
        useEffect(
            () => () => {
                zeroBytes(credentials.mnemonicIndices)
                clearDraft()
            },
            [credentials, clearDraft],
        )

        const handleCopyPassphrase = useCallback(() => {
            // The words exist only for the length of this call; the retained
            // form stays the zeroable index buffer.
            void copyToClipboard(
                Array.from(credentials.mnemonicIndices, index =>
                    mnemonicIndexToWord(index),
                ).join(' '),
            )
        }, [copyToClipboard, credentials.mnemonicIndices])

        const handleCopyEncryptionKey = useCallback(() => {
            void copyToClipboard(credentials.salt)
        }, [copyToClipboard, credentials.salt])

        const handleProceed = useCallback(() => {
            setDraft({
                mnemonicIndices: credentials.mnemonicIndices,
                salt: credentials.salt,
            })
            navigation.navigate('CloudBackupVerify')
        }, [setDraft, credentials, navigation])

        return {
            mnemonicIndices: credentials.mnemonicIndices,
            saltB64: credentials.salt,
            handleCopyPassphrase,
            handleCopyEncryptionKey,
            handleProceed,
        }
    }
