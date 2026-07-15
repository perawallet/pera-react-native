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

import { memo, useEffect, useState } from 'react'
import Animated, {
    withTiming,
    type EntryAnimationsValues,
} from 'react-native-reanimated'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    BACKUP_REMINDER_BANNER_REVEAL_DELAY,
    BACKUP_REMINDER_BANNER_REVEAL_DURATION,
} from '@constants/ui'
import { useBackupReminderBanner } from './useBackupReminderBanner'
import { useStyles } from './styles'

// Entering animation: grow height from 0 to natural while fading in. Uses the
// `targetHeight` reanimated provides so the banner ends at its real height
// without us hardcoding it.
const expandAndFadeEntering = (values: EntryAnimationsValues) => {
    'worklet'
    return {
        initialValues: {
            opacity: 0,
            height: 0,
        },
        animations: {
            opacity: withTiming(1, {
                duration: BACKUP_REMINDER_BANNER_REVEAL_DURATION,
            }),
            height: withTiming(values.targetHeight, {
                duration: BACKUP_REMINDER_BANNER_REVEAL_DURATION,
            }),
        },
    }
}

type BackupReminderBannerProps = {
    account: WalletAccount
    isLoading?: boolean
}

const BackupReminderBannerComponent = ({
    account,
    isLoading = false,
}: BackupReminderBannerProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { isVisible, onPress } = useBackupReminderBanner(account)
    // The reveal-delay timer starts only after the parent finishes its initial
    // load, so the banner animates in as a second beat instead of riding the
    // skeleton-to-content swap.
    const [hasDelayed, setHasDelayed] = useState(false)

    useEffect(() => {
        if (isLoading || hasDelayed) return
        const timer = setTimeout(
            () => setHasDelayed(true),
            BACKUP_REMINDER_BANNER_REVEAL_DELAY,
        )
        return () => clearTimeout(timer)
    }, [isLoading, hasDelayed])

    if (!isVisible || !hasDelayed) return null

    return (
        <Animated.View
            entering={expandAndFadeEntering}
            style={styles.enterWrapper}
        >
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
                    <PWText style={styles.ctaText}>
                        {t('backup.banner.cta')}
                    </PWText>
                </PWTouchableOpacity>
            </PWView>
        </Animated.View>
    )
}

// Memoized: this banner lives in the asset-list header and re-renders on every
// parent render. Skipping when inputs are stable saves a Zustand selector +
// TanStack subscription pass per render.
export const BackupReminderBanner = memo(
    BackupReminderBannerComponent,
    (prev, next) =>
        prev.account === next.account && prev.isLoading === next.isLoading,
)
