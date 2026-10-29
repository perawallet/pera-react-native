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

import { getProvider } from '@perawallet/wallet-extension-provider'
import type {
    ChainFamily,
    ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'

/**
 * The contact entry a linked address fills. Contacts key addresses by family,
 * which only the chain's descriptor knows; no chain is an in-app open, which
 * edits the Algorand entry.
 */
export const contactFamilyOf = (chainId: Optional<ChainId>): ChainFamily =>
    chainId === undefined
        ? 'algorand'
        : getProvider().chains.get(chainId).descriptor.family
