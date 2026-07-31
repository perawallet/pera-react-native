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

import { PWRadioButton, PWView } from '@components/core'
import type { NetworkRow } from './useSettingsDeveloperNodeSettingsScreen'

export type NodeSettingsRowProps = {
    row: NetworkRow
    label: string
    /** Disables the radio while a network switch is already in flight (web). */
    isDisabled?: boolean
    onSelect: () => void
}

export const NodeSettingsRow = ({
    row,
    label,
    isDisabled = false,
    onSelect,
}: NodeSettingsRowProps) => {
    // Unstyled wrapper: matches main's bare-radio-in-a-column look (no card
    // border/padding) while still giving on-device automation a stable
    // `_row` testID distinct from the radio's own `_radio` testID.
    return (
        <PWView testID={`node_settings_${row.network}_row`}>
            <PWRadioButton
                testID={`node_settings_${row.network}_radio`}
                title={label}
                onPress={onSelect}
                isSelected={row.isSelected}
                isDisabled={isDisabled}
            />
        </PWView>
    )
}
