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

import { useMutation } from '@tanstack/react-query'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { mnemonicIndexToWord } from '@perawallet/wallet-core-kms'
import {
    enableCloudBackup,
    useCloudBackupDraftStore,
    useCloudBackupStore,
} from '@perawallet/wallet-core-backup'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import type { CloudBackupStackParamList } from '../routes/types'

/** Words live only for the caller's turn; the retained form stays the zeroable
 *  index buffer in the draft store. */
const toMnemonicWords = (indices: Uint16Array): string[] =>
    Array.from(indices, index => mnemonicIndexToWord(index))

type UseEnableCloudBackupResult = {
    enableBackup: () => void
    isEnabling: boolean
}

export const useEnableCloudBackup = (): UseEnableCloudBackupResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const navigation =
        useNavigation<NativeStackNavigationProp<CloudBackupStackParamList>>()
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const mnemonicIndices = useCloudBackupDraftStore(
        state => state.mnemonicIndices,
    )
    const salt = useCloudBackupDraftStore(state => state.salt)
    const clearDraft = useCloudBackupDraftStore(state => state.clearDraft)
    const setConfigured = useCloudBackupStore(state => state.setConfigured)

    const mutation = useMutation({
        throwOnError: false,
        mutationFn: async () => {
            if (!mnemonicIndices || !salt) {
                throw new Error('Cloud backup draft credentials are missing')
            }
            if (!deviceId) {
                throw new Error('Device ID is unavailable')
            }
            const { backupId } = await enableCloudBackup({
                mnemonic: toMnemonicWords(mnemonicIndices),
                salt,
                deviceId,
                network,
            })
            // Pin the salt to this attempt: by the time onSuccess runs the
            // draft may have been cleared (screen unmount, store reset), and
            // the backup already exists server-side.
            return { backupId, salt }
        },
        onSuccess: ({ backupId, salt: registeredSalt }) => {
            setConfigured({ backupId, salt: registeredSalt })
            clearDraft()
            showToast({
                title: t('cloud_backup.enable.success'),
                body: '',
                type: 'success',
            })
            navigation.reset({
                index: 0,
                routes: [{ name: 'CloudBackupOverview' }],
            })
        },
        onError: () => {
            showToast({
                title: t('cloud_backup.enable.error'),
                body: '',
                type: 'error',
            })
        },
    })

    return { enableBackup: mutation.mutate, isEnabling: mutation.isPending }
}
