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

export {
    mockRampPairs,
    type MockRampPairsParams,
} from './api/pairs/msw-handlers'

export {
    mockRampRegion,
    type MockRampRegionParams,
} from './api/region/msw-handlers'

export {
    mockCreateRampQuote,
    mockCreateRampQuoteError,
    type MockCreateRampQuoteParams,
    type MockCreateRampQuoteErrorParams,
} from './api/quotes/msw-handlers'

export {
    mockCreateRampOrder,
    mockCancelRampOrder,
    type MockCreateRampOrderParams,
    type MockCancelRampOrderParams,
} from './api/orders/msw-handlers'

export {
    mockRampHistory,
    type MockRampHistoryParams,
} from './api/history/msw-handlers'
