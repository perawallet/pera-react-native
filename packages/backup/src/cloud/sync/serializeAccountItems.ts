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
import { backupAdapterFor, type BackupHdContext } from '../../chain-adapter'
import {
    accountItemKey,
    secretsItemKey,
    BackupItemType,
    type SecretsBackupPayload,
} from '../models'
import type { ItemKeyHasher } from '../crypto/itemKeyHash'
import type { SerializedAccount } from './types'

type SerializeParams = {
    /** Epoch millis to stamp on the address payload (LWW). */
    updatedAt: number
    /** Secrets payload from KMS, or null for secret-less account types. */
    secrets: SecretsBackupPayload | null
    hashAddress: ItemKeyHasher
    /** Resolved HD derivation data; REQUIRED for HD accounts (the account
     *  carries neither its derived public key nor the seed's first address). */
    hd?: BackupHdContext
}

export const serializeAccountItems = (
    account: WalletAccount,
    { updatedAt, secrets, hd, hashAddress }: SerializeParams,
): SerializedAccount | null => {
    const addressPayload = backupAdapterFor().serializeAccount(account, {
        updatedAt,
        hd,
    })
    if (addressPayload === null) return null

    const address = {
        key: accountItemKey(hashAddress(addressPayload.address)),
        type: BackupItemType.ACCOUNT,
        payload: addressPayload,
    }
    const secretsItem = secrets
        ? {
              key: secretsItemKey(hashAddress(addressPayload.address)),
              type: BackupItemType.ACCOUNT,
              payload: secrets,
          }
        : null
    return { address, secrets: secretsItem }
}
