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

import type { RegistrationOptionList } from '@perawallet/wallet-core-card'
import { CardPickerSheetContent } from '../../CardPickerSheet'
import { useCardOptionPicker } from '../useCardOptionPicker'
import { useOptionPickerCopy } from '../useOptionPickerCopy'
import { getKey, getLabel, getTestID } from '../registrationOptionFields'

export type SettingsOptionPickerProps = {
    title: string
    list: RegistrationOptionList
}

export const SettingsOptionPicker = ({
    title,
    list,
}: SettingsOptionPickerProps) => {
    const copy = useOptionPickerCopy()
    const {
        search,
        setSearch,
        options,
        isLoading,
        isError,
        refetch,
        handleSelect,
    } = useCardOptionPicker(list)

    return (
        <CardPickerSheetContent
            title={title}
            items={options}
            search={search}
            onSearchChange={setSearch}
            isLoading={isLoading}
            isError={isError}
            onRetry={refetch}
            onSelect={handleSelect}
            getKey={getKey}
            getLabel={getLabel}
            getTestID={getTestID}
            copy={copy}
        />
    )
}
