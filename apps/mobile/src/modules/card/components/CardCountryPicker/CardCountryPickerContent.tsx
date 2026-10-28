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
import { useLanguage } from '@hooks/useLanguage'
import { CardPickerSheetContent } from '../CardPickerSheet'
import { isoToFlagEmoji } from '../../utils/isoToFlagEmoji'
import { useCardCountryPicker } from './useCardCountryPicker'

export type CardCountryPickerContentProps = {
    /** Sheet header title; defaults to the country-of-residence copy. */
    title?: string
}

const getKey = (country: SupportedCountry) => country.id
const getTestID = (country: SupportedCountry) =>
    `card-country-${country.iso3166alpha2}`
const getLabel = (country: SupportedCountry) =>
    `${isoToFlagEmoji(country.iso3166alpha2)}  ${country.name}`

export const CardCountryPickerContent = ({
    title,
}: CardCountryPickerContentProps) => {
    const { t } = useLanguage()
    const {
        search,
        setSearch,
        countries,
        isLoading,
        isError,
        refetch,
        handleSelect,
    } = useCardCountryPicker()

    return (
        <CardPickerSheetContent
            title={title ?? t('peraCard.create_account.country_picker_title')}
            items={countries}
            search={search}
            onSearchChange={setSearch}
            isLoading={isLoading}
            isError={isError}
            onRetry={refetch}
            onSelect={handleSelect}
            getKey={getKey}
            getLabel={getLabel}
            getTestID={getTestID}
            copy={{
                searchPlaceholder: t(
                    'peraCard.create_account.country_search_placeholder',
                ),
                emptyTitle: t('peraCard.create_account.country_empty_title'),
                emptyBody: t('peraCard.create_account.country_empty_body'),
                errorTitle: t('peraCard.create_account.country_error_title'),
                errorBody: t('peraCard.create_account.country_error_body'),
                retry: t('peraCard.create_account.country_retry'),
            }}
        />
    )
}
