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
import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'

/**
 * Baanx refused to register the AutoDraw LSig: a 403 means the card is not yet
 * among the user's linked wallets. Linking completes asynchronously after
 * post-approval, so an immediate retry won't clear it, but a later one can.
 */
export class AutoDrawDelegationRejectedError extends AppError {
    constructor(reason?: string) {
        super('Baanx rejected the AutoDraw delegation', {
            category: ErrorCategory.NETWORK,
            recoverable: false,
            params: { reason },
        })
        this.name = 'AutoDrawDelegationRejectedError'
    }
}
