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
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

/**
 * Whether the chain only holds an asset the account opted in to. A chain this
 * build doesn't register is not one: the lookup throws for it.
 */
export const isOptInChain = (chainId: ChainId): boolean =>
    getProvider().chains.has(chainId) &&
    getChainDescriptor(chainId).protocol.requiresAssetOptIn
