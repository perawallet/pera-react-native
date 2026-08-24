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

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'

import { createTimeoutBoundedAlgorandClient } from '@perawallet/wallet-core-blockchain/utils/createAlgorandClient'

import {
    LOCALNET_ALGOD_URL,
    LOCALNET_INDEXER_URL,
    LOCALNET_TOKEN,
} from './localnet'

/**
 * The app's own client factory pointed at LocalNet, so the suites exercise the
 * same `TimeoutHttpClient` transport and error transformer the wallet ships.
 */
export const getConformanceClient = (): AlgorandClient =>
    createTimeoutBoundedAlgorandClient({
        algodUrl: LOCALNET_ALGOD_URL,
        algodToken: LOCALNET_TOKEN,
        indexerUrl: LOCALNET_INDEXER_URL,
        indexerToken: '',
    })
