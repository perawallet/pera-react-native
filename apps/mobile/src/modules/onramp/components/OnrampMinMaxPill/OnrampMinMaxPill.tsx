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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type OnrampMinMaxPillProps = {
    onMin: () => void
    onMax: () => void
}

// Floating pill that straddles the top-right edge of the receive card; it sets
// the pay amount to the provider min/max from the form's `limits`.
export const OnrampMinMaxPill = ({ onMin, onMax }: OnrampMinMaxPillProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.container}>
            <PWTouchableOpacity
                style={styles.segment}
                onPress={onMin}
                testID='onramp-min-button'
            >
                <PWText
                    variant='captionMedium'
                    style={styles.label}
                >
                    {t('onramp.form.min')}
                </PWText>
            </PWTouchableOpacity>

            <PWView style={styles.divider} />

            <PWTouchableOpacity
                style={styles.segment}
                onPress={onMax}
                testID='onramp-max-button'
            >
                <PWText
                    variant='captionMedium'
                    style={styles.label}
                >
                    {t('onramp.form.max')}
                </PWText>
            </PWTouchableOpacity>
        </PWView>
    )
}
