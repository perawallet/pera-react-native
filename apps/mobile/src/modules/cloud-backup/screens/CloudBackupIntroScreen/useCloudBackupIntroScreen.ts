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
import { useCloudBackupIntroduction } from '../../hooks/useCloudBackupIntroduction'
import type { CloudBackupStackParamList } from '../../routes/types'

type UseCloudBackupIntroScreenResult = {
    handleContinue: () => void
}

export const useCloudBackupIntroScreen =
    (): UseCloudBackupIntroScreenResult => {
        const navigation =
            useNavigation<
                NativeStackNavigationProp<CloudBackupStackParamList>
            >()
        const { markIntroductionSeen } = useCloudBackupIntroduction()

        // `replace`, not `navigate`: a one-time gate must not sit behind the screen
        // it opens.
        const handleContinue = useCallback(() => {
            trackEvent(CloudBackupEvent.IntroContinue)
            markIntroductionSeen()
            navigation.replace('CloudBackupHome')
        }, [navigation, markIntroductionSeen])

        return { handleContinue }
    }
