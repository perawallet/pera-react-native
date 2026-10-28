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
    type AddressCodec,
    type ChainContext,
    type KeyDerivation,
    type TransactionPlanner,
    type TransactionReviewer,
} from '@perawallet/wallet-core-chain-contract'
import {
    dappRequestChainAdapters,
    type DappRequestChainAdapter,
} from '@perawallet/wallet-core-connections/dappRequest'
import {
    broadcasterChainAdapters,
    localKeySignerChainAdapters,
    messageSignerChainAdapters,
    reviewerChainAdapters,
    type BroadcasterChainAdapter,
    type LocalKeySignerChainAdapter,
    type MessageSignerChainAdapter,
    type ReviewerChainAdapter,
} from '@perawallet/wallet-core-signing'
import {
    nodeEndpointAdapters,
    type NodeEndpointAdapter,
} from '@perawallet/wallet-core-chain-shared'
import {
    deeplinkAdapters,
    type DeeplinkChainAdapter,
} from '@perawallet/wallet-core-deeplinks'
import {
    deviceChainAdapters,
    type DeviceChainAdapter,
} from '@perawallet/wallet-core-device'
import {
    historyChainAdapters,
    transferChainAdapters,
    type HistoryChainAdapter,
    type TransferChainAdapter,
} from '@perawallet/wallet-core-transactions'
import {
    ledgerAppDriverRegistry,
    type LedgerAppDriver,
} from '@perawallet/wallet-extension-hardware-wallet'
import {
    createEthereumAccountsAdapter,
    createEvmAddressCodec,
    createEvmKeyDerivation,
} from './accounts'
import { createEthereumAssetsAdapter } from './assets'
import { cachedWhitelist } from './assets/api/whitelist-cache'
import { createEvmNodeEndpointAdapter } from './blockchain/node-endpoint'
import type { EvmChain } from './chains/types'
import { createEthereumDappRequestAdapter } from './connect/dappRequestAdapter'
import { createEvmDeeplinkAdapter } from './deeplinks/adapter'
import { createEvmDeviceAdapter } from './device'
import { createEvmHistoryAdapter } from './history'
import { createEvmLedgerAppDriver } from './ledger/driver'
import { createEvmPlannerAdapter } from './signing/adapter'
import { createEvmLocalKeySignerAdapter } from './signing/localKeySigner'
import { createEvmMessageSignerAdapter } from './signing/messages'
import { createEthereumReviewer } from './signing/review'
import { createEvmSigningReviewerAdapter } from './signing/signingReviewer'
import {
    createEvmBroadcasterAdapter,
    createEvmTransferAdapter,
} from './transfer'

type EvmChainAdapters = {
    addressCodec: AddressCodec
    keyDerivation: KeyDerivation
    planner: TransactionPlanner
    reviewer: TransactionReviewer
    signingReviewer: ReviewerChainAdapter
    localKeySigner: LocalKeySignerChainAdapter
    messageSigner: MessageSignerChainAdapter
    accounts: AccountsChainAdapter
    assets: AssetsChainAdapter
    transfer: TransferChainAdapter
    broadcaster: BroadcasterChainAdapter
    history: HistoryChainAdapter
    dappRequest: DappRequestChainAdapter
    nodeEndpoint: NodeEndpointAdapter
    deeplink: DeeplinkChainAdapter
    device: DeviceChainAdapter
    ledgerDriver: LedgerAppDriver
}

const buildAdapters = (
    ctx: ChainContext,
    chain: EvmChain,
): EvmChainAdapters => {
    const reviewer = createEthereumReviewer({ chain })
    // Account sync and asset search read the same token list.
    const listedTokens = cachedWhitelist(chain)
    return {
        addressCodec: createEvmAddressCodec(chain),
        keyDerivation: createEvmKeyDerivation(chain),
        planner: createEvmPlannerAdapter(chain),
        reviewer,
        signingReviewer: createEvmSigningReviewerAdapter(chain, reviewer),
        localKeySigner: createEvmLocalKeySignerAdapter(chain),
        messageSigner: createEvmMessageSignerAdapter(chain),
        accounts: createEthereumAccountsAdapter(ctx, chain, listedTokens),
        assets: createEthereumAssetsAdapter(ctx, chain, listedTokens),
        transfer: createEvmTransferAdapter(ctx, chain),
        broadcaster: createEvmBroadcasterAdapter(ctx, chain),
        history: createEvmHistoryAdapter(chain),
        dappRequest: createEthereumDappRequestAdapter(ctx, chain),
        nodeEndpoint: createEvmNodeEndpointAdapter(ctx, chain),
        deeplink: createEvmDeeplinkAdapter(chain),
        device: createEvmDeviceAdapter(chain),
        ledgerDriver: createEvmLedgerAppDriver(chain),
    }
}

// Only one adapter may claim a scheme, and every EVM chain shares EIP-681's.
const isSchemeClaimed = (chain: EvmChain): boolean =>
    deeplinkAdapters
        .list()
        .some(adapter =>
            adapter.schemes.some(scheme =>
                chain.descriptor.uriSchemes.includes(scheme),
            ),
        )

export const createEvmChainRegistration = (
    chain: EvmChain,
): ((ctx: ChainContext) => void) => {
    // The registries ignore a repeat of the same instance but reject a new one,
    // so the adapters are built on the first registration; every context the
    // app hands in reads the same live stores.
    let adapters: EvmChainAdapters | undefined
    return ctx => {
        adapters ??= buildAdapters(ctx, chain)
        addressCodecs.register(adapters.addressCodec)
        keyDerivations.register(adapters.keyDerivation)
        transactionPlanners.register(adapters.planner)
        transactionReviewers.register(adapters.reviewer)
        reviewerChainAdapters.register(adapters.signingReviewer)
        localKeySignerChainAdapters.register(adapters.localKeySigner)
        messageSignerChainAdapters.register(adapters.messageSigner)
        accountsChainAdapters.register(adapters.accounts)
        assetsChainAdapters.register(adapters.assets)
        transferChainAdapters.register(adapters.transfer)
        broadcasterChainAdapters.register(adapters.broadcaster)
        historyChainAdapters.register(adapters.history)
        dappRequestChainAdapters.register(adapters.dappRequest)
        nodeEndpointAdapters.register(adapters.nodeEndpoint)
        ledgerAppDriverRegistry.register(adapters.ledgerDriver)
        deviceChainAdapters.register(adapters.device)
        // The first EVM chain registered serves every EVM chain's links.
        if (!isSchemeClaimed(chain)) {
            deeplinkAdapters.register(adapters.deeplink)
        }
    }
}
