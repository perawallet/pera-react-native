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

import {
    useMutation,
    useMutationState,
    useQueryClient,
} from '@tanstack/react-query'
import {
    toScopeKey,
    type ChainScope,
    type TokenApproval,
} from '@perawallet/wallet-core-chain-contract'
import {
    generateOrderedUniqueId,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    broadcasterChainAdapters,
    useSigningRequest,
    UserRejectedSigningError,
} from '@perawallet/wallet-core-signing'
import { transferChainAdapters } from '../transfer-adapter'
import {
    getTokenApprovalsQueryKey,
    revokeTokenApprovalMutationKey,
} from './querykeys'

export type RevokeTokenApprovalParams = {
    scope: ChainScope
    account: string
    approval: TokenApproval
}

export type RevokeTokenApprovalOwner = {
    scope: ChainScope
    account: string
}

export type UseRevokeTokenApprovalMutationResult = {
    /** Resolves once the chain confirms the revoke; rejects with `UserRejectedSigningError` when the user declines the review. */
    revoke: (params: RevokeTokenApprovalParams) => Promise<void>
    /** The approval `owner` is revoking, from the review until the chain confirms it. */
    revokingApproval: Nullable<TokenApproval>
    isPending: boolean
}

export const useRevokeTokenApprovalMutation = (
    owner?: RevokeTokenApprovalOwner,
): UseRevokeTokenApprovalMutationResult => {
    const { addSignRequest } = useSigningRequest()
    const queryClient = useQueryClient()

    // Read from the shared cache, not this observer: a screen reopened
    // while a revoke waits on the chain must not offer the same revoke
    // again. Only the owner's own revokes count, since the nonce they
    // would share is that account's on that network.
    const pending = useMutationState({
        filters: {
            mutationKey: revokeTokenApprovalMutationKey,
            status: 'pending',
        },
        select: mutation =>
            mutation.state.variables as RevokeTokenApprovalParams,
    })
    const revokingApproval =
        (owner &&
            pending.find(
                variables =>
                    toScopeKey(variables.scope) === toScopeKey(owner.scope) &&
                    variables.account.toLowerCase() ===
                        owner.account.toLowerCase(),
            )?.approval) ||
        null

    const mutation = useMutation({
        mutationKey: revokeTokenApprovalMutationKey,
        mutationFn: async ({
            scope,
            account,
            approval,
        }: RevokeTokenApprovalParams): Promise<void> => {
            const txs = await transferChainAdapters
                .get(scope.chainId)
                .build(
                    { kind: 'approval-revoke', account, approval },
                    { scope },
                )
            // Not a wallet-built source: review reads the calldata itself,
            // which is what titles it as a revoke.
            const txIds = await new Promise<string[]>((resolve, reject) => {
                addSignRequest({
                    id: generateOrderedUniqueId(),
                    type: 'transactions',
                    transport: 'submit-and-answer',
                    sourceType: 'approval-revoke',
                    txs,
                    approve: async (_signed, submission) => {
                        resolve(submission?.txIds ?? [])
                    },
                    reject: async () => {
                        reject(new UserRejectedSigningError())
                    },
                    error: async error => {
                        reject(error)
                    },
                })
            })
            try {
                await broadcasterChainAdapters
                    .get(scope.chainId)
                    .waitForConfirmation(scope, txIds)
            } finally {
                // Re-read either way: a revoke that failed or timed out
                // leaves the list showing what the chain says.
                await queryClient.invalidateQueries({
                    queryKey: getTokenApprovalsQueryKey(scope, account),
                })
            }
        },
    })

    return {
        revoke: mutation.mutateAsync,
        revokingApproval,
        isPending: revokingApproval !== null,
    }
}
