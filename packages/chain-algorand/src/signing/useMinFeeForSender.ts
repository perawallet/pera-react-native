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
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import {
    useMinimumFeeConfig,
    useSuggestedParametersQuery,
} from '@perawallet/wallet-core-blockchain'
import type { MinFeeForSenderResult } from '@perawallet/wallet-core-signing'
import { resolveMinFeeForSender } from './minFeeResolver'

export const useMinFeeForSender = (
    senderAddress: string | undefined,
): MinFeeForSenderResult => {
    const accounts = useAllAccounts()
    const { data: params, isPending } = useSuggestedParametersQuery()
    const { minTxnFee, pqMultiplier } = useMinimumFeeConfig()

    const minFee = useMemo(() => {
        if (senderAddress === undefined || params === undefined) {
            return undefined
        }
        return resolveMinFeeForSender({
            senderAddress,
            accounts,
            suggestedMinFee: BigInt(params.minFee),
            configMinTxnFee: minTxnFee,
            pqMultiplier,
        })
    }, [senderAddress, accounts, params, minTxnFee, pqMultiplier])

    return { minFee, isPending }
}
