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
import { ImportAccountType, WalletAccount } from '../models'

export type ImportHDPendingResult = {
    type: 'hdWallet'
    walletKeyId: string
    derivationType: BIP32DerivationType
}

export type ImportAccountResult = WalletAccount | ImportHDPendingResult

export const useImportAccount = () => {
    const { createAlgo25Key } = useKMS()
    const { createAlgo25WalletAccount } = useCreateAccount()
    const { prepareImport } = useHDImportSession()

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
        const { keyPair } = await createAlgo25Key({ mnemonic })
        return await createAlgo25WalletAccount({ id: keyPair.id })
    }
}
