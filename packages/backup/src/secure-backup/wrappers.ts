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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { backupAdapterFor } from '../chain-adapter'
import type {
    SecureBackupAccount,
    SecureBackupEnvelope,
    SecureBackupImportablePartition,
    SecureBackupPayload,
} from './models'

export type UseSecureBackupAccountImportResult = {
    importAccount: (account: SecureBackupAccount) => Promise<WalletAccount>
}

export const parseBackupEnvelope = (
    raw: string,
    chainId: ChainId,
): SecureBackupEnvelope =>
    backupAdapterFor(chainId).secureBackup.parseEnvelope(raw)

export const decryptBackupPayload = (
    envelope: SecureBackupEnvelope,
    recoveryIndices: Uint16Array,
    chainId: ChainId,
): SecureBackupPayload =>
    backupAdapterFor(chainId).secureBackup.decryptPayload(
        envelope,
        recoveryIndices,
    )

export const partitionImportableAccounts = (
    accounts: SecureBackupAccount[],
    existingAccounts: WalletAccount[],
    chainId: ChainId,
): SecureBackupImportablePartition =>
    backupAdapterFor(chainId).secureBackup.partitionImportable(
        accounts,
        existingAccounts,
    )

export const useSecureBackupAccountImport = (
    chainId: ChainId,
): UseSecureBackupAccountImportResult => ({
    importAccount: backupAdapterFor(chainId).secureBackup.useImportAccount(),
})

export const secureBackupRecoveryWordCount = (chainId: ChainId): number =>
    backupAdapterFor(chainId).secureBackup.recoveryWordCount
