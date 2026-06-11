/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { fetchOnboardingDetails } from '../api/onboarding'
import type { VerificationState } from '../models'
import { cardQueryKeys } from './querykeys'

export type UseOnboardingDetailsQueryOptions = {
    /** From email/verify; the query stays idle while it's null. */
    onboardingId: Nullable<string>
    enabled?: boolean
    /** Poll interval in ms (or `false`) — used to watch the KYC state. */
    refetchInterval?: number | false
}

export type UseOnboardingDetailsQueryResult = {
    verificationState: Nullable<VerificationState>
    isLoading: boolean
    refetch: () => void
}

/** Pre-auth onboarding status (GET /v1/auth/register) — polls the KYC state. */
export const useOnboardingDetailsQuery = ({
    onboardingId,
    enabled,
    refetchInterval,
}: UseOnboardingDetailsQueryOptions): UseOnboardingDetailsQueryResult => {
    const { network } = useNetwork()

    const query = useQuery({
        queryKey: cardQueryKeys.onboardingDetails(network, onboardingId),
        queryFn: ({ signal }) =>
            fetchOnboardingDetails({
                // queryFn only runs when enabled, which requires a non-null id.
                onboardingId: onboardingId as string,
                network,
                signal,
            }),
        enabled: Boolean(onboardingId) && (enabled ?? true),
        refetchInterval,
    })

    return {
        verificationState: query.data?.verificationState ?? null,
        isLoading: query.isLoading,
        refetch: () => void query.refetch(),
    }
}
