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

import type { SupportedCountry } from '@perawallet/wallet-core-card'
import type { Optional } from '@perawallet/wallet-core-shared'
import { isoToFlagEmoji } from '../../utils/isoToFlagEmoji'
import {
    OptionSelectorField,
    type OptionSelectorFieldProps,
} from '../OptionSelectorField'

export type CountrySelectorFieldProps = Omit<
    OptionSelectorFieldProps,
    'value' | 'spokenValue'
> & {
    country: Optional<SupportedCountry>
}

/** An {@link OptionSelectorField} showing the chosen country's flag and name. */
export const CountrySelectorField = ({
    country,
    ...fieldProps
}: CountrySelectorFieldProps) => (
    <OptionSelectorField
        {...fieldProps}
        value={
            country
                ? `${isoToFlagEmoji(country.iso3166alpha2)}  ${country.name}`
                : undefined
        }
        spokenValue={country?.name}
    />
)
