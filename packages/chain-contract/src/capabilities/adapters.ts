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
 * The feature registries a chain must hold an adapter in before it may enable
 * each capability. Names match the `feature` string each registry passes to
 * `createChainAdapterRegistry` (or, for the Ledger app driver, its own
 * equivalent), so a parity failure names the registry to register into.
 *
 * A capability with no entry goes unchecked. That is right when it needs no
 * chain adapter of its own (chain-neutral code or the Pera backend serves it)
 * or its feature has no registry yet (`staking`, …); add an entry whenever a
 * chain could enable it without an adapter it needs.
 */
export const CAPABILITY_ADAPTERS = {
    send: [
        'send flow',
        'planner',
        'reviewer',
        'local-key signer',
        'broadcaster',
    ],
    receive: ['addressCodec'],
    history: ['transaction history'],
    assets: ['assets'],
    pricing: ['assets'],
    messageSigning: ['message signer'],
    dappConnect: ['dapp-request', 'planner', 'reviewer', 'local-key signer'],
    watchAccounts: ['accounts', 'addressCodec'],
    ledger: ['ledger app driver', 'planner', 'reviewer'],
    multisig: ['multisig', 'planner', 'reviewer'],
    swap: ['swap'],
    card: ['card'],
    nameService: ['name service'],
    onramp: ['ramp'],
    cloudBackup: ['accounts'],
    mnemonicBackup: ['backup'],
    secureBackup: ['backup'],
    privateKeys: ['accounts'],
} as const satisfies Partial<Record<ChainCapability, readonly string[]>>

export type CapabilityAdapterName =
    (typeof CAPABILITY_ADAPTERS)[keyof typeof CAPABILITY_ADAPTERS][number]
