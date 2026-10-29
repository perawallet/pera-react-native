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

import type { FeeModel } from '@perawallet/wallet-core-chain-contract'
import { useChainFeeModel } from '@perawallet/wallet-core-chain-shared'
import { FlatFeeRow } from './FlatFeeRow'
import { GasFeeEditor } from './GasFeeEditor'
import type { FeeRowProps } from './types'

// Record keeps this exhaustive: a new fee model fails to compile until it
// picks a row. A size-rate chain shows its single fee until it prices presets.
const FEE_MODEL_HAS_PRESETS: Record<FeeModel, boolean> = {
    flat: false,
    gas: true,
    rate: false,
}

export const FeeRow = ({
    scope,
    amount,
    presets,
    isLoading,
    selectedPreset,
    onPresetChange,
    accessory,
}: FeeRowProps) => {
    const feeModel = useChainFeeModel(scope.chainId)

    // Until presets arrive (loading, or none returned) the headline amount is
    // the best fee to show.
    if (FEE_MODEL_HAS_PRESETS[feeModel] && presets) {
        return (
            <GasFeeEditor
                scope={scope}
                presets={presets}
                selectedPreset={selectedPreset}
                onPresetChange={onPresetChange}
                accessory={accessory}
            />
        )
    }

    return (
        <FlatFeeRow
            scope={scope}
            amount={amount}
            isLoading={isLoading}
            accessory={accessory}
        />
    )
}
