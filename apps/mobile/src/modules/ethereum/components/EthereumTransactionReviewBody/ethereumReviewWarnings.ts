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

import type { Decimal } from 'decimal.js'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import {
    contractCallNoticeOf,
    isCallUnexplained,
    requesterHostOf,
    type ContractCallNotice,
} from '../../utils/contractCallNotice'
import type { EthereumSimulationSectionState } from '../EthereumSimulationSection'

export type EthereumReviewWarning =
    | { kind: 'predicted-failure'; reason: Nullable<string> }
    /** `maxFee` is in wei. */
    | { kind: 'high-fee'; maxFee: Decimal; requesterHost: Optional<string> }
    | { kind: 'unchecked-call'; notice: ContractCallNotice }
    /** The simulation sends assets out and brings nothing, not even a permission, back. */
    | { kind: 'nothing-back' }

type EthereumReviewWarningsParams = {
    presentation: EthereumTransactionPresentation
    simulation: EthereumSimulationSectionState
    source?: SignRequestSource
    verifiedOrigin?: string
}

/** Everything the review warns about, most serious first. */
export const ethereumReviewWarningsOf = ({
    presentation,
    simulation,
    source,
    verifiedOrigin,
}: EthereumReviewWarningsParams): EthereumReviewWarning[] => {
    const { hasHighFee, reviewFee, isTransfer } = presentation
    const warnings: EthereumReviewWarning[] = []

    if (simulation.status === 'reverted') {
        warnings.push({ kind: 'predicted-failure', reason: simulation.reason })
    }
    if (hasHighFee && reviewFee) {
        warnings.push({
            kind: 'high-fee',
            maxFee: reviewFee.maxAmount,
            requesterHost: requesterHostOf(source, verifiedOrigin),
        })
    }
    if (!isTransfer && isCallUnexplained(presentation)) {
        warnings.push({
            kind: 'unchecked-call',
            notice: contractCallNoticeOf(source, verifiedOrigin),
        })
    }
    // A failed simulation isn't listed: the changes card says so in its place.
    if (
        simulation.status === 'success' &&
        simulation.spend.length > 0 &&
        simulation.receive.length === 0 &&
        simulation.approvals.length === 0
    ) {
        warnings.push({ kind: 'nothing-back' })
    }

    return warnings
}
