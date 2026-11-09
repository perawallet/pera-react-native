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

import type { TFunction } from 'i18next'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    PredictedFailureMessage,
    type ReviewWarningItem,
} from '@modules/signing'
import type { EthereumReviewWarning } from './ethereumReviewWarnings'
import { EthereumHighFeeMessage } from './EthereumHighFeeMessage'

export const ethereumReviewWarningItemOf = (
    warning: EthereumReviewWarning,
    scope: ChainScope,
    t: TFunction,
): ReviewWarningItem => {
    switch (warning.kind) {
        case 'predicted-failure': {
            return {
                id: 'predicted_failure_warning',
                title: t('signing.predicted_failure.title'),
                message: <PredictedFailureMessage reason={warning.reason} />,
                isHighRisk: true,
            }
        }
        case 'high-fee': {
            return {
                id: 'ethereum_high_fee_warning',
                title: t('ethereum.review_warnings.high_fee_title'),
                message: (
                    <EthereumHighFeeMessage
                        scope={scope}
                        maxFee={warning.maxFee}
                        requesterHost={warning.requesterHost}
                    />
                ),
                isHighRisk: true,
            }
        }
        case 'unchecked-call': {
            return {
                id: 'ethereum_contract_call_warning',
                message: t(warning.notice.titleKey, warning.notice.params),
                isHighRisk: false,
            }
        }
        case 'simulation-unavailable': {
            return {
                id: 'ethereum_simulation_unavailable',
                message: t('ethereum.simulation.unavailable'),
                isHighRisk: false,
            }
        }
    }
}
