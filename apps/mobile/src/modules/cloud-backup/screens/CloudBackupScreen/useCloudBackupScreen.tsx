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
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useRestoreBackupOptions } from '../../hooks/useRestoreBackupOptions'
import type { CloudBackupStackParamList } from '../../routes/types'

type UseCloudBackupScreenResult = {
    handleSetUpBackup: () => void
    handleRestoreBackup: () => Promise<void>
    isReadingCredentials: boolean
}

export const useCloudBackupScreen = (): UseCloudBackupScreenResult => {
    const navigation =
        useNavigation<NativeStackNavigationProp<CloudBackupStackParamList>>()
    const { chooseRestoreRoute, isReadingCredentials } =
        useRestoreBackupOptions()

    const handleSetUpBackup = useCallback(() => {
        trackEvent(CloudBackupEvent.SetUpNew)
        navigation.navigate('CloudBackupSetup')
    }, [navigation])

    const handleRestoreBackup = useCallback(async () => {
        trackEvent(CloudBackupEvent.Restore)
        const route = await chooseRestoreRoute()
        if (route) navigation.navigate(...route)
    }, [chooseRestoreRoute, navigation])

    return { handleSetUpBackup, handleRestoreBackup, isReadingCredentials }
}
