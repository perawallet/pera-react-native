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

import type { Key } from '@algorandfoundation/keystore-core'
import { AccessControlPermission } from '../models'
import { aclOf } from '../utils'
import { KeyAccessError } from '../errors'

// `aclOf` always returns a non-empty ACL (the wallet's own-origin default for
// seeds without an explicit one), so this is fail-closed: a domain not granted
// ReadPrivate is rejected rather than slipping through the old empty-ACL bypass.
export const canAccess = (key: Key, domain: string): boolean =>
    aclOf(key).some(
        entry =>
            entry.domains.includes(domain) &&
            entry.permissions.includes(AccessControlPermission.ReadPrivate),
    )

export const checkAccess = (key: Key, domain: string): void => {
    if (!canAccess(key, domain)) {
        throw new KeyAccessError()
    }
}
