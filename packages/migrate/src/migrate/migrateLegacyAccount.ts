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
import { logger, truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import type { LegacyAccount } from '@perawallet/wallet-extension-platform'
import { addKeylessAccountToStore } from './accountStoreOps'
import {
    buildLedgerAccount,
    buildMultiSigAccount,
    buildWatchAccount,
} from './buildKeylessAccount'
import { describeBytes } from './legacyKeyConversion'
import { migrateAlgo25Account } from './migrateAlgo25Account'
import { migrateHdAccount } from './migrateHdAccount'
import type { MigrateAccountArgs } from './types'

export const migrateLegacyAccount = async (
    args: MigrateAccountArgs,
): Promise<WalletAccount> => {
    const { account } = args

    if (account.type === 'watch')
        return addKeylessAccountToStore(buildWatchAccount(account))
    if (account.joint !== null)
        return addKeylessAccountToStore(buildMultiSigAccount(account))
    if (account.ledger !== null)
        return addKeylessAccountToStore(buildLedgerAccount(account))
    if (account.hdWalletId !== null) return migrateHdAccount(args)
    if (account.secretKey !== null && account.secretKey.length > 0)
        return migrateAlgo25Account(args)

    return migrateAccountWithoutSigningMaterial(account)
}

const migrateAccountWithoutSigningMaterial = (
    account: LegacyAccount,
): WalletAccount => {
    logger.warn('Legacy account has no signing material; migrating as watch', {
        detail: buildUnroutableAccountError(account),
    })
    return addKeylessAccountToStore(buildWatchAccount(account))
}

export const isKeylessLegacyAccount = (account: LegacyAccount): boolean =>
    account.type === 'watch' ||
    account.joint !== null ||
    account.ledger !== null

export type LegacyAccountRoute =
    | 'watch'
    | 'joint'
    | 'ledger'
    | 'hd'
    | 'algo25'
    | 'unroutable'

export const classifyLegacyAccountRoute = (
    account: LegacyAccount,
): LegacyAccountRoute => {
    if (account.type === 'watch') return 'watch'
    if (account.joint !== null) return 'joint'
    if (account.ledger !== null) return 'ledger'
    if (account.hdWalletId !== null) return 'hd'
    if (account.secretKey !== null && account.secretKey.length > 0)
        return 'algo25'
    return 'unroutable'
}

const buildUnroutableAccountError = (account: LegacyAccount): string =>
    `Cannot migrate ${truncateAlgorandAddress(account.address)}: type=${account.type}, ` +
    `secretKey=${describeBytes(account.secretKey)}, ` +
    `hdWalletId=${account.hdWalletId ?? 'null'}, ` +
    `ledger=${account.ledger ? 'set' : 'null'}, ` +
    `joint=${account.joint ? 'set' : 'null'}`
