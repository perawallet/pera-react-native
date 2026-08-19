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

import { PREFLIGHT_MODULE_ID } from './migrations/preflight'
import { REPAIRS_MODULE_ID } from './migrations/repairs'

/**
 * Upstream keystore-core's module id — a private literal inside
 * `@algorandfoundation/react-native-keystore`. Resetting Repairs (our own id) is
 * the normal recovery lever, so drift on this literal is low-impact.
 */
export const UPSTREAM_KEYSTORE_MODULE_ID =
    '@algorandfoundation/react-native-keystore'

export type KeystoreMigrationModuleDescriptor = { id: string; label: string }

/** The keystore migration modules, in run order (preflight → upstream core → repairs). */
export const KEYSTORE_MIGRATION_MODULES: readonly KeystoreMigrationModuleDescriptor[] =
    [
        { id: PREFLIGHT_MODULE_ID, label: 'Preflight' },
        { id: UPSTREAM_KEYSTORE_MODULE_ID, label: 'Keystore core (upstream)' },
        { id: REPAIRS_MODULE_ID, label: 'Repairs' },
    ]
