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

import { useCallback, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    usePrepareCloudBackupRestoreMutation,
    type RestoreCloudBackupVariables,
} from '@perawallet/wallet-core-backup'
import { useNavigationLock } from '@hooks/useNavigationLock'
import type { CloudBackupStackParamList } from '../routes/types'
import { useRestoreFailureToast } from './useRestoreOutcome'

type UsePrepareCloudBackupRestoreResult = {
    prepare: (variables: RestoreCloudBackupVariables) => void
    isRestoring: boolean
}

/** Unlocks and downloads the backup, then opens the account choice. */
export const usePrepareCloudBackupRestore =
    (): UsePrepareCloudBackupRestoreResult => {
        const navigation =
            useNavigation<
                NativeStackNavigationProp<CloudBackupStackParamList>
            >()
        const onError = useRestoreFailureToast()
        // Leaving mid-prepare would strand the keys it stores, with no account
        // choice mounted to discard them. Set on the call, not from the
        // mutation, so no render passes unlocked.
        const [isLocked, setIsLocked] = useState(false)
        useNavigationLock(isLocked)
        const { mutate, isPending } = usePrepareCloudBackupRestoreMutation({
            onSuccess: () =>
                navigation.navigate('CloudBackupRestoreSelectAccounts'),
            onError,
            onSettled: () => setIsLocked(false),
        })

        const prepare = useCallback(
            (variables: RestoreCloudBackupVariables) => {
                setIsLocked(true)
                mutate(variables)
            },
            [mutate],
        )

        return { prepare, isRestoring: isPending }
    }
