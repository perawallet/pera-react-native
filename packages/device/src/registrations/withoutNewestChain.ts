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

import { CHAIN_IDS } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { DeviceAccountRegistration } from '../models'

/**
 * The registration without the chain latest in `CHAIN_IDS` order, or `null`
 * once one chain is left. The devices API's 422 body is only `{ error, code }`
 * and never names the refused chain, so this guesses: that list is
 * append-only, which makes the last chain present the likeliest the backend
 * doesn't know yet, and the first the one it has accepted longest.
 */
export const withoutNewestChain = (
    accounts: readonly DeviceAccountRegistration[],
): Nullable<DeviceAccountRegistration[]> => {
    const held = new Set(accounts.map(account => account.chainId))
    const present = CHAIN_IDS.filter(chainId => held.has(chainId))
    if (present.length <= 1) return null
    const newest = present[present.length - 1]
    return accounts.filter(account => account.chainId !== newest)
}
