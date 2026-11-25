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

import { useCallback, useState } from 'react'
import type { FeePreset } from '@perawallet/wallet-core-chain-contract'
import { useChainHasL1DataFee } from '@perawallet/wallet-core-chain-shared'
import type { FeeRowProps } from './types'

type UseGasFeeEditorResult = {
    isExpanded: boolean
    toggleExpanded: () => void
    selectPreset: (preset: FeePreset) => void
    /** The max fee info says the fee includes the chain's L1 data fee. */
    hasL1DataFee: boolean
}

// Local state, not a store: each review mounts closed, while the chosen speed
// already persists in the send-funds store.
export const useGasFeeEditor = ({
    scope,
    onPresetChange,
}: Pick<FeeRowProps, 'scope' | 'onPresetChange'>): UseGasFeeEditorResult => {
    const [isExpanded, setIsExpanded] = useState(false)
    const hasL1DataFee = useChainHasL1DataFee(scope.chainId)

    const toggleExpanded = useCallback(() => {
        setIsExpanded(current => !current)
    }, [])

    const selectPreset = useCallback(
        (preset: FeePreset) => {
            onPresetChange(preset)
            setIsExpanded(false)
        },
        [onPresetChange],
    )

    return { isExpanded, toggleExpanded, selectPreset, hasL1DataFee }
}
