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
import { createEvmAddressCodec } from '../accounts/address-codec'
import { evmChainOf } from '../chains/table'
import { createEvmPlannerAdapter } from '../signing/adapter'
import { createEvmMessageSignerAdapter } from '../signing/messages'
import { createEthereumReviewer } from '../signing/review'

const ethereum = evmChainOf('ethereum')

export const ethereumDescriptor = ethereum.descriptor
export const ethereumAddressCodec = createEvmAddressCodec(ethereum)
export const ethereumPlannerAdapter = createEvmPlannerAdapter(ethereum)
export const ethereumReviewerAdapter = createEthereumReviewer({
    chain: ethereum,
})
export const ethereumMessageSignerAdapter =
    createEvmMessageSignerAdapter(ethereum)

export { ethereumLocalKeyKinds } from '../accounts/local-key-kinds'
export { createVectorLedgerTransport } from '../ledger/__tests__/vectorLedgerTransport'
export { createVectorEthereumLedger } from '../ledger/__tests__/vectorEthereumApp'
export { type EthereumTransactionPayload } from '../signing/adapter'
export { createEthereumReviewer } from '../signing/review'
export { readEthereumNative } from '../signing/transaction-view'
export {
    personalSignMessageRequest,
    typedDataMessageRequest,
} from '../signing/messages'
export {
    DAI_PERMIT_TYPED_DATA,
    MAIL_TYPED_DATA,
    PERMIT2_SINGLE_NO_DEADLINE_TYPED_DATA,
    PERMIT2_SINGLE_TYPED_DATA,
    PERMIT2_SINGLE_UNLIMITED_TYPED_DATA,
    ERC20_TRANSFER,
    SENDER,
    SIGNER_KEY_PAIR_ID,
    TRANSFER,
    VIEM_ERC20_TRANSFER,
    VIEM_HELLO_WORLD,
    VIEM_MAIL,
    VIEM_TRANSFER_NONCE_0,
    createVectorKeyStore,
    vectorSignature,
} from '../signing/__tests__/fixtures'
// Re-exported so a suite outside this package verifies with viem itself
// without declaring it.
export { recoverTransactionAddress, verifyMessage, verifyTypedData } from 'viem'
