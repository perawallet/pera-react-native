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

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Decimal } from 'decimal.js'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    fetchDelegationProgram,
    fetchDelegationToken,
    postAlgorandDelegationApproval,
    verifyDelegationProgram,
} from '../api/delegation'
import { DEFAULT_CARD_CURRENCY, type DelegationSignature } from '../models'
import { cardQueryKeys } from './querykeys'
import { toCardMutationResult, type CardMutationResult } from './types'

export type UpdateCardFundingDelegationVariables = {
    /** Delegator (funding-source) address. */
    address: string
    /** Allowance in display USD units; Decimal(0) cancels the delegation. */
    allowance: Decimal
    /** Injected from wallet-core-signing — card stays signing-agnostic. */
    signDelegation: (program: Uint8Array) => Promise<DelegationSignature>
}

export type UseUpdateCardFundingDelegationMutationResult =
    CardMutationResult<UpdateCardFundingDelegationVariables>

/**
 * (Re)delegates card auto-funding: a new delegation fully replaces any
 * previous one for the address, so this covers first-time delegation,
 * redelegation, and (with allowance 0) cancellation.
 */
export const useUpdateCardFundingDelegationMutation =
    (): UseUpdateCardFundingDelegationMutationResult => {
        const { network } = useNetwork()
        const queryClient = useQueryClient()

        const mutation = useMutation<
            void,
            Error,
            UpdateCardFundingDelegationVariables
        >({
            mutationFn: async ({ address, allowance, signDelegation }) => {
                const program = await fetchDelegationProgram({ network })
                // Never sign an unpinned program in production — covers cancels
                // too (allowance 0 still signs the program), so enabling auto
                // funding in prod requires a pinned program first. See verify.ts.
                verifyDelegationProgram(program, network)
                const { signedProgram } = await signDelegation(program)
                // Single-use token (~10 min) fetched after signing so it is
                // freshest at post time; the nonce is posted as-is, not signed.
                const { token, nonce } = await fetchDelegationToken({
                    network,
                })
                await postAlgorandDelegationApproval({
                    network,
                    address,
                    // toFixed() keeps full precision and never emits exponent
                    // notation (unlike toString()).
                    amount: allowance.toFixed(),
                    currency: DEFAULT_CARD_CURRENCY.toLowerCase(),
                    token,
                    signedProgram: encodeToBase64(signedProgram),
                    sigMessage: nonce,
                })
            },
            throwOnError: false,
            onSuccess: () => {
                void queryClient.invalidateQueries({
                    queryKey: cardQueryKeys.externalWallets(network),
                })
            },
        })

        return toCardMutationResult(mutation)
    }
