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

import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections'
import { ledgerAppDriverRegistry } from '@perawallet/wallet-extension-hardware-wallet'
import { swapChainAdapters } from '@perawallet/wallet-core-swaps'
import { algorandDappRequestAdapter } from './connect/dappRequestAdapter'
import { sendFlowChainAdapters } from '@perawallet/wallet-core-transactions'
import { algorandSendFlowAdapter } from './asa-inbox/adapter'
import { nameServiceChainAdapters } from '@perawallet/wallet-core-nfd'
import { algorandLedgerAppDriver } from './ledger/driver'
import { algorandSwapAdapter } from './swaps'
import { algorandNameServiceAdapter } from './nfd'

// Adapters must be module-level instances, not built in here: the registries
// ignore a repeat of the same instance but reject a new one, which is what
// keeps a second call harmless.
export const registerChain = (): void => {
    ledgerAppDriverRegistry.register(algorandLedgerAppDriver)
    swapChainAdapters.register(algorandSwapAdapter)
    dappRequestChainAdapters.register(algorandDappRequestAdapter)
    sendFlowChainAdapters.register(algorandSendFlowAdapter)
    nameServiceChainAdapters.register(algorandNameServiceAdapter)
}
