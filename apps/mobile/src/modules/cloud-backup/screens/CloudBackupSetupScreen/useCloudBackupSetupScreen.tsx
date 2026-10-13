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
import { zeroBytes } from '@perawallet/wallet-core-kms'
import { trackEvent, CloudBackupEvent } from '@analytics'
import type { CloudBackupStackParamList } from '../../routes/types'

type UseCloudBackupSetupScreenResult = {
    mnemonicIndices: Uint16Array
    saltB64: string
    isConfirmed: boolean
    toggleConfirmed: () => void
    handleProceed: () => void
}

export const useCloudBackupSetupScreen =
    (): UseCloudBackupSetupScreenResult => {
        const navigation =
            useNavigation<
                NativeStackNavigationProp<CloudBackupStackParamList>
            >()
        const setDraft = useCloudBackupDraftStore(state => state.setDraft)
        const clearDraft = useCloudBackupDraftStore(state => state.clearDraft)

        const [credentials] = useState<CloudBackupCredentials>(
            generateCloudBackupCredentials,
        )
        const [isConfirmed, setIsConfirmed] = useState(false)

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

        const toggleConfirmed = useCallback(() => {
            setIsConfirmed(value => !value)
        }, [])

        const handleProceed = useCallback(() => {
            trackEvent(CloudBackupEvent.SetupProceed)
            setDraft({
                mnemonicIndices: credentials.mnemonicIndices,
                salt: credentials.salt,
            })
            navigation.navigate('CloudBackupVerify')
        }, [setDraft, credentials, navigation])

        return {
            mnemonicIndices: credentials.mnemonicIndices,
            saltB64: credentials.salt,
            isConfirmed,
            toggleConfirmed,
            handleProceed,
        }
    }
