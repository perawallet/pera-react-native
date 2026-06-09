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

import { Trans } from 'react-i18next'
import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader } from '@modules/bottom-sheet'
import { useStyles } from './styles'
import { SafeAreaView } from 'react-native-safe-area-context'

export type OnrampCountryInfoContentProps = {
    countryName?: string
}

export const OnrampCountryInfoContent = ({
    countryName,
}: OnrampCountryInfoContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const country = countryName ?? t('onramp.region.country_fallback')

    return (
        <SafeAreaView edges={['bottom']}>
            <SheetHeader
                title={t('onramp.region.info_title')}
                showClose
            />
            <PWView style={styles.body}>
                <PWText>
                    <Trans
                        i18nKey='onramp.region.info_body'
                        values={{ country }}
                        components={[
                            <PWText
                                key='country'
                                weight={700}
                                style={styles.country}
                            />,
                        ]}
                    />
                </PWText>
                <PWText>{t('onramp.region.info_body_secondary')}</PWText>
            </PWView>
        </SafeAreaView>
    )
}
