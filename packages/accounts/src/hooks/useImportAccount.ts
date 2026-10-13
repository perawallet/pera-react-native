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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useKMS } from '@perawallet/wallet-core-kms'
import { useCreateAccount } from './useCreateAccount'
import { useHDImportSession } from './useHDImportSession'
import { useAccountsStore } from '../store'
import type { WalletAccount } from '../models'
import { DuplicateAccountError } from '../errors'
import {
    accountsChainAdapters,
    requireSingleKeyAccounts,
    type LocalKeySeed,
} from '../chain-adapter'
import { findAddressHolder, seedOf } from '../credentials'
import { localKeyKindOf } from '../import-formats'

/** An HD import waits for the user to pick which discovered accounts to keep. */
export type ImportHDPendingResult = {
    kind: 'hd'
    walletKeyId: string
}

export type ImportAccountResult =
    | WalletAccount
    | WalletAccount[]
    | ImportHDPendingResult

export const useImportAccount = (scope: ChainScope) => {
    const { removeKeyAndChildren } = useKMS()
    const { saveAccount } = useCreateAccount(scope)
    const { prepareImport } = useHDImportSession(scope)

    // Shared by every single-key import: if the wallet already holds
    // this address, sweep the keystore entries the import attempt just
    // minted (seed + signing child) so repeated re-imports don't accumulate
    // orphans, then surface the duplicate.
    //
    // HD imports get the same protection at the selection screen — see
    // useImportSelectAddressesScreen, which filters already-imported
    // addresses out of the selectable set.
    //
    // A seed can back more than one account (a dual-derivation import puts
    // both on one seed record), so this must never delete a seed a SIBLING
    // account still depends on: a duplicate second account would otherwise
    // delete the first one's just-persisted signing key.
    const throwIfDuplicate = async (address: string, seedKeyId: string) => {
        const accounts = useAccountsStore.getState().accounts
        const holder = findAddressHolder(accounts, scope, address)
        if (!holder) return

        const seedStillNeeded = accounts.some(
            a => a !== holder && seedOf(a) === seedKeyId,
        )
        if (!seedStillNeeded) {
            try {
                await removeKeyAndChildren(seedKeyId)
            } catch {
                // Best-effort cleanup; don't shadow the duplicate error
                // with a keystore-removal failure.
            }
        }
        throw new DuplicateAccountError(address)
    }

    return async ({
        mnemonicIndices,
        seed,
    }: {
        /** Wordlist indices (`mnemonicWordsToIndices`) — never the phrase
         * itself. Caller owns zeroing after the import resolves. */
        mnemonicIndices: Uint16Array
        seed: LocalKeySeed
    }): Promise<ImportAccountResult> => {
        if (localKeyKindOf(scope.chainId, seed)?.isHd) {
            const { walletKeyId } = await prepareImport({
                mnemonicIndices,
            })
            return { kind: 'hd', walletKeyId }
        }

        return requireSingleKeyAccounts(
            accountsChainAdapters.get(scope.chainId),
        ).importMnemonic(
            {
                seed,
                mnemonicIndices,
                isHeld: address =>
                    !!findAddressHolder(
                        useAccountsStore.getState().accounts,
                        scope,
                        address,
                    ),
            },
            scope,
            async ({ account, seedKeyId }) => {
                const address = account.chains[scope.chainId]?.address
                if (address !== undefined) {
                    await throwIfDuplicate(address, seedKeyId)
                }
                await saveAccount(account)
            },
        )
    }
}
