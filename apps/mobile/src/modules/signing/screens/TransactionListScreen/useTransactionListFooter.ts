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

import type { ComponentType } from 'react'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    chainIdOfSignRequest,
    useSigningPipeline,
} from '@perawallet/wallet-core-signing'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { chainUiFor } from '@modules/chain-ui'
import type { TotalFeeProps } from '@modules/signing/transactions/types'

type UseTransactionListFooterResult = {
    TotalFee: Nullable<ComponentType<TotalFeeProps>>
}

export const useTransactionListFooter = (): UseTransactionListFooterResult => {
    const { currentRequest } = useSigningPipeline()
    if (!currentRequest) {
        return { TotalFee: null }
    }
    const { family } = getChainDescriptor(chainIdOfSignRequest(currentRequest))
    return {
        TotalFee: chainUiFor(family).transactionDetails?.TotalFee ?? null,
    }
}
