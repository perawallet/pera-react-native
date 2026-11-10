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
import type { RequestedNetwork } from '../useConnectionApprovalView'

const MAX_COLLAPSED_NETWORK_CHIPS = 2

type UseRequestedNetworksPanelResult = {
    /** Added or dApp-required networks, listed above the optional note in proposal order. */
    leadingNetworks: RequestedNetwork[]
    /** Networks neither added nor required, in proposal order. */
    optionalNetworks: RequestedNetwork[]
    /** The chips shown on the closed row, added networks first. */
    collapsedNetworks: RequestedNetwork[]
    hiddenNetworkCount: number
    /** Open from the start only when Add is the one way to a session. */
    isInitiallyExpanded: boolean
    hasOptionalNote: boolean
}

export const useRequestedNetworksPanel = (
    requestedNetworks: RequestedNetwork[],
): UseRequestedNetworksPanelResult =>
    useMemo(() => {
        const addedNetworks = requestedNetworks.filter(({ isAdded }) => isAdded)
        const leadingNetworks = requestedNetworks.filter(
            ({ isAdded, isRequired }) => isAdded || isRequired,
        )
        const optionalNetworks = requestedNetworks.filter(
            ({ isAdded, isRequired }) => !isAdded && !isRequired,
        )
        const collapsedNetworks = [
            ...addedNetworks,
            ...requestedNetworks.filter(({ isAdded }) => !isAdded),
        ].slice(0, MAX_COLLAPSED_NETWORK_CHIPS)
        return {
            leadingNetworks,
            optionalNetworks,
            collapsedNetworks,
            hiddenNetworkCount:
                requestedNetworks.length - collapsedNetworks.length,
            isInitiallyExpanded:
                addedNetworks.length === 0 ||
                requestedNetworks.some(
                    ({ isAdded, isRequired }) => isRequired && !isAdded,
                ),
            hasOptionalNote:
                leadingNetworks.length > 0 && optionalNetworks.length > 0,
        }
    }, [requestedNetworks])
