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
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainCapability,
    type ChainCapabilityRestrictions,
} from '@perawallet/wallet-core-chain-contract'
import type { EvmChainRow } from './chains/types'

// Each needs an adapter in every registry CAPABILITY_ADAPTERS lists for it; the app's parity spec fails otherwise.
const ENABLED: ReadonlySet<ChainCapability> = new Set<ChainCapability>([
    'send',
    'receive',
    'history',
    'assets',
    'assetSearch',
    'pricing',
    'priceHistory',
    'balanceHistory',
    'watchAccounts',
    'privateKeys',
    'dappConnect',
    'messageSigning',
    'ledger',
    'nft',
    'nameService',
    // Fail-safe on every chain: a contract neither the bundled registry nor
    // the backend knows is shown as an unrecognised call.
    'contractDecoding',
    // Still behind the app-wide enable_cloud_backup flag, as for Algorand.
    'cloudBackup',
    'discover',
    // Its candidate pairs come from the approvals service, so a scope without it shows the list's error, never a wrong one.
    'tokenApprovals',
])

// Off by default but safe for remote config to switch on: no Algorand-only code,
// and no Pera endpoint a scope without a deployment could reach. A chain row turns
// these on where its routes and providers exist. Anything else stays off.
const SWITCHABLE: readonly ChainCapability[] = ['onramp', 'swap']

const SUPPORTED: readonly ChainCapability[] = [...ENABLED, ...SWITCHABLE]

// Off unless listed, so a capability added later starts off. Every EVM chain
// starts from this set because they register the same adapters; a row's
// `capabilities` layers over it.
export const evmCapabilityDefaults = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, ENABLED.has(capability)]),
) as ChainCapabilities

export const evmCapabilityDefaultsOf = (row: EvmChainRow): ChainCapabilities =>
    row.capabilities
        ? { ...evmCapabilityDefaults, ...row.capabilities }
        : evmCapabilityDefaults

// A capability a row switches on is supported on that chain alone, so the
// parity spec asks for its adapter there and on no other EVM chain.
export const evmSupportedCapabilitiesOf = (
    row: EvmChainRow,
): readonly ChainCapability[] => {
    const rowOnly = CHAIN_CAPABILITIES.filter(
        capability =>
            row.capabilities?.[capability] && !SUPPORTED.includes(capability),
    )
    return rowOnly.length > 0 ? [...SUPPORTED, ...rowOnly] : SUPPORTED
}

// onramp buys real tokens, so a test network never offers it, whatever remote config says.
export const evmCapabilityRestrictionsOf = (
    row: EvmChainRow,
): ChainCapabilityRestrictions => ({
    onramp: ['developer', 'developer-override'],
    ...row.restrictions,
})
