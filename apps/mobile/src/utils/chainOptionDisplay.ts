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

import type { AccountChainOption } from '@perawallet/wallet-core-accounts'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'

export type DisplayedChainOption<T extends AccountChainOption> = T & {
    displayName: string
}

/** Names the option's chain and truncates its address with the chain's codec, for a row label. */
export const displayChainOption = <T extends AccountChainOption>(
    option: T,
): DisplayedChainOption<T> => ({
    ...option,
    displayName: chainDisplayNameOf(option.chainId) ?? option.chainId,
    address:
        option.address &&
        addressCodecs.get(option.chainId).truncate(option.address),
})
