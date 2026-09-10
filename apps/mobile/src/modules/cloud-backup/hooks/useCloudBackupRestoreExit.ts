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
import type { CloudBackupStackParamList } from '../routes/types'

type UseCloudBackupRestoreExitResult = {
    exitToOverview: () => void
}

/**
 * Terminal navigation for a restore that ran inside the cloud-backup stack.
 * Only valid there — `CloudBackupOverview` is not registered in the import
 * flow, which reaches the same screens and exits via `useExitAccountFlow`.
 */
export const useCloudBackupRestoreExit =
    (): UseCloudBackupRestoreExitResult => {
        const navigation =
            useNavigation<
                NativeStackNavigationProp<CloudBackupStackParamList>
            >()

        const exitToOverview = useCallback(
            () =>
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'CloudBackupOverview' }],
                }),
            [navigation],
        )

        return { exitToOverview }
    }
