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

import { accountsChainAdapters } from '@perawallet/wallet-core-accounts'
import { assetsChainAdapters } from '@perawallet/wallet-core-assets'
import { backupChainAdapters } from '@perawallet/wallet-core-backup'
import {
    addressCodecs,
    keyDerivations,
} from '@perawallet/wallet-core-chain-contract'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections'
import { migrationChainAdapters } from '@perawallet/wallet-core-migrate'
import { ledgerAppDriverRegistry } from '@perawallet/wallet-extension-hardware-wallet'
import { swapChainAdapters } from '@perawallet/wallet-core-swaps'
import { algorandDappRequestAdapter } from './connect/dappRequestAdapter'
import {
    historyChainAdapters,
    sendFlowChainAdapters,
} from '@perawallet/wallet-core-transactions'
import { algorandHistoryAdapter, algorandSendFlowAdapter } from './transactions'
import { nameServiceChainAdapters } from '@perawallet/wallet-core-nfd'
import { algorandLedgerAppDriver } from './ledger/driver'
import { algorandSwapAdapter } from './swaps'
import {
    broadcasterChainAdapters,
    localKeySignerChainAdapters,
    messageSignerChainAdapters,
    plannerChainAdapters,
    reviewerChainAdapters,
} from '@perawallet/wallet-core-signing'
import {
    algorandBroadcasterAdapter,
    algorandLocalKeySignerAdapter,
    algorandMessageSignerAdapter,
    algorandPlannerAdapter,
    algorandReviewerAdapter,
} from './signing'
import { algorandAssetsAdapter } from './assets'
import { algorandNameServiceAdapter } from './nfd'
import { cardChainAdapters } from '@perawallet/wallet-core-card'
import { multisigChainAdapters } from '@perawallet/wallet-core-multisig'
import { rampChainAdapters } from '@perawallet/wallet-core-onramp'
import { algorandBackupAdapter, algorandMigrationAdapter } from './backup'
import { algorandCardAdapter } from './card'
import { algorandMultisigAdapter } from './multisig'
import { algorandRampAdapter } from './onramp'
import {
    algorandAccountsAdapter,
    algorandAddressCodec,
    algorandKeyDerivation,
} from './accounts'
import { startNetworkRekeySync } from './accounts/network-rekey-sync'

// These registrations must not depend on which barrel loads first.
import './blockchain/store/store'
import './blockchain/store/custom-network'
import './blockchain/utils/algorandClient'

// Adapters must be module-level instances, not built in here: the registries
// ignore a repeat of the same instance but reject a new one, which is what
// keeps a second call harmless.
export const registerChain = (): void => {
    addressCodecs.register(algorandAddressCodec)
    keyDerivations.register(algorandKeyDerivation)
    accountsChainAdapters.register(algorandAccountsAdapter)
    assetsChainAdapters.register(algorandAssetsAdapter)
    ledgerAppDriverRegistry.register(algorandLedgerAppDriver)
    swapChainAdapters.register(algorandSwapAdapter)
    dappRequestChainAdapters.register(algorandDappRequestAdapter)
    sendFlowChainAdapters.register(algorandSendFlowAdapter)
    historyChainAdapters.register(algorandHistoryAdapter)
    nameServiceChainAdapters.register(algorandNameServiceAdapter)
    cardChainAdapters.register(algorandCardAdapter)
    rampChainAdapters.register(algorandRampAdapter)
    multisigChainAdapters.register(algorandMultisigAdapter)
    broadcasterChainAdapters.register(algorandBroadcasterAdapter)
    reviewerChainAdapters.register(algorandReviewerAdapter)
    plannerChainAdapters.register(algorandPlannerAdapter)
    localKeySignerChainAdapters.register(algorandLocalKeySignerAdapter)
    backupChainAdapters.register(algorandBackupAdapter)
    migrationChainAdapters.register(algorandMigrationAdapter)
    messageSignerChainAdapters.register(algorandMessageSignerAdapter)
    startNetworkRekeySync()
}
