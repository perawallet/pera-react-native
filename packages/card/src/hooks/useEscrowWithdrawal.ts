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
    useNetwork,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { cardAdapterFor } from '../chain-adapter'
import type { PendingWithdrawal } from '../models'

export type UseEscrowWithdrawalResult = {
    /** Starts the timelock for `amount` (base units) of the card's asset. */
    buildRequest: (params: {
        sender: string
        cardAddress: string
        amount: bigint
    }) => Promise<PeraTransaction[]>
    /**
     * Releases a matured request to the card owner. Throws rather than
     * building while the wait is still running.
     */
    buildWithdraw: (params: {
        sender: string
        cardAddress: string
        amount: bigint
    }) => Promise<PeraTransaction[]>
    buildCancel: (params: {
        sender: string
        cardAddress: string
    }) => Promise<PeraTransaction[]>
    /** The owner's open request, or null when there is none. */
    getPendingWithdrawal: (
        ownerAddress: string,
    ) => Promise<Nullable<PendingWithdrawal>>
    /** Seconds a request must age before release; null until the contract owner sets it. */
    getWaitTimeSeconds: () => Promise<Nullable<number>>
}

export const useEscrowWithdrawal = (): UseEscrowWithdrawalResult => {
    const { network } = useNetwork()

    return useMemo(() => {
        const withdrawal = () => cardAdapterFor(network).withdrawal
        return {
            buildRequest: params =>
                withdrawal().buildRequest({ ...params, network }),
            buildWithdraw: params =>
                withdrawal().buildWithdraw({ ...params, network }),
            buildCancel: params =>
                withdrawal().buildCancel({ ...params, network }),
            getPendingWithdrawal: ownerAddress =>
                withdrawal().getPending(network, ownerAddress),
            getWaitTimeSeconds: () => withdrawal().getWaitTimeSeconds(network),
        }
    }, [network])
}
