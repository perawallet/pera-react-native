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
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { trackEvent, OnboardingEvent } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { usePassphraseReach } from '../../hooks'
import type { BackupStackParamList } from '../../routes/types'

export type UseBackupInfoScreenResult = {
    body: string
    onContinue: () => void
}

export const useBackupInfoScreen = (): UseBackupInfoScreenResult => {
    const navigation =
        useNavigation<
            NativeStackNavigationProp<BackupStackParamList, 'BackupInfo'>
        >()
    const route = useRoute<RouteProp<BackupStackParamList, 'BackupInfo'>>()
    const address = route.params?.address
    const { t } = useLanguage()
    const { isMultiNetwork, networkNames } = usePassphraseReach({
        address: address ?? '',
    })
    const body = isMultiNetwork
        ? t('backup.info.body_all_networks', {
              networks: networkNames.join(', '),
          })
        : t('backup.info.body')

    const onContinue = useCallback(() => {
        if (address) {
            trackEvent(OnboardingEvent.BeginPassphrase)
            navigation.navigate('BackupWriteDown', { address })
        }
    }, [navigation, address])

    return { body, onContinue }
}
