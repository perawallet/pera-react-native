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

// A runtime list, not just a union, so the descriptor contract can check a
// module's defaults declare every key.
export const CHAIN_CAPABILITIES = [
    'send',
    'receive',
    'history',
    'assets',
    'pricing',
    'messageSigning',
    'dappConnect',
    'customNetworks',
    'watchAccounts',
    'ledger',
    'multisig',
    'rekey',
    'quantumAccounts',
    'staking',
    'swap',
    'card',
    'assetInbox',
    'nameService',
    'onramp',
    'giftCards',
    'discover',
    'feeDelegation',
    'arc0027',
    'liquidAuth',
    'notifications',
    'cloudBackup',
    'mnemonicBackup',
    // Algorand Secure Backup files.
    'secureBackup',
    'nft',
    // Adding, removing, opting in to and opting out of assets by hand.
    'manageAssets',
    // Importing an account from a raw private key, and revealing it.
    'privateKeys',
    // Decoding dApp contract calls with bundled ABIs and warning on approvals.
    'contractDecoding',
] as const

/**
 * A switchable, user-facing feature a chain offers. Intrinsic chain facts
 * belong on `ChainDescriptor`, never here.
 *
 * A capability that resolves to false hides every element that triggers it;
 * the UI never renders it disabled.
 *
 * Values are layered, each overriding the one before: the chain module's
 * `capabilityDefaults`, the composition root's bootstrap overrides, remote
 * config, then the developer Feature Flags screen (see `resolveCapability`).
 */
export type ChainCapability = (typeof CHAIN_CAPABILITIES)[number]

export type ChainCapabilities = Readonly<Record<ChainCapability, boolean>>

/** `build` covers both a module's defaults and bootstrap overrides. */
export type CapabilitySource = 'build' | 'remote' | 'developer'
