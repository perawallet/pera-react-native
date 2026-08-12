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
import Animated from 'react-native-reanimated'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useBannerReveal } from '@modules/banners'
import { useLanguage } from '@hooks/useLanguage'
import {
    BACKUP_REMINDER_BANNER_REVEAL_DELAY,
    BACKUP_REMINDER_BANNER_REVEAL_DURATION,
} from '@constants/ui'
import { useBackupReminderBanner } from './useBackupReminderBanner'
import { useStyles } from './styles'

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
    // Measure-then-animate rather than a reanimated `entering={...}` layout
    // animation. Layout animations drive their own mount transactions from the
    // UI thread, which on Android Fabric can interleave with the JS thread's
    // and drop an insert — the shadow tree then disagrees with the real
    // ViewGroup and the next insert crashes (`addViewAt: failed to insert
    // view`, PERA-4863). This banner sat right in that window: migrated
    // accounts aren't backed up, so it revealed on the account-details screen
    // while migration still had the UI thread busy.
    // `hasDelayed` below already serves the pre-reveal beat, so the animation
    // itself starts immediately.
    const { animatedStyle, isMeasured, onMeasureLayout } = useBannerReveal({
        delayMs: 0,
        durationMs: BACKUP_REMINDER_BANNER_REVEAL_DURATION,
    })
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

    const content = (
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

    return (
        <>
            {/* Off-screen pass to learn the natural height the reveal animates
                to. Mutually exclusive with the real content below, so the
                testIDs never appear twice. */}
            {!isMeasured && (
                <PWView
                    style={styles.measurer}
                    onLayout={onMeasureLayout}
                    pointerEvents='none'
                    aria-hidden
                >
                    {content}
                </PWView>
            )}
            <Animated.View style={[styles.enterWrapper, animatedStyle]}>
                {isMeasured && content}
            </Animated.View>
        </>
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
