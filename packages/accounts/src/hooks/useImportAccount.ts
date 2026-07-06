/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { type BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { useKMS } from '@perawallet/wallet-core-kms'
import { useCreateAccount } from './useCreateAccount'
import { useHDImportSession } from './useHDImportSession'
import { useAccountsStore } from '../store'
import { type ImportAccountType, type WalletAccount } from '../models'
import { DuplicateAccountError } from '../errors'

export type ImportHDPendingResult = {
    type: 'hdWallet'
    walletKeyId: string
    derivationType: BIP32DerivationType
}

export type ImportAccountResult = WalletAccount | ImportHDPendingResult

export const useImportAccount = () => {
    const { createAlgo25Key, createQuantumKey, removeKeyAndChildren } = useKMS()
    const { createAlgo25WalletAccount, createQuantumWalletAccount } =
        useCreateAccount()
    const { prepareImport } = useHDImportSession()

    // Shared by the algo25 and quantum branches: if the wallet already holds
    // this address, sweep the keystore entries the import attempt just
    // minted (seed + signing child) so repeated re-imports don't accumulate
    // orphans, then surface the duplicate.
    //
    // HD imports get the same protection at the selection screen — see
    // useImportSelectAddressesScreen, which filters already-imported
    // addresses out of the selectable set.
    const throwIfDuplicate = async (address: string, seedKeyId: string) => {
        const isDuplicate = useAccountsStore
            .getState()
            .accounts.some(a => a.address === address)
        if (!isDuplicate) return
        try {
            await removeKeyAndChildren(seedKeyId)
        } catch {
            // Best-effort cleanup; don't shadow the duplicate error
            // with a keystore-removal failure.
        }
        throw new DuplicateAccountError(address)
    }

    return async ({
        mnemonic,
        type,
    }: {
        mnemonic: string
        type: ImportAccountType
    }): Promise<ImportAccountResult> => {
        if (type === 'hdWallet') {
            const { walletKeyId, derivationType } = await prepareImport({
                mnemonic,
            })
            return { type: 'hdWallet', walletKeyId, derivationType }
        }

        if (type === 'quantum') {
            // A quantum mnemonic is 25 words — indistinguishable from algo25
            // by count. Reaching this branch requires the caller to have
            // picked quantum EXPLICITLY (dedicated entrypoint, PQ-009);
            // resolveImportAccountType never auto-detects it.
            const { seedKey, address } = await createQuantumKey({ mnemonic })
            await throwIfDuplicate(address, seedKey.id)
            return await createQuantumWalletAccount({
                seed: { seedKeyId: seedKey.id, address },
            })
        }

        // Algo25: derive the key, then check whether the wallet already holds
        // this address before persisting the account.
        const { seedKey, address } = await createAlgo25Key({ mnemonic })
        await throwIfDuplicate(address, seedKey.id)
        return await createAlgo25WalletAccount({
            seed: { seedKeyId: seedKey.id, address },
        })
    }
}
