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

import { View } from 'react-native'
import { PWText, PWIcon, PWButton } from '@components/core'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

type LockoutViewProps = {
    remainingSeconds: number
    onResetData?: () => void
}

const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export const LockoutView = ({
    remainingSeconds,
    onResetData,
}: LockoutViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <View style={styles.lockoutContainer}>
            <View style={styles.lockoutContent}>
                <View style={styles.lockoutIconContainer}>
                    <PWIcon
                        name='shield-check'
                        size='xl'
                        variant='error'
                    />
                </View>
                <PWText
                    variant='h3'
                    style={styles.lockoutTitle}
                >
                    {t('security.lockout.title')}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.lockoutSubtitle}
                >
                    {t('security.lockout.subtitle')}
                </PWText>
                <View style={styles.countdownContainer}>
                    <PWText
                        variant='h1'
                        style={styles.countdownText}
                    >
                        {formatTime(remainingSeconds)}
                    </PWText>
                </View>
            </View>

            {onResetData && (
                <View style={styles.lockoutActions}>
                    <PWButton
                        variant='destructive'
                        title={t('security.lockout.reset_button')}
                        onPress={onResetData}
                    />
                </View>
            )}
        </View>
    )
}
