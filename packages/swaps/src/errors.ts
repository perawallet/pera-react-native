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

import { i18nKey, type ChainId } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'

/** What the router answered or prepared spends more, or differently, than the app asked for. */
export class SwapQuoteMismatchError extends AppError {
    constructor(message: string) {
        super(message, { category: ErrorCategory.TRANSACTIONS })
        this.name = 'SwapQuoteMismatchError'
    }
}

/** The swap account's destination network couldn't be enabled, so the swap never started. */
export class SwapDestinationChainError extends AppError {
    readonly chainId: ChainId

    constructor(chainId: ChainId, originalError?: Error) {
        super(
            `Could not enable ${chainId} for the swap payout`,
            {
                category: ErrorCategory.ACCOUNTS,
                messageKey: i18nKey(
                    'swap.execution.enable_network_failed_body',
                ),
                params: { network: chainDisplayNameOf(chainId) ?? chainId },
            },
            originalError,
        )
        this.chainId = chainId
        this.name = 'SwapDestinationChainError'
    }
}
