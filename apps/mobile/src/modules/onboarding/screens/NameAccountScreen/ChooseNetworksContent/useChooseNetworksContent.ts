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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'

export type UseChooseNetworksContentParams = {
    selectedChainIds: readonly ChainId[]
    requiredChainIds: readonly ChainId[]
    /** Called with the chains selected after each toggle. */
    onChange: (chainIds: ChainId[]) => void
}

export type UseChooseNetworksContentResult = {
    isSelected: (chainId: ChainId) => boolean
    isRequired: (chainId: ChainId) => boolean
    /** False for a required chain and for the last one selected. */
    canToggle: (chainId: ChainId) => boolean
    handleToggle: (chainId: ChainId) => void
}

export const useChooseNetworksContent = ({
    selectedChainIds,
    requiredChainIds,
    onChange,
}: UseChooseNetworksContentParams): UseChooseNetworksContentResult => {
    const [selected, setSelected] = useState<ChainId[]>(() => [
        ...selectedChainIds,
    ])

    const isRequired = useCallback(
        (chainId: ChainId) => requiredChainIds.includes(chainId),
        [requiredChainIds],
    )

    const isSelected = useCallback(
        (chainId: ChainId) => isRequired(chainId) || selected.includes(chainId),
        [isRequired, selected],
    )

    const canToggle = useCallback(
        (chainId: ChainId) =>
            !isRequired(chainId) &&
            !(
                isSelected(chainId) &&
                new Set([...selected, ...requiredChainIds]).size === 1
            ),
        [isRequired, isSelected, selected, requiredChainIds],
    )

    const handleToggle = useCallback(
        (chainId: ChainId) => {
            if (!canToggle(chainId)) return
            const next = selected.includes(chainId)
                ? selected.filter(id => id !== chainId)
                : [...selected, chainId]
            setSelected(next)
            onChange(next)
        },
        [canToggle, selected, onChange],
    )

    return { isSelected, isRequired, canToggle, handleToggle }
}
