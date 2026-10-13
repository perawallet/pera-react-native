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

import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { PasswordScore } from '../../hooks/usePasswordStrength.web'
import { useStyles } from './styles'

type PasswordStrengthMeterProps = {
    score: PasswordScore
}

type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong'

const SEGMENT_COUNT = 4

const LEVEL_BY_SCORE: Record<PasswordScore, StrengthLevel> = {
    0: 'weak',
    1: 'weak',
    2: 'fair',
    3: 'good',
    4: 'strong',
}

// Literal keys so the i18n lint's static usage scan can see them.
const LABEL_KEYS: Record<StrengthLevel, string> = {
    weak: 'vault.password_strength.weak',
    fair: 'vault.password_strength.fair',
    good: 'vault.password_strength.good',
    strong: 'vault.password_strength.strong',
}

export const PasswordStrengthMeter = ({
    score,
}: PasswordStrengthMeterProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const level = LEVEL_BY_SCORE[score]
    const label = t(LABEL_KEYS[level])
    // Score 0 still lights one segment so a non-empty password never shows an empty bar.
    const filledCount = Math.max(score, 1)

    return (
        <PWView
            style={styles.container}
            testID='password-strength-meter'
            accessibilityRole='progressbar'
            accessibilityValue={{
                min: 0,
                max: SEGMENT_COUNT,
                now: score,
                text: label,
            }}
        >
            <PWView style={styles.track}>
                {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
                    <PWView
                        key={index}
                        style={[
                            styles.segment,
                            index < filledCount && styles[level],
                        ]}
                    />
                ))}
            </PWView>
            <PWText
                variant='footnoteMedium'
                style={styles[`${level}Text`]}
                testID='password-strength-label'
            >
                {label}
            </PWText>
        </PWView>
    )
}
