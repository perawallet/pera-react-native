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

import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { useKMS } from '@perawallet/wallet-core-kms'
import { useCreateAccount } from './useCreateAccount'
import { useHDImportSession } from './useHDImportSession'
import { useAllAccounts } from './useAllAccounts'
import { ImportAccountType, WalletAccount } from '../models'
import { DuplicateAccountError } from '../errors'

export type ImportHDPendingResult = {
    type: 'hdWallet'
    walletKeyId: string
    derivationType: BIP32DerivationType
}

export type ImportAccountResult = WalletAccount | ImportHDPendingResult

export const useImportAccount = () => {
    const { createAlgo25Key, removeKeyAndChildren } = useKMS()
    const { createAlgo25WalletAccount } = useCreateAccount()
    const { prepareImport } = useHDImportSession()
    const allAccounts = useAllAccounts()

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
        // Algo25: derive the key, then check whether the wallet already holds
        // this address before persisting the account. If it does, roll back
        // the keystore key we just minted so the keystore doesn't accumulate
        // orphan entries on repeated re-import attempts.
        //
        // HD imports get the same protection at the selection screen — see
        // useImportSelectAddressesScreen, which filters already-imported
        // addresses out of the selectable set.
        const { seedKey, address } = await createAlgo25Key({ mnemonic })
        const isDuplicate = allAccounts.some(a => a.address === address)
        if (isDuplicate) {
            try {
                // `createAlgo25Key` mints both the seed and its Ed25519
                // signing child; we need to sweep both, not just the seed.
                await removeKeyAndChildren(seedKey.id)
            } catch {
                // Best-effort cleanup; don't shadow the duplicate error
                // with a keystore-removal failure.
            }
            throw new DuplicateAccountError(address)
        }
        return await createAlgo25WalletAccount({
            seed: { seedKeyId: seedKey.id, address },
        })
    }
}
