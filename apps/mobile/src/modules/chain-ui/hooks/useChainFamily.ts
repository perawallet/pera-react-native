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

import { useMemo } from 'react'
import {
    addressCodecs,
    type ChainFamily,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    truncateAlgorandAddress,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useLanguage } from '@hooks/useLanguage'
import { chainUiFor } from '../registry'

export type UseChainFamilyResult = {
    label: string
    /** The family's first registered chain, which stands for it in an icon. */
    leadChainId: Optional<ChainId>
    /** Its codec's short form, or a plain middle cut for an unregistered family. */
    truncate: (address: string) => string
}

const leadChainOf = (family: ChainFamily): Optional<ChainId> => {
    const leads = new Map<ChainFamily, ChainId>()
    for (const { id, family: chainFamily } of getProvider().chains.list()) {
        if (!leads.has(chainFamily)) leads.set(chainFamily, id)
    }
    return leads.get(family)
}

/**
 * A family's display name falls back to its first chain's, then to the family
 * id, for a build that doesn't bundle the family's UI.
 */
export const chainFamilyDisplay = (
    family: ChainFamily,
    t: (key: string) => string,
): UseChainFamilyResult => {
    const leadChainId = leadChainOf(family)
    const { familyLabel } = chainUiFor(family)
    const labelOf = () => {
        if (familyLabel) return t(familyLabel)
        if (leadChainId) {
            return getProvider().chains.get(leadChainId).descriptor.displayName
        }
        return family
    }
    const label = labelOf()
    const truncate = (address: string) =>
        leadChainId && addressCodecs.has(leadChainId)
            ? addressCodecs.get(leadChainId).truncate(address)
            : truncateAlgorandAddress(address)
    return { label, leadChainId, truncate }
}

export const useChainFamily = (family: ChainFamily): UseChainFamilyResult => {
    const { t } = useLanguage()
    return useMemo(() => chainFamilyDisplay(family, t), [family, t])
}
