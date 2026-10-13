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

import type { BackupChainAdapter } from '@perawallet/wallet-core-backup'
import { encodeAlgorandAddress } from '../blockchain'
import { SIGNING_ACCESS_DOMAIN } from '@perawallet/wallet-core-kms'
import { ALGORAND_HD_DERIVATION_TYPE } from '../accounts/constants'
import { algorandHdDerivationRequest } from '../accounts/hd-derivation'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { HdDerivationTypeUnsupportedError } from '../accounts/errors'
import {
    algorandBackupKindIdOf,
    algorandBackupLocalKindOf,
    algorandMnemonicBackupKeyId,
    serializeAlgorandAccount,
    serializeAlgorandMnemonicSecret,
} from './serialize-account'
import { useAsbAccountImport } from './asb/useAsbAccountImport'
import { decryptBackupPayload } from './asb/decrypt-backup-payload'
import { parseBackupEnvelope } from './asb/parse-backup-envelope'
import { partitionImportableAccounts } from './asb/partition-importable-accounts'
import { useImportAlgo25FromSeed } from './useImportAlgo25FromSeed'

const deriveHdAccount: BackupChainAdapter['deriveHdAccount'] = async (
    kms,
    seedKeyId,
    { account, keyIndex, derivationType },
) => {
    // A backup payload's derivation type is unvalidated; deriving any other
    // type would commit a key that doesn't match the account it restores.
    if (
        derivationType !== undefined &&
        derivationType !== ALGORAND_HD_DERIVATION_TYPE
    ) {
        throw new HdDerivationTypeUnsupportedError(derivationType)
    }
    const key = await kms.deriveFromSeed(
        seedKeyId,
        algorandHdDerivationRequest(
            seedKeyId,
            account,
            keyIndex,
            ALGORAND_HD_DERIVATION_TYPE,
        ),
        SIGNING_ACCESS_DOMAIN,
    )
    return { ...key, address: encodeAlgorandAddress(key.publicKey) }
}

export const algorandBackupAdapter: BackupChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    // The cloud backup files a seed under its first Peikert address; changing
    // the derivation would orphan every existing backup.
    seedReference: async (kms, seedKeyId) =>
        (
            await deriveHdAccount(kms, seedKeyId, {
                account: 0,
                keyIndex: 0,
                derivationType: ALGORAND_HD_DERIVATION_TYPE,
            })
        ).address,
    deriveHdAccount,
    serializeAccount: serializeAlgorandAccount,
    localKindOf: algorandBackupLocalKindOf,
    kindIdOf: algorandBackupKindIdOf,
    serializeMnemonicSecret: serializeAlgorandMnemonicSecret,
    mnemonicBackupKeyId: algorandMnemonicBackupKeyId,
    useImportFromSeed: () => useImportAlgo25FromSeed().importFromSeed,
    secureBackup: {
        parseEnvelope: parseBackupEnvelope,
        decryptPayload: decryptBackupPayload,
        partitionImportable: partitionImportableAccounts,
        useImportAccount: () => useAsbAccountImport().importAccount,
    },
}
