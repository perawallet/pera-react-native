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

import { useQuery } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    multisigChainAdapters,
    type ParticipantVerdict,
} from '../chain-adapter'
import { getParticipantVerdictQueryKey } from './querykeys'

type UseParticipantVerdictQueryParams = {
    address: string
    scope: ChainScope
    enabled?: boolean
}

export type UseParticipantVerdictQueryResult = {
    /** `null` while loading and on error, which callers treat like `unclassified`. */
    verdict: Nullable<ParticipantVerdict>
    isFetching: boolean
}

export const useParticipantVerdictQuery = ({
    address,
    scope,
    enabled = true,
}: UseParticipantVerdictQueryParams): UseParticipantVerdictQueryResult => {
    const query = useQuery({
        queryKey: getParticipantVerdictQueryKey(scope, address),
        queryFn: () =>
            multisigChainAdapters
                .get(scope.chainId)
                .classifyParticipant(address, scope),
        enabled: enabled && !!address,
        retry: false,
    })

    return { verdict: query.data ?? null, isFetching: query.isFetching }
}
