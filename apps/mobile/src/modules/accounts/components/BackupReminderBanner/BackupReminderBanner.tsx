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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useBackupReminderBanner } from './useBackupReminderBanner'
import { useStyles } from './styles'

type BackupReminderBannerProps = {
    account: WalletAccount
}

export const BackupReminderBanner = ({
    account,
}: BackupReminderBannerProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { isVisible, onPress } = useBackupReminderBanner(account)

    if (!isVisible) return null

    return (
        <PWView
            style={styles.container}
            testID='backup_reminder_banner'
        >
            <PWIcon
                name='info'
                variant='white'
                size='sm'
            />
            <PWText style={styles.text}>{t('backup.banner.text')}</PWText>
            <PWTouchableOpacity
                style={styles.ctaButton}
                onPress={onPress}
                testID='backup_reminder_banner_cta'
            >
                <PWText style={styles.ctaText}>{t('backup.banner.cta')}</PWText>
            </PWTouchableOpacity>
        </PWView>
    )
}
