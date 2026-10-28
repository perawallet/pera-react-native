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

import type { ReactNode } from 'react'
import { PWLoadingIndicator, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { UseSiteSafetyGateResult } from '../../hooks/useSiteSafetyGate'
import { LookAlikeSiteWarning } from '../LookAlikeSiteWarning'
import { SiteBlockedView } from '../SiteBlockedView'
import { useStyles } from './styles'

export type SiteSafetyGateProps = {
    gate: UseSiteSafetyGateResult
    onReject: () => void
    children: ReactNode
}

/** Shows the approval only once the site's check has settled and any warning was passed. */
export const SiteSafetyGate = ({
    gate,
    onReject,
    children,
}: SiteSafetyGateProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { verdict } = gate

    if (gate.isChecking) {
        return (
            <PWView
                style={styles.checking}
                testID='site_safety_checking'
            >
                <PWLoadingIndicator />
                <PWText style={styles.checkingLabel}>
                    {t('site_safety.checking')}
                </PWText>
            </PWView>
        )
    }

    if (gate.isBlockedViewShown && verdict.kind === 'blocked') {
        return (
            <SiteBlockedView
                host={verdict.host}
                reason={verdict.reason}
                isContinueAnywayRevealed={gate.isContinueAnywayRevealed}
                isRiskAcknowledged={gate.isRiskAcknowledged}
                onReject={onReject}
                onRevealContinueAnyway={gate.handleRevealContinueAnyway}
                onToggleRiskAcknowledged={gate.handleToggleRiskAcknowledged}
                onContinueAnyway={gate.handleContinueAnyway}
            />
        )
    }

    if (gate.isLookAlikeWarningShown && verdict.kind === 'look-alike') {
        return (
            <LookAlikeSiteWarning
                host={verdict.host}
                imitates={verdict.imitates}
                onReject={onReject}
                onContinue={gate.handleAcknowledgeLookAlike}
            />
        )
    }

    return <>{children}</>
}
