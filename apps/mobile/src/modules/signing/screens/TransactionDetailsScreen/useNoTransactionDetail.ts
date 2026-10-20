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

import type { UseTransactionDetailResult } from '@modules/signing/transactions/types'

const NO_TRANSACTION_DETAIL: UseTransactionDetailResult = {
    transaction: null,
    isPaused: false,
    isError: false,
    isLoading: false,
    error: null,
    refetch: () => undefined,
}

// Stands in for a chain that registers no fetch, so the screen calls one hook either way.
export const useNoTransactionDetail = (): UseTransactionDetailResult =>
    NO_TRANSACTION_DETAIL
