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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    createChainAdapterRegistry,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { LegacyAccount } from '@perawallet/wallet-extension-platform'
import type { MigrateAccountArgs } from './migrate/types'

/** The per-account steps of a Pera 6 migration; registered by the chain package. */
export interface MigrationChainAdapter {
    chainId: ChainId
    migrateAccount(args: MigrateAccountArgs): Promise<WalletAccount>
    /** Keyless accounts import after key-bearing ones, so a rekey target exists first. */
    isKeylessAccount(account: LegacyAccount): boolean
    /** Short label for the failure reason and log. */
    classifyAccountRoute(account: LegacyAccount): string
}

export const migrationChainAdapters =
    createChainAdapterRegistry<MigrationChainAdapter>('migration')

// Pera 6 data predates chain scopes, so every legacy account is the legacy chain's.
export const migrationAdapterFor = (): MigrationChainAdapter =>
    migrationChainAdapters.get(LEGACY_CHAIN_ID)
