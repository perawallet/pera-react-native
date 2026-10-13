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
import { InvalidKeyError, KeyNotFoundError } from '../errors'
import { isSeedKey } from '../utils'

export const parentIdOf = (key: Key | undefined): string | undefined => {
    const parentKeyId = (key?.metadata as Record<string, unknown> | undefined)
        ?.parentKeyId
    return typeof parentKeyId === 'string' ? parentKeyId : undefined
}

/**
 * The seed key that minted `childKeyId`, resolved from a keystore snapshot.
 *
 * A seed id passed directly is accepted as a convenience for callers that
 * haven't migrated to child ids — the same allowance `useKMS.resolveSeedKey`
 * makes, and the reason `resolvePQSigningInfo`'s mismatch guard has to exist.
 *
 * Key EXPIRY is deliberately not checked here: sweeping an expired seed means
 * deleting it, which is the store binding's job (`useKMS.getKey`), not a pure
 * function's. A caller reaching this directly with its own snapshot — as the
 * conformance harness does — gets no expiry enforcement.
 */
export const resolveSeedKeyFrom = (
    keys: readonly Key[],
    childKeyId: string,
): Key => {
    const parentId = parentIdOf(keys.find(k => k.id === childKeyId))
    if (!parentId) {
        const direct = keys.find(k => k.id === childKeyId)
        if (!direct) throw new KeyNotFoundError(childKeyId)
        if (isSeedKey(direct)) return direct
        throw new InvalidKeyError(childKeyId)
    }
    const seed = keys.find(k => k.id === parentId)
    if (!seed) throw new KeyNotFoundError(parentId)
    return seed
}
