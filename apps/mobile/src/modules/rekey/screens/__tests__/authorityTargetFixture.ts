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

import { vi } from 'vitest'
import {
    accountsChainAdapters,
    useAccountsStore,
    type AccountsChainAdapter,
    type AuthorityTargetKind,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const watchAccount = (address: string): WalletAccount => ({
    id: address,
    name: address,
    custody: { kind: 'watch' },
    chains: { [LEGACY_CHAIN_ID]: { address } },
})

export const sourceAccount = watchAccount('SRC')
export const targetA = watchAccount('A')
export const targetB = watchAccount('B')

/**
 * Registers, under the selected chain's id, an accounts adapter whose
 * authority lists `targetKinds` and accepts, per kind id, the target ids
 * `eligible` names; the wallet holds the source and both targets. The
 * screens see only what the chain lists, as they would a real chain's.
 */
export const registerTargetFixtureChain = (
    targetKinds: readonly AuthorityTargetKind[],
    eligible: Readonly<Record<string, readonly string[]>>,
): AccountsChainAdapter => {
    const adapter = {
        chainId: LEGACY_CHAIN_ID,
        authority: {
            capability: 'rekey',
            fetchDelegatedAddresses: async () => [],
            targetKinds,
            isDelegated: () => false,
            accountsDelegatedTo: () => [],
            isEligibleTarget: vi.fn(
                (kindId: string, target: WalletAccount) =>
                    eligible[kindId]?.includes(target.id) ?? false,
            ),
            canSignProgram: () => false,
            isAuthorityDowngrade: () => false,
        },
    } as Partial<AccountsChainAdapter> as AccountsChainAdapter
    accountsChainAdapters.reset()
    accountsChainAdapters.register(adapter)
    useAccountsStore.getState().setAccounts([sourceAccount, targetA, targetB])
    return adapter
}
