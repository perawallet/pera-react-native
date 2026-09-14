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
import { useTheme } from '@rneui/themed'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { trackEvent, CloudBackupEvent } from '@analytics'
import {
    PWButton,
    PWChip,
    PWImage,
    PWScrollView,
    PWText,
    PWView,
} from '@components/core'
import { NumberedList } from '@components/NumberedList'
import { UserPreferences } from '@constants/user-preferences'
import { useLanguage } from '@hooks/useLanguage'
import type { PromptViewProps } from '@modules/prompts/models'
import { useStyles } from './styles'

import cloudBackupIntroHeroDark from '@assets/images/cloud-backup-intro-hero-dark.png'
import cloudBackupIntroHeroLight from '@assets/images/cloud-backup-intro-hero-light.png'

const STEP_KEYS = [
    {
        title: 'prompts.cloud_backup_intro.encryption_title',
        description: 'prompts.cloud_backup_intro.encryption_description',
    },
    {
        title: 'prompts.cloud_backup_intro.sync_title',
        description: 'prompts.cloud_backup_intro.sync_description',
    },
    {
        title: 'prompts.cloud_backup_intro.recovery_title',
        description: 'prompts.cloud_backup_intro.recovery_description',
    },
] as const

export const CloudBackupIntroPrompt = ({ onDismiss }: PromptViewProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { theme } = useTheme()
    const { t } = useLanguage()
    const heroImage =
        theme.mode === 'dark'
            ? cloudBackupIntroHeroDark
            : cloudBackupIntroHeroLight

    const steps = STEP_KEYS.map(step => ({
        title: t(step.title),
        description: t(step.description),
    }))

    const handleContinue = useCallback(() => {
        trackEvent(CloudBackupEvent.IntroContinue)
        onDismiss(UserPreferences._cloudBackupIntroPrompt)
    }, [onDismiss])

    return (
        <PWView
            style={styles.root}
            testID='cloud_backup_intro_prompt'
        >
            <PWView style={styles.card}>
                <PWScrollView
                    style={styles.scrollArea}
                    contentContainerStyle={styles.content}
                    bounces={false}
                >
                    <PWImage
                        source={heroImage}
                        style={styles.hero}
                        resizeMode='contain'
                    />
                    <PWView style={styles.body}>
                        <PWView style={styles.header}>
                            <PWChip
                                variant='positive'
                                paddingStyle='dense'
                                title={t('prompts.cloud_backup_intro.badge')}
                                style={styles.badge}
                            />
                            <PWText
                                variant='h3'
                                style={styles.title}
                            >
                                {t('prompts.cloud_backup_intro.title')}
                            </PWText>
                            <PWText
                                variant='bodyLarge'
                                style={styles.description}
                            >
                                {t('prompts.cloud_backup_intro.description')}
                            </PWText>
                        </PWView>
                        <NumberedList
                            items={steps}
                            isDense
                            testID='cloud_backup_intro_steps'
                        />
                    </PWView>
                </PWScrollView>
                <PWView style={styles.footer}>
                    <PWButton
                        variant='primary'
                        title={t('prompts.cloud_backup_intro.continue')}
                        onPress={handleContinue}
                        testID='cloud_backup_intro_continue_button'
                    />
                </PWView>
            </PWView>
        </PWView>
    )
}
