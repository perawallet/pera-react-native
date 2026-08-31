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

import { useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    useBackupSyncStateStore,
    useCloudBackupStore,
} from '@perawallet/wallet-core-backup'
import type { CloudBackupStackParamList } from '../routes'

type UseCloudBackupTeardownResult = {
    resetLocalState: () => void
    goHome: () => void
}

/** Shared by turn-off and turn-off-and-remove: both clear the same local state
 *  and land the user back on the un-configured home screen. */
export const useCloudBackupTeardown = (): UseCloudBackupTeardownResult => {
    const navigation =
        useNavigation<NativeStackNavigationProp<CloudBackupStackParamList>>()
    const resetCloudBackup = useCloudBackupStore(state => state.resetState)
    const resetSyncState = useBackupSyncStateStore(state => state.resetState)

    const resetLocalState = useCallback(() => {
        resetCloudBackup()
        resetSyncState()
    }, [resetCloudBackup, resetSyncState])

    const goHome = useCallback(
        () =>
            navigation.reset({
                index: 0,
                routes: [{ name: 'CloudBackupHome' }],
            }),
        [navigation],
    )

    return { resetLocalState, goHome }
}
