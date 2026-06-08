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

import { PWIcon, PWInput, PWTouchableOpacity, PWView } from '@components/core'
import type { SupportedCountry } from '@perawallet/wallet-core-card'
import type { Optional } from '@perawallet/wallet-core-shared'
import { isoToFlagEmoji } from '../../utils/isoToFlagEmoji'
import { useStyles } from './styles'

export type CountrySelectorFieldProps = {
    label: string
    placeholder: string
    country: Optional<SupportedCountry>
    onPress: () => void
    testID?: string
}

/**
 * A read-only field styled like the email input (label + underline) that opens
 * the country picker on press. Renders the selected country's flag + name, or
 * the placeholder when none is selected.
 */
export const CountrySelectorField = ({
    label,
    placeholder,
    country,
    onPress,
    testID,
}: CountrySelectorFieldProps) => {
    const styles = useStyles()

    const value = country
        ? `${isoToFlagEmoji(country.iso3166alpha2)}  ${country.name}`
        : ''

    return (
        <PWTouchableOpacity
            onPress={onPress}
            accessibilityRole='button'
            accessibilityLabel={`${label}, ${country ? country.name : placeholder}`}
            testID={testID}
        >
            <PWView
                pointerEvents='none'
                importantForAccessibility='no-hide-descendants'
                accessibilityElementsHidden
            >
                <PWInput
                    label={label}
                    labelStyle={styles.label}
                    value={value}
                    placeholder={placeholder}
                    editable={false}
                    renderErrorMessage={false}
                    rightIcon={
                        <PWIcon
                            name='chevron-down'
                            variant='secondary'
                        />
                    }
                />
            </PWView>
        </PWTouchableOpacity>
    )
}
