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

import { PWIcon, PWText, PWTouchableOpacity } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { CircleFlag } from '@components/CircleFlag'
import { useStyles } from './styles'

export type OnrampCountryChipProps = {
    countryCode?: string
    onInfoPress?: () => void
}

export const OnrampCountryChip = ({
    countryCode,
    onInfoPress,
}: OnrampCountryChipProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const label = countryCode?.toUpperCase() ?? t('onramp.region.unknown')

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onInfoPress}
            disabled={!onInfoPress}
            testID='onramp-country-chip'
        >
            {countryCode ? (
                <CircleFlag
                    countryCode={countryCode}
                    size='sm'
                />
            ) : null}
            <PWText
                variant='bodySemibold'
                style={styles.code}
            >
                {label}
            </PWText>
            <PWIcon
                name='info'
                size='sm'
                variant='secondary'
            />
        </PWTouchableOpacity>
    )
}
