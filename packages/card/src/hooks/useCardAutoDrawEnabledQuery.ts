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

import { skipToken, useQuery } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { config } from '@perawallet/wallet-core-config'
import type { Optional } from '@perawallet/wallet-core-shared'
import { cardAdapterFor } from '../chain-adapter'
import { useCardStore } from '../store'
import { cardQueryKeys } from './querykeys'

export type UseCardAutoDrawEnabledQueryResult = {
    /** Undefined until the chain answers, and while it can't be read. */
    isEnabled: Optional<boolean>
    /** When the chain last answered, in ms; it changes with every fresh read. */
    updatedAt: number
}

/** Reads the on-chain auto-draw switch for the connected funding account. */
export const useCardAutoDrawEnabledQuery = (
    scope: ChainScope,
): UseCardAutoDrawEnabledQueryResult => {
    const ownerAddress = useCardStore(
        state => state.connectedFundingSourceAddress,
    )
    const query = useQuery({
        queryKey: cardQueryKeys.autoDrawEnabled(scope, ownerAddress),
        queryFn:
            ownerAddress === null
                ? skipToken
                : () =>
                      cardAdapterFor(scope).isAutoDrawEnabled(
                          scope,
                          ownerAddress,
                      ),
        staleTime: config.reactQueryShortLivedStaleTime,
    })
    return { isEnabled: query.data, updatedAt: query.dataUpdatedAt }
}
