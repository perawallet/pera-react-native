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

// The planner, the reviewer and the known-answer vectors, for suites outside
// this package that run Ethereum signing end to end; aliased as
// `@perawallet/wallet-core-chain-ethereum/testing` by consumers, never built.
export { ethereumDescriptor } from '../descriptor'
export { ethereumLocalKeyKinds } from '../accounts/local-key-kinds'
export {
    ethereumPlannerAdapter,
    type EthereumTransactionPayload,
} from '../signing/adapter'
export {
    createEthereumReviewer,
    ethereumReviewerAdapter,
} from '../signing/review'
export { readEthereumNative } from '../signing/transaction-view'
export {
    SENDER,
    TRANSFER,
    VIEM_TRANSFER_NONCE_0,
    createVectorKeyStore,
} from '../signing/__tests__/fixtures'
