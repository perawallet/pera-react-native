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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { config } from '@perawallet/wallet-core-config'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { CardEscrowNotConfiguredError } from '../api/escrow'
import type { PendingWithdrawal } from '../models'
import { useCardStore } from '../store'
import { cardQueryKeys } from './querykeys'
import { useEscrowWithdrawal } from './useEscrowWithdrawal'

export type UseCardPendingWithdrawalQueryResult = {
    pending: Nullable<PendingWithdrawal>
    /** Seconds a request must age before `withdraw` is accepted; null until set. */
    waitTimeSeconds: Nullable<number>
    isLoading: boolean
    /** Drops every cached copy so each mounted consumer re-reads the box. */
    invalidate: () => Promise<void>
}

type PendingWithdrawalState = {
    pending: Nullable<PendingWithdrawal>
    waitTimeSeconds: Nullable<number>
}

const EMPTY_STATE: PendingWithdrawalState = {
    pending: null,
    waitTimeSeconds: null,
}

export const useCardPendingWithdrawalQuery =
    (): UseCardPendingWithdrawalQueryResult => {
        const { network } = useNetwork()
        const queryClient = useQueryClient()
        const escrowCardAddress = useCardStore(state => state.escrowCardAddress)
        const { getPendingWithdrawal, getWaitTimeSeconds } =
            useEscrowWithdrawal()

        const queryKey = cardQueryKeys.pendingWithdrawal(
            network,
            escrowCardAddress,
        )

        const query = useQuery({
            queryKey,
            queryFn: async (): Promise<PendingWithdrawalState> => {
                if (escrowCardAddress === null) return EMPTY_STATE
                try {
                    const [pending, waitTimeSeconds] = await Promise.all([
                        getPendingWithdrawal(escrowCardAddress),
                        getWaitTimeSeconds(),
                    ])
                    return { pending, waitTimeSeconds }
                } catch (error) {
                    // A build without the chain ids has no contract to ask,
                    // which is the same as nothing pending.
                    if (error instanceof CardEscrowNotConfiguredError) {
                        return EMPTY_STATE
                    }
                    throw error
                }
            },
            staleTime: config.reactQueryShortLivedStaleTime,
            enabled: escrowCardAddress !== null,
        })

        const invalidate = useCallback(
            () => queryClient.invalidateQueries({ queryKey }),
            [queryClient, queryKey],
        )

        return {
            pending: query.data?.pending ?? null,
            waitTimeSeconds: query.data?.waitTimeSeconds ?? null,
            isLoading: query.isLoading,
            invalidate,
        }
    }
