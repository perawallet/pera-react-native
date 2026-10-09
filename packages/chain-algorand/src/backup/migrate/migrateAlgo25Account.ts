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
import { SeedScheme, zeroBytes } from '@perawallet/wallet-core-kms'
import { algorandAddressOf } from '../../accounts/vocabulary'
import { algo25SecretKeyToIndices } from './legacyKeyConversion'
import type { MigrateAccountArgs } from '@perawallet/wallet-core-migrate'

export const migrateAlgo25Account = async ({
    account,
    importAccount,
}: MigrateAccountArgs): Promise<WalletAccount> => {
    if (!account.secretKey)
        throw new Error('Algo25 account is missing secretKey')

    let mnemonicIndices: Uint16Array | null = null
    try {
        mnemonicIndices = algo25SecretKeyToIndices(account.secretKey)
        const created = await importAccount({
            mnemonicIndices,
            seed: SeedScheme.Algo25,
        })

        if (Array.isArray(created) || !('custody' in created)) {
            throw new Error(
                'algo25 import unexpectedly returned a pending HD result',
            )
        }

        const createdAddress = algorandAddressOf(created)
        if (createdAddress !== account.address) {
            throw new Error(
                `Imported algo25 address ${createdAddress} did not match legacy address ${account.address}`,
            )
        }

        return created
    } finally {
        zeroBytes(account.secretKey, mnemonicIndices)
    }
}
