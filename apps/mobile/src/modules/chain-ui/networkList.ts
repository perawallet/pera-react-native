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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'

/** "Base", "Base and BNB Chain", "Base, BNB Chain and Arbitrum One". */
export const networkListOf = (
    chainIds: readonly ChainId[],
    t: (key: string, options?: Record<string, unknown>) => string,
): string => {
    const names = chainIds.map(
        chainId => chainDisplayNameOf(chainId) ?? chainId,
    )
    // Hermes has no Intl.ListFormat, so the final conjunction is translated.
    return names.length < 2
        ? (names[0] ?? '')
        : t('common.networks_list', {
              first: names.slice(0, -1).join(', '),
              last: names.at(-1),
          })
}
