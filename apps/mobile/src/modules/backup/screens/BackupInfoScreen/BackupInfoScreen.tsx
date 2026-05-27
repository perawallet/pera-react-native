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

import ShieldCheckImage from '@assets/icons/shield-check.svg'
import { PWInfoView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useBackupInfoScreen } from './useBackupInfoScreen'

export const BackupInfoScreen = () => {
    const { t } = useLanguage()
    const { onContinue } = useBackupInfoScreen()

    return (
        <PWInfoView
            illustration={ShieldCheckImage}
            title={t('backup.info.title')}
            body={t('backup.info.body')}
            primaryAction={{
                label: t('backup.info.cta'),
                onPress: onContinue,
                testID: 'backup_info_continue',
            }}
        />
    )
}
