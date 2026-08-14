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
import { migration as r0001 } from './0001-retire-hd-root-shadow'
import { migration as r0002 } from './0002-lift-nested-material'
import { migration as r0003 } from './0003-remove-layout-version-stamp'
import { migration as r0004 } from './0004-adopt-material-less-records'

/**
 * Permanent ledger key. Renaming it makes the engine believe this module has
 * never migrated and re-run every revision from zero.
 */
export const PREFLIGHT_MODULE_ID = 'com.perawallet.wallet/keystore-preflight'

/** Every preflight revision, ascending by id. */
export const preflightMigrations: readonly Migration<PeraMigrationContext>[] = [
    r0001,
    r0002,
    r0003,
    r0004,
]
