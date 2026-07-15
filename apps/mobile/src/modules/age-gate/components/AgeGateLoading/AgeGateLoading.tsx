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

import { ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@rneui/themed'

import { PWText, PWView } from '@components/core'
import { useStyles } from './styles'

// Shown while the platform age check (or self-declaration) is in flight. The
// native age sheet can take a few seconds to appear on iOS, so this stands in
// for the restricted fallback until a decision is reached. Uses ActivityIndicator
// directly rather than LoadingView so the spinner and label stay grouped and
// centered (LoadingView's circle variant fills its parent with flex: 1, which
// pushes the label to the bottom of the screen).
export const AgeGateLoading = () => {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const styles = useStyles()

    return (
        <PWView
            style={styles.container}
            testID='age-gate-loading'
        >
            <ActivityIndicator
                size='large'
                color={theme.colors.linkPrimary}
            />
            <PWText
                variant='body'
                style={styles.label}
            >
                {t('age_gate.loading.title')}
            </PWText>
        </PWView>
    )
}
