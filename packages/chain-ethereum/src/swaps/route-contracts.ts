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

import type { Address } from 'viem'
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'

/**
 * The only contracts a swap may call, by scope key. A quote names none, so this
 * is the app's own record of them, and a scope with no entry fails closed.
 */
export const EVM_SWAP_ROUTE_CONTRACTS: Readonly<
    Record<string, readonly Address[]>
> = {}

export const evmSwapRouteContractsOf = (
    scope: ChainScope,
): readonly Address[] => EVM_SWAP_ROUTE_CONTRACTS[toScopeKey(scope)] ?? []
