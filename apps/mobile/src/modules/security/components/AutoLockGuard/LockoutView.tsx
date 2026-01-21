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

import { PWView, PWText, PWIcon, PWButton } from '@components/core'
import { useStyles } from './LockoutView.style'
import { useLanguage } from '@hooks/useLanguage'
import { formatTime } from '@perawallet/wallet-core-shared'

type LockoutViewProps = {
    remainingSeconds: number
    onResetData?: () => void
}

export const LockoutView = ({
    remainingSeconds,
    onResetData,
}: LockoutViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.lockoutContainer}>
            <PWView style={styles.lockoutContent}>
                <PWView style={styles.lockoutIconContainer}>
                    <PWIcon
                        name='locked'
                        size='lg'
                        variant='white'
                    />
                </PWView>
                <PWText
                    variant='h3'
                    style={styles.lockoutTitle}
                >
                    {t('security.lockout.title')}
                </PWText>
                <PWText
                    variant='body'
                    style={[styles.lockoutSubtitle, styles.divider]}
                >
                    {t('security.lockout.subtitle')}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.lockoutSubtitle}
                >
                    {t('security.lockout.tryagain_in')}
                </PWText>
                <PWText variant='h1'>
                    {formatTime(remainingSeconds)}
                </PWText>
            </PWView>

            {onResetData && (
                <PWView style={styles.lockoutActions}>
                    <PWButton
                        variant='secondary'
                        title={t('security.lockout.reset_button')}
                        onPress={onResetData}
                    />
                </PWView>
            )}
        </PWView>
    )
}
