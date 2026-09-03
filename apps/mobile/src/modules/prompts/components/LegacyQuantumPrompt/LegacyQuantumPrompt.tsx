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
import { PWInfoView, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { UserPreferences } from '@constants/user-preferences'
import type { PromptViewProps } from '@modules/prompts/models'
import { useLegacyQuantumPrompt } from '@modules/prompts/hooks/useLegacyQuantumPrompt'
import { useStyles } from './styles'

/**
 * One-time nudge, shown when the wallet holds at least one legacy-derivation
 * quantum account. Dismissing it is permanent (routed through `onDismiss`,
 * which persists `UserPreferences._legacyQuantumNoticePrompt`); the
 * per-account `LegacyQuantumNotice` marker on the account detail screen keeps
 * the same explanation reachable afterward.
 */
export const LegacyQuantumPrompt = ({ onDismiss }: PromptViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { shouldUseDependentAwareCopy } = useLegacyQuantumPrompt()

    const handleDismiss = useCallback(() => {
        onDismiss(UserPreferences._legacyQuantumNoticePrompt)
    }, [onDismiss])

    const bodyKey = shouldUseDependentAwareCopy
        ? 'accounts.legacyQuantum.bodyWithDependents'
        : 'accounts.legacyQuantum.body'

    return (
        <PWView
            style={styles.container}
            testID='legacy_quantum_prompt'
        >
            <PWInfoView
                title={t('accounts.legacyQuantum.title')}
                body={t(bodyKey)}
                primaryAction={{
                    label: t('accounts.legacyQuantum.dismiss'),
                    onPress: handleDismiss,
                    testID: 'legacy_quantum_prompt_dismiss_button',
                }}
            />
        </PWView>
    )
}
