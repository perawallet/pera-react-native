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

let client: AlgorandClient | undefined

/**
 * The app's own client factory pointed at LocalNet, so the suites exercise the
 * same `TimeoutHttpClient` transport and error transformer the wallet ships.
 * Memoised: every suite calls this (directly or via `balanceOf`/`authAddrOf`)
 * on nearly every assertion, and a fresh client per call was otherwise the
 * common case rather than the exception.
 */
export const getConformanceClient = (): AlgorandClient => {
    client ??= createTimeoutBoundedAlgorandClient({
        algodUrl: LOCALNET_ALGOD_URL,
        algodToken: LOCALNET_TOKEN,
        indexerUrl: LOCALNET_INDEXER_URL,
        indexerToken: '',
    })
    return client
}

/** The sender's ALGO balance, read fresh from the node. */
export const balanceOf = async (address: string): Promise<bigint> =>
    (await getConformanceClient().account.getInformation(address)).balance
        .microAlgo

/** The account's `auth-addr`, or `undefined` if it is not rekeyed. */
export const authAddrOf = async (
    address: string,
): Promise<string | undefined> =>
    (
        await getConformanceClient()
            .client.algod.accountInformation(address)
            .do()
    ).authAddr?.toString()
