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

import type { ReactNode } from 'react'
import type { Decimal } from 'decimal.js'
import type {
    ChainId,
    FeePreset,
    FeePresetEstimate,
} from '@perawallet/wallet-core-chain-contract'
import { useChainFeeModel } from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import { FlatFeeRow } from './FlatFeeRow'
import { GasFeeEditor } from './GasFeeEditor'

export const FEE_ROW_TEST_ID = 'transaction_fee_row'

export type FeeRowProps = {
    chainId: ChainId
    /** Base units of the chain's native asset: the headline fee. */
    amount: Optional<Decimal>
    /** Base units of the chain's native asset. Set by a chain whose fee model has presets. */
    presets?: Record<FeePreset, FeePresetEstimate>
    isLoading: boolean
    selectedPreset: FeePreset
    onPresetChange: (preset: FeePreset) => void
    /** Rendered beside the headline amount. */
    accessory?: ReactNode
}

export const FeeRow = ({
    chainId,
    amount,
    presets,
    isLoading,
    selectedPreset,
    onPresetChange,
    accessory,
}: FeeRowProps) => {
    const feeModel = useChainFeeModel(chainId)

    switch (feeModel) {
        case 'gas':
            // A gas estimate without presets breaks the fee contract; the
            // headline amount is still right to show.
            if (presets) {
                return (
                    <GasFeeEditor
                        chainId={chainId}
                        presets={presets}
                        selectedPreset={selectedPreset}
                        onPresetChange={onPresetChange}
                        accessory={accessory}
                    />
                )
            }
            break
        case 'flat':
        case 'rate':
            break
        default: {
            const unhandled: never = feeModel
            throw new Error(`Unhandled fee model: ${String(unhandled)}`)
        }
    }

    return (
        <FlatFeeRow
            chainId={chainId}
            amount={amount}
            isLoading={isLoading}
            accessory={accessory}
        />
    )
}
