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
import { zeroBytes } from '@perawallet/wallet-core-kms'
import type {
    LegacyHDKey,
    LegacyHDWallet,
} from '@perawallet/wallet-extension-platform'
import { hdWalletEntropyToIndices } from './legacyKeyConversion'
import type { ImportedHdRoot, MigrateAccountArgs } from './types'

export const migrateHdAccount = async (
    args: MigrateAccountArgs,
): Promise<WalletAccount> => {
    const { account, createHdWalletAccount } = args
    const { parent, childKey } = lookupHdParentAndChild(args)

    const root = await ensureHdRootImported(parent, args)

    const created = await createHdWalletAccount({
        seedKeyId: root.seedKeyId,
        account: childKey.account,
        keyIndex: childKey.keyIndex,
    })

    if (created.address !== account.address) {
        throw new Error(
            `Derived address ${created.address} did not match legacy address ${account.address}`,
        )
    }

    return created
}

const lookupHdParentAndChild = ({
    account,
    hdWalletsById,
}: MigrateAccountArgs): { parent: LegacyHDWallet; childKey: LegacyHDKey } => {
    const walletId = account.hdWalletId
    if (!walletId) throw new Error('HD account missing hdWalletId')

    const parent = hdWalletsById.get(walletId)
    if (!parent)
        throw new Error(`HD parent wallet ${walletId} not found in payload`)

    const childKey = parent.keys.find(k => k.address === account.address)
    if (!childKey) {
        throw new Error(
            `HD parent ${walletId} has no key entry for ${account.address}`,
        )
    }

    return { parent, childKey }
}

const ensureHdRootImported = async (
    parent: LegacyHDWallet,
    {
        importedHdRoots,
        createHDWalletKey,
        hasSeedWithEntropy,
    }: MigrateAccountArgs,
): Promise<ImportedHdRoot> => {
    const cached = importedHdRoots.get(parent.walletId)
    if (cached) return cached

    if (hasSeedWithEntropy(parent.walletId)) {
        const reused: ImportedHdRoot = { seedKeyId: parent.walletId }
        importedHdRoots.set(parent.walletId, reused)
        return reused
    }

    const mnemonicIndices = hdWalletEntropyToIndices(parent)
    try {
        const { seedKey } = await createHDWalletKey({
            id: parent.walletId,
            mnemonicIndices,
        })

        const root: ImportedHdRoot = {
            seedKeyId: seedKey.id ?? parent.walletId,
        }
        importedHdRoots.set(parent.walletId, root)
        zeroBytes(parent.entropy)
        return root
    } finally {
        zeroBytes(mnemonicIndices)
    }
}
