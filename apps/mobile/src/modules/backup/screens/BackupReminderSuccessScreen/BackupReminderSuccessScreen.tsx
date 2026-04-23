/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { useTheme } from '@rneui/themed'
import ShieldCheckImage from '@assets/icons/shield-check.svg'
import { PWInfoView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ILLUSTRATION_SIZE } from '../../constants'
import type { BackupStackParamList } from '../../routes/types'

export const BackupReminderSuccessScreen = () => {
    const { theme } = useTheme()
    const { t } = useLanguage()
    const navigation =
        useNavigation<
            NativeStackNavigationProp<BackupStackParamList, 'BackupSuccess'>
        >()

    const onDone = useCallback(() => {
        const parent = navigation.getParent()
        if (parent) {
            parent.goBack()
            return
        }
        navigation.popToTop()
    }, [navigation])

    return (
        <PWInfoView
            illustration={
                <ShieldCheckImage
                    width={ILLUSTRATION_SIZE}
                    height={ILLUSTRATION_SIZE}
                    color={theme.colors.linkPrimary}
                />
            }
            title={t('backup.success.title')}
            body={t('backup.success.body')}
            primaryAction={{
                label: t('backup.success.cta_done'),
                onPress: onDone,
                testID: 'backup_success_done',
            }}
        />
    )
}
