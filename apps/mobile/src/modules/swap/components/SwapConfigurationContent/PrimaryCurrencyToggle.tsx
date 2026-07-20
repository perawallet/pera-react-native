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

import { PWSwitch, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type PrimaryCurrencyToggleProps = {
    value: boolean
    onValueChange: (value: boolean) => void
    testID?: string
}

export const PrimaryCurrencyToggle = ({
    value,
    onValueChange,
    testID,
}: PrimaryCurrencyToggleProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.section}>
            <PWText
                variant='caption'
                style={styles.sectionTitle}
            >
                {t('swap.configuration.primary_currency')}
            </PWText>
            <PWView style={styles.currencyToggleRow}>
                <PWText
                    variant='body'
                    style={styles.currencyToggleLabel}
                >
                    {t('swap.configuration.use_local_currency')}
                </PWText>
                <PWSwitch
                    value={value}
                    onValueChange={onValueChange}
                    testID={testID}
                />
            </PWView>
        </PWView>
    )
}
