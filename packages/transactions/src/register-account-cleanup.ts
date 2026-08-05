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

import {
    registerAccountCleanup,
    type AccountCleanupContext,
} from '@perawallet/wallet-core-shared'
import type { Database } from '@perawallet/wallet-core-database'
import { deleteTransactionsForAccount } from './db/repository'

/**
 * Prunes an account's transaction rows when it is removed. Registered with the
 * shared cleanup registry so `packages/accounts` can trigger it without
 * importing this package — a direct import would cycle, since transactions
 * already depends on accounts.
 */
export const cleanupTransactionsForAccount = ({
    db,
    accountAddress,
}: AccountCleanupContext): Promise<void> =>
    // `db` is typed `unknown` by the registry to keep `shared` database-free;
    // it is the same Database handle the removal flow resolved.
    deleteTransactionsForAccount({
        db: db as Database | undefined,
        accountAddress,
    })

registerAccountCleanup(cleanupTransactionsForAccount)
