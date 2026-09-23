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

import { useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    CardUserUnavailableError,
    fetchFundingAddressLink,
    type FundingAddressLink,
} from '../api/card-creation'
import { fetchUser } from '../api/user'
import { getValidIntegrityToken } from './integrityToken'

export type UseFundingAddressLinkMutationResult = {
    /**
     * Whether `address` can be connected as this Baanx user's funding source.
     * Rejects rather than resolving when the answer can't be fetched: callers
     * treat that as "unknown" and let the create call be the backstop.
     */
    checkFundingAddress: (address: string) => Promise<FundingAddressLink>
    isPending: boolean
}

/**
 * Preflight for the funding-source picker.
 *
 * `createCard` links the address to the Baanx user before anything else and
 * fails with ACCOUNT_LINKED_ELSEWHERE when it belongs to someone else, which
 * the user only discovers after signing the ownership proof. This asks the
 * same question first. A mutation rather than a query: it runs against
 * whichever account the user just tapped, and the answer is not worth caching
 * past that decision.
 */
export const useFundingAddressLinkMutation =
    (): UseFundingAddressLinkMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation<FundingAddressLink, Error, string>({
            mutationFn: async address => {
                const user = await fetchUser({ network })
                if (!user) {
                    throw new CardUserUnavailableError()
                }
                return fetchFundingAddressLink({
                    network,
                    address,
                    baanxUserId: user.id,
                    integrityToken: getValidIntegrityToken() ?? '',
                })
            },
            // Handled by the caller as an inconclusive preflight, so it must
            // not reach the root error boundary.
            throwOnError: false,
        })

        const { mutateAsync } = mutation
        const checkFundingAddress = useCallback(
            (address: string) => mutateAsync(address),
            [mutateAsync],
        )

        return { checkFundingAddress, isPending: mutation.isPending }
    }
