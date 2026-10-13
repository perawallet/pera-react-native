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

import type { ChainCapability } from '../models/capabilities'

/**
 * Maps a capability that needs a real implementation to the name of the
 * feature registry that serves it. Values match the `feature` string each
 * registry passes to `createChainAdapterRegistry` (or, for the Ledger app
 * driver, its own equivalent), so an error message and this list name the
 * same thing.
 *
 * A capability with no registry yet (`staking`, …) has no entry;
 * add one only once its registry exists, or the parity test would have
 * nothing to check it against.
 */
export const CAPABILITY_ADAPTERS = {
    send: 'send flow',
    history: 'transaction history',
    assets: 'assets',
    pricing: 'assets',
    messageSigning: 'message signer',
    multisig: 'multisig',
    secureBackup: 'backup',
    swap: 'swap',
    nameService: 'name service',
    card: 'card',
    onramp: 'ramp',
    dappConnect: 'dapp-request',
    ledger: 'ledger app driver',
} as const satisfies Partial<Record<ChainCapability, string>>

export type CapabilityAdapterName =
    (typeof CAPABILITY_ADAPTERS)[keyof typeof CAPABILITY_ADAPTERS]
