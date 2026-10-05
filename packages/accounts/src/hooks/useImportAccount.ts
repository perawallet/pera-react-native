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

import { useNetwork } from '@perawallet/wallet-core-chain-shared'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { useKMS } from '@perawallet/wallet-core-kms'
import { useCreateAccount } from './useCreateAccount'
import { useHDImportSession } from './useHDImportSession'
import { useAccountsStore } from '../store'
import {
    type DerivationType,
    type ImportAccountType,
    type WalletAccount,
} from '../models'
import { DuplicateAccountError } from '../errors'
import { accountsAdapterFor, requireSingleKeyAccounts } from '../chain-adapter'

export type ImportHDPendingResult = {
    type: 'hdWallet'
    walletKeyId: string
    derivationType: DerivationType
}

export type ImportAccountResult =
    | WalletAccount
    | WalletAccount[]
    | ImportHDPendingResult

export const useImportAccount = () => {
    const kms = useKMS()
    const { removeKeyAndChildren, seedIdOf } = kms
    const { saveAccount } = useCreateAccount()
    const { prepareImport } = useHDImportSession()
    const { network } = useNetwork()

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
        const isDuplicate = accounts.some(a => a.address === address)
        if (!isDuplicate) return

        const seedStillNeeded = accounts.some(
            a => a.address !== address && seedIdOf(a.keyPairId) === seedKeyId,
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
        type,
    }: {
        /** Wordlist indices (`mnemonicWordsToIndices`) — never the phrase
         * itself. Caller owns zeroing after the import resolves. */
        mnemonicIndices: Uint16Array
        type: ImportAccountType
    }): Promise<ImportAccountResult> => {
        if (type === 'hdWallet') {
            const { walletKeyId, derivationType } = await prepareImport({
                mnemonicIndices,
            })
            return { type: 'hdWallet', walletKeyId, derivationType }
        }

        return requireSingleKeyAccounts(
            accountsAdapterFor(network),
        ).importMnemonic(
            kms,
            {
                kind: type,
                mnemonicIndices,
                isHeld: address =>
                    useAccountsStore
                        .getState()
                        .accounts.some(a => a.address === address),
            },
            scopeForLegacyNetwork(network),
            async ({ account, seedKeyId }) => {
                await throwIfDuplicate(account.address, seedKeyId)
                await saveAccount(account)
            },
        )
    }
}
