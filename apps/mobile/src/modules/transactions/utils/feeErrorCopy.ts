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

import {
    AppError,
    isRetryableError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { TFunction } from 'i18next'

/**
 * Copy for a fee estimate that failed. An error that names its situation (a
 * node refusing the send for its balance, a revert) shows its own copy;
 * anything else reads as the network not answering.
 */
export const feeErrorCopy = (
    error: Nullable<Error>,
    t: TFunction,
): { title: string; body: string; canRetry: boolean } => {
    const { titleKey, messageKey, params } =
        error instanceof AppError ? error.metadata : {}
    if (titleKey && messageKey) {
        return {
            title: t(titleKey, params),
            body: t(messageKey, params),
            canRetry: isRetryableError(error),
        }
    }
    return {
        title: t('send_funds.confirmation.fee_unavailable.title'),
        body: t('send_funds.confirmation.fee_unavailable.body'),
        canRetry: true,
    }
}
