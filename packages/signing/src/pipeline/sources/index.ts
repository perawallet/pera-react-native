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
    createLocalSource,
    createExternalSource,
    createFetchSource,
} from './factories'

export { createPaymentSource } from './createPaymentSource'
export { createExpressSendSource } from './createExpressSendSource'

export {
    createWalletConnectTransactionSource,
    createWalletConnectDataSource,
} from './createWalletConnectSource'
export type {
    WalletConnectTransactionRequest,
    WalletConnectDataRequest,
    WalletConnectRequest,
} from './createWalletConnectSource'

export {
    createArc59SendSource,
    createArc59ClaimSource,
    createArc59RejectSource,
} from './createArc59Sources'
export type {
    Arc59SendSourceParams,
    Arc59ClaimSourceParams,
    Arc59RejectSourceParams,
    Arc59SourceDependencies,
} from './createArc59Sources'

export type {
    PaymentSourceParams,
    ExpressSendSourceParams,
    SourceDependencies,
} from './types'
