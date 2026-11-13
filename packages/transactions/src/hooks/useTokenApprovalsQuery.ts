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
import type {
    ChainScope,
    TokenApproval,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { transferChainAdapters } from '../transfer-adapter'
import { getTokenApprovalsQueryKey } from './querykeys'

export type UseTokenApprovalsQueryParams = {
    scope: ChainScope
    account: Optional<string>
}

export type UseTokenApprovalsQueryResult = {
    data: TokenApproval[]
    isPending: boolean
    isError: boolean
    refetch: () => void
}

export const useTokenApprovalsQuery = ({
    scope,
    account,
}: UseTokenApprovalsQueryParams): UseTokenApprovalsQueryResult => {
    const listApprovals = transferChainAdapters.has(scope.chainId)
        ? transferChainAdapters.get(scope.chainId).listApprovals
        : undefined
    const isEnabled = !!account && !!listApprovals

    const query = useQuery({
        queryKey: getTokenApprovalsQueryKey(scope, account ?? ''),
        queryFn:
            isEnabled && listApprovals
                ? () => listApprovals(account, scope)
                : skipToken,
        // A paused read would hold the skeleton up offline instead of
        // letting the screen offer a retry.
        networkMode: 'always',
        retry: false,
        // A grant made elsewhere since the last read must show, so every open
        // reads the chain again.
        staleTime: 0,
        refetchOnMount: 'always',
    })

    return {
        data: query.data ?? [],
        // A disabled query reports pending too.
        isPending: isEnabled && query.isPending,
        isError: query.isError,
        refetch: () => void query.refetch(),
    }
}
