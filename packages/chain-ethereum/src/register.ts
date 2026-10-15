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
    accountsChainAdapters,
    type AccountsChainAdapter,
} from '@perawallet/wallet-core-accounts'
import {
    assetsChainAdapters,
    type AssetsChainAdapter,
} from '@perawallet/wallet-core-assets'
import {
    addressCodecs,
    keyDerivations,
    transactionPlanners,
    transactionReviewers,
    type ChainContext,
} from '@perawallet/wallet-core-chain-contract'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections/dappRequest'
import {
    broadcasterChainAdapters,
    type BroadcasterChainAdapter,
} from '@perawallet/wallet-core-signing'
import { deeplinkAdapters } from '@perawallet/wallet-core-deeplinks'
import {
    historyChainAdapters,
    transferChainAdapters,
    type TransferChainAdapter,
} from '@perawallet/wallet-core-transactions'
import {
    createEthereumAccountsAdapter,
    ethereumAddressCodec,
    ethereumKeyDerivation,
} from './accounts'
import { createEthereumAssetsAdapter } from './assets'
import { ethereumDappRequestAdapter } from './connect/dappRequestAdapter'
import { ethereumDeeplinkAdapter } from './deeplinks/adapter'
import { ethereumHistoryAdapter } from './history'
import { ethereumPlannerAdapter } from './signing/adapter'
import { ethereumReviewerAdapter } from './signing/review'
import {
    createEthereumBroadcasterAdapter,
    createEthereumTransferAdapter,
} from './transfer'

// The registries ignore a repeat of the same instance but reject a new one, so
// the context-bound adapters are built once; every context the app hands in
// reads the same live stores.
let accountsAdapter: AccountsChainAdapter | undefined
let assetsAdapter: AssetsChainAdapter | undefined
let transferAdapter: TransferChainAdapter | undefined
let broadcasterAdapter: BroadcasterChainAdapter | undefined

export const registerChain = (ctx: ChainContext): void => {
    accountsAdapter ??= createEthereumAccountsAdapter(ctx)
    assetsAdapter ??= createEthereumAssetsAdapter(ctx)
    transferAdapter ??= createEthereumTransferAdapter(ctx)
    broadcasterAdapter ??= createEthereumBroadcasterAdapter(ctx)
    addressCodecs.register(ethereumAddressCodec)
    keyDerivations.register(ethereumKeyDerivation)
    transactionPlanners.register(ethereumPlannerAdapter)
    transactionReviewers.register(ethereumReviewerAdapter)
    accountsChainAdapters.register(accountsAdapter)
    assetsChainAdapters.register(assetsAdapter)
    transferChainAdapters.register(transferAdapter)
    broadcasterChainAdapters.register(broadcasterAdapter)
    historyChainAdapters.register(ethereumHistoryAdapter)
    dappRequestChainAdapters.register(ethereumDappRequestAdapter)
    deeplinkAdapters.register(ethereumDeeplinkAdapter)
}
