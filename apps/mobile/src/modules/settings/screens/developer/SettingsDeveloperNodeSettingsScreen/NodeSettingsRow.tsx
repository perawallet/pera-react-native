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
import type { NodeSettingsRowModel } from './useSettingsDeveloperNodeSettingsScreen'

export type NodeSettingsRowProps = {
    row: NodeSettingsRowModel
    onSelect: () => void
}

export const NodeSettingsRow = ({ row, onSelect }: NodeSettingsRowProps) => {
    // Unstyled wrapper: a bare radio in a column, with a `_row` testID for
    // on-device automation distinct from the radio's own `_radio` testID.
    return (
        <PWView testID={`node_settings_${row.globalNetwork}_row`}>
            <PWRadioButton
                testID={`node_settings_${row.globalNetwork}_radio`}
                title={row.label}
                onPress={onSelect}
                isSelected={row.isSelected}
            />
        </PWView>
    )
}
