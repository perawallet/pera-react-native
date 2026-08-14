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

import type { Migration } from '@algorandfoundation/provider-migrations'
import type { PeraMigrationContext } from '../types'
import { migration as r0001 } from './0001-normalize-canary13-records'

/**
 * Permanent ledger key. Renaming it makes the engine believe this module has
 * never migrated and re-run every revision from zero.
 */
export const REPAIRS_MODULE_ID = 'com.perawallet.wallet/keystore-repairs'

/** Every repair revision, ascending by id. */
export const repairsMigrations: readonly Migration<PeraMigrationContext>[] = [
    r0001,
]
