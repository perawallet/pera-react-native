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

import { onlineManager } from '@tanstack/react-query'
import { isPeraServiceUnavailableError } from '@perawallet/wallet-core-shared'

/** Quiet re-reads a failed history page gets before the screen shows its error. */
export const HISTORY_READ_RETRY_LIMIT = 1

// The app's query default is no retry, so a read that raced something not yet
// ready at launch would show the error state. A service the network doesn't
// have can never answer, and an offline read only fails again, so both fail at once.
export const shouldRetryHistoryRead = (
    failureCount: number,
    error: Error,
): boolean =>
    failureCount < HISTORY_READ_RETRY_LIMIT &&
    onlineManager.isOnline() &&
    !isPeraServiceUnavailableError(error)
