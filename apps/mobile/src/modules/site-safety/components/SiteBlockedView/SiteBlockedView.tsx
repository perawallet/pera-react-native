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

import type { SiteSafetyVerdict } from '@perawallet/wallet-core-site-safety'
import {
    PWButton,
    PWCheckbox,
    PWRoundIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { getTestProps } from '@utils/test-id-helper'
import { useStyles } from './styles'

export type SiteBlockedViewProps = {
    host: string
    reason: Extract<SiteSafetyVerdict, { kind: 'blocked' }>['reason']
    isContinueAnywayRevealed: boolean
    isRiskAcknowledged: boolean
    onReject: () => void
    onRevealContinueAnyway: () => void
    onToggleRiskAcknowledged: () => void
    onContinueAnyway: () => void
}

// Continuing is two steps behind a small text action, so it is never the
// obvious way forward.
export const SiteBlockedView = ({
    host,
    reason,
    isContinueAnywayRevealed,
    isRiskAcknowledged,
    onReject,
    onRevealContinueAnyway,
    onToggleRiskAcknowledged,
    onContinueAnyway,
}: SiteBlockedViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView
            style={styles.container}
            testID='site_blocked_view'
        >
            <PWView style={styles.content}>
                <PWRoundIcon
                    icon='shield-warning'
                    size='xl'
                    variant='error'
                />
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {t('site_safety.blocked.title')}
                </PWText>
                <PWText style={styles.body}>
                    {reason === 'walletconnect-verify'
                        ? t('site_safety.blocked.body_verify')
                        : t('site_safety.blocked.body')}
                </PWText>
                {!!host && (
                    <PWText
                        variant='bodySemibold'
                        style={styles.host}
                        {...getTestProps('site_blocked_host')}
                    >
                        {host}
                    </PWText>
                )}
            </PWView>
            <PWView style={styles.actions}>
                <PWButton
                    title={t('site_safety.blocked.reject')}
                    variant='primary'
                    onPress={onReject}
                    {...getTestProps('site_blocked_reject')}
                />
                {isContinueAnywayRevealed ? (
                    <>
                        <PWTouchableOpacity
                            style={styles.acknowledge}
                            onPress={onToggleRiskAcknowledged}
                            {...getTestProps('site_blocked_acknowledge')}
                        >
                            <PWCheckbox
                                checked={isRiskAcknowledged}
                                onPress={onToggleRiskAcknowledged}
                            />
                            <PWText style={styles.acknowledgeLabel}>
                                {t('site_safety.blocked.acknowledge')}
                            </PWText>
                        </PWTouchableOpacity>
                        <PWButton
                            title={t('site_safety.blocked.continue')}
                            variant='destructive'
                            isDisabled={!isRiskAcknowledged}
                            onPress={onContinueAnyway}
                            {...getTestProps('site_blocked_continue')}
                        />
                    </>
                ) : (
                    <PWTouchableOpacity
                        style={styles.continueAnyway}
                        onPress={onRevealContinueAnyway}
                        {...getTestProps('site_blocked_continue_anyway')}
                    >
                        <PWText
                            variant='caption'
                            style={styles.continueAnywayLabel}
                        >
                            {t('site_safety.blocked.continue_anyway')}
                        </PWText>
                    </PWTouchableOpacity>
                )}
            </PWView>
        </PWView>
    )
}
