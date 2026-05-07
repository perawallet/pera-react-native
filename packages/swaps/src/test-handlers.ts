/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

export {
    mockCalculatePeraFee,
    mockCalculateSwapAmount,
    mockCreateQuotes,
    type MockCalculatePeraFeeParams,
    type MockCalculateSwapAmountParams,
    type MockCreateQuotesParams,
} from './api/quotes/handlers'

export {
    mockSwapProviders,
    mockTopPairs,
    type MockSwapProvidersParams,
    type MockTopPairsParams,
} from './api/providers/handlers'

export {
    mockUpdateSwapStatus,
    type MockUpdateSwapStatusParams,
} from './api/swaps/handlers'

export {
    mockAvailableAssets,
    type MockAvailableAssetsParams,
} from './api/available-assets/handlers'

export {
    mockPrepareTransactions,
    type MockPrepareTransactionsParams,
} from './api/transactions/handlers'

export {
    mockSwapHistory,
    mockDistinctPairsHistory,
    type MockSwapHistoryParams,
    type MockDistinctPairsHistoryParams,
} from './api/history/handlers'
