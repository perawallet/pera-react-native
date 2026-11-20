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

const SALT_LENGTH = 16
const MARK = Uint8Array.from([0x70, 0x6b, 0x76, 0x31])

// The mark rides in the KDF salt: stripping it changes the derived key, so a
// profile writer can't make a migrated blob look unmigrated and reopen the
// window that accepts unsealed records. Older builds accept any 16-byte salt.
export const createMarkedSalt = (): Uint8Array => {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
    salt.set(MARK)
    return salt
}

export const isMarkedSalt = (salt: Uint8Array): boolean =>
    salt.length === SALT_LENGTH && MARK.every((byte, i) => salt[i] === byte)
