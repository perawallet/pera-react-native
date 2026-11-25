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
    isEvmChainId,
    type ChainScope,
    type KnownSpender,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { eip155ChainIdOfNetwork } from '../blockchain/utils/caip19'
import { evmChainOf } from '../chains/table'
import { knownSpenderOf } from './known-contracts'

/** The bundled registry's name for a contract on `scope`'s network, as the review before signing shows it. */
export const knownEvmContractLabelOf = (
    scope: ChainScope,
    address: string,
): Optional<KnownSpender> =>
    isEvmChainId(scope.chainId)
        ? knownSpenderOf(
              eip155ChainIdOfNetwork(
                  evmChainOf(scope.chainId),
                  scope.networkId,
              ),
              address,
          )
        : undefined
