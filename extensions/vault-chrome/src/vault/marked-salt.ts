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
const KV_MARK = Uint8Array.from([0x70, 0x6b, 0x76, 0x31])
const KEYSTORE_MARK = Uint8Array.from([0x70, 0x6b, 0x72, 0x31])
const KEYSTORE_MARK_OFFSET = KV_MARK.length

/**
 * One-time migrations a blob has closed. Each closes a window that accepts
 * material the vault key never authenticated, so neither may reopen.
 */
export type SaltMarks = {
    /** Network records are authenticated; unsealed ones are refused. */
    isKvSealed: boolean
    /** Keystore material left the pre-vault key; a legacy key is never honoured again. */
    isKeystoreResealed: boolean
}

export const ALL_SALT_MARKS: Readonly<SaltMarks> = Object.freeze({
    isKvSealed: true,
    isKeystoreResealed: true,
})

const hasMarkAt = (salt: Uint8Array, mark: Uint8Array, offset: number) =>
    mark.every((byte, i) => salt[offset + i] === byte)

// The marks ride in the KDF salt: stripping one changes the derived key, so a
// profile writer can't make a migrated blob look unmigrated and reopen a
// window. Older builds accept any 16-byte salt.
export const createMarkedSalt = (
    marks: SaltMarks = ALL_SALT_MARKS,
): Uint8Array => {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
    if (marks.isKvSealed) salt.set(KV_MARK)
    if (marks.isKeystoreResealed) salt.set(KEYSTORE_MARK, KEYSTORE_MARK_OFFSET)
    return salt
}

export const readSaltMarks = (salt: Uint8Array): SaltMarks =>
    salt.length === SALT_LENGTH
        ? {
              isKvSealed: hasMarkAt(salt, KV_MARK, 0),
              isKeystoreResealed: hasMarkAt(
                  salt,
                  KEYSTORE_MARK,
                  KEYSTORE_MARK_OFFSET,
              ),
          }
        : { isKvSealed: false, isKeystoreResealed: false }

export const isMarkedSalt = (salt: Uint8Array): boolean =>
    readSaltMarks(salt).isKvSealed
