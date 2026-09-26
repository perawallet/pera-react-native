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

import {
    PASSWORD_RULES,
    type PasswordRuleId,
} from '@perawallet/wallet-core-card'
import { PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type PasswordRequirementsProps = {
    /** The current password value; each rule is re-evaluated against it. */
    password: string
}

// Explicit literal keys (rather than `rule_${id}`) so the i18n lint's
// static usage scan can see them.
const RULE_LABEL_KEYS: Record<PasswordRuleId, string> = {
    length: 'peraCard.create_password.rule_length',
    uppercase: 'peraCard.create_password.rule_uppercase',
    lowercase: 'peraCard.create_password.rule_lowercase',
    number: 'peraCard.create_password.rule_number',
    special: 'peraCard.create_password.rule_special',
}

/**
 * Live checklist of the password rules. Each row turns green with a check the
 * moment its rule is satisfied. Rules come from `PASSWORD_RULES` so this stays
 * in lockstep with `passwordSetSchema`. Shared by the onboarding Create Password
 * screen and the forgot-password flow.
 */
export const PasswordRequirements = ({
    password,
}: PasswordRequirementsProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.requirements}>
            {PASSWORD_RULES.map(rule => {
                const isMet = rule.test(password)
                return (
                    <PWView
                        key={rule.id}
                        style={styles.requirementRow}
                        accessibilityState={{ checked: isMet }}
                        testID={`card-onboarding-password-rule-${rule.id}`}
                    >
                        <PWIcon
                            name='check'
                            size='sm'
                            variant={isMet ? 'positive' : 'secondary'}
                        />
                        <PWText
                            variant='footnoteMedium'
                            style={
                                isMet
                                    ? styles.requirementMet
                                    : styles.requirementText
                            }
                        >
                            {t(RULE_LABEL_KEYS[rule.id])}
                        </PWText>
                    </PWView>
                )
            })}

            {/* Advisory only, Baanx recommends it but it isn't enforced, so
                it's plain guidance rather than a checked requirement. */}
            <PWText
                variant='footnoteMedium'
                style={styles.hint}
                testID='card-onboarding-password-common-hint'
            >
                {t('peraCard.create_password.common_password_hint')}
            </PWText>
        </PWView>
    )
}
