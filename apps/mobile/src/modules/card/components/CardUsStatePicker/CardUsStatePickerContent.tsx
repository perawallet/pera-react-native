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

import type { SupportedUsState } from '@perawallet/wallet-core-card'
import { useLanguage } from '@hooks/useLanguage'
import { CardPickerSheetContent } from '../CardPickerSheet'
import { useCardUsStatePicker } from './useCardUsStatePicker'

const getKey = (state: SupportedUsState) => state.id
const getLabel = (state: SupportedUsState) => state.name
const getTestID = (state: SupportedUsState) =>
    `card-us-state-${state.postalAbbreviation}`

export const CardUsStatePickerContent = () => {
    const { t } = useLanguage()
    const {
        search,
        setSearch,
        states,
        isLoading,
        isError,
        refetch,
        handleSelect,
    } = useCardUsStatePicker()

    return (
        <CardPickerSheetContent
            title={t('peraCard.address.us_state_picker_title')}
            items={states}
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
                    'peraCard.address.us_state_search_placeholder',
                ),
                emptyTitle: t('peraCard.address.us_state_empty_title'),
                emptyBody: t('peraCard.address.us_state_empty_body'),
                errorTitle: t('peraCard.address.us_state_error_title'),
                errorBody: t('peraCard.address.us_state_error_body'),
                retry: t('peraCard.address.us_state_retry'),
            }}
        />
    )
}
