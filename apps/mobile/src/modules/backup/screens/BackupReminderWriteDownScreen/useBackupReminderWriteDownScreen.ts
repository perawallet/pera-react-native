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
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { trackEvent, OnboardingEvent } from '@analytics'
import { useIsCloudBackupAvailableFor } from '@hooks/useIsCloudBackupAvailable'
import { useLanguage } from '@hooks/useLanguage'
import { usePassphraseAccount, usePassphraseReach } from '../../hooks'
import type { BackupStackParamList } from '../../routes/types'

export type UseBackupReminderWriteDownScreenResult = {
    body: string
    warning: string
    onContinue: () => void
}

// PIN gating lives on BackupReminderMnemonicScreen itself so the mnemonic is
// never pulled into memory without a fresh PIN verification, regardless of how
// the screen is reached.
export const useBackupReminderWriteDownScreen =
    (): UseBackupReminderWriteDownScreenResult => {
        const navigation =
            useNavigation<
                NativeStackNavigationProp<
                    BackupStackParamList,
                    'BackupWriteDown'
                >
            >()
        const route =
            useRoute<RouteProp<BackupStackParamList, 'BackupWriteDown'>>()
        const address = route.params?.address
        const accountId = route.params?.accountId
        const { t } = useLanguage()
        const { isMultiNetwork } = usePassphraseReach({
            address: address ?? '',
            accountId,
        })
        const isCloudBackupAvailable = useIsCloudBackupAvailableFor(
            usePassphraseAccount(address ?? '', accountId),
        )

        let bodyKey = i18nKey('backup.write_down.body')
        if (isMultiNetwork) {
            bodyKey = isCloudBackupAvailable
                ? i18nKey(
                      'backup.write_down.body_all_networks_with_cloud_backup',
                  )
                : i18nKey('backup.write_down.body_all_networks')
        } else if (isCloudBackupAvailable) {
            bodyKey = i18nKey('backup.write_down.body_with_cloud_backup')
        }

        const onContinue = useCallback(() => {
            if (address) {
                trackEvent(OnboardingEvent.UnderstandPassphrase)
                navigation.navigate('BackupMnemonic', { address, accountId })
            }
        }, [navigation, address, accountId])

        return {
            body: t(bodyKey),
            warning: isMultiNetwork
                ? t('backup.write_down.warning_all_networks')
                : t('backup.write_down.warning'),
            onContinue,
        }
    }
