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

import { base64 } from '@scure/base'
import {
    logger,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { PRF_BLOB_KEY, VAULT_STORAGE_KEY } from '../storage-keys'
import { readSaltMarks, type SaltMarks } from './marked-salt'

/** Each migration rejects to leave its window open for the next unlock. */
export type UnlockOptions = {
    /** Seals the network records that predate KV authentication, keyed by the derived KV auth key. */
    migrateLegacyRecords?: (kvAuthKey: Uint8Array) => Promise<void>
    /**
     * Moves keystore material off the driver's pre-vault key. Receives the
     * vault master key as a non-extractable AES-GCM key, before any other
     * context can see the session unlocked.
     */
    resealLegacyKeystore?: (engineKey: CryptoKey) => Promise<unknown>
    /** Removes a pre-vault key from a profile whose re-seal is already recorded. */
    discardLegacyKeystoreKey?: (engineKey: CryptoKey) => Promise<unknown>
}

export type OtherBlobState =
    | { status: 'absent' }
    | { status: 'unreadable' }
    | { status: 'read'; marks: SaltMarks }

const readSaltField = (raw: unknown, field: string): Optional<Uint8Array> => {
    if (typeof raw !== 'string') return undefined
    try {
        const parsed: unknown = JSON.parse(raw)
        const value = (parsed as Nullable<Record<string, unknown>>)?.[field]
        return typeof value === 'string' ? base64.decode(value) : undefined
    } catch {
        return undefined
    }
}

/**
 * Each unlock method's blob carries its own marks, so one method's migration
 * must close the other's: otherwise deleting or corrupting the blob the user
 * migrated with, or simply turning passkey unlock off, would leave the other
 * blob unmarked and open a second window. An absent blob says nothing:
 * password-only vaults have no PRF blob.
 */
export const readOtherBlobState = async (
    unlockedWith: 'password' | 'passkey',
): Promise<OtherBlobState> => {
    const [storageKey, field] =
        unlockedWith === 'password'
            ? [PRF_BLOB_KEY, 'hkdfSalt']
            : [VAULT_STORAGE_KEY, 'salt']
    const stored = await chrome.storage.local.get(storageKey)
    const raw: unknown = stored[storageKey]
    if (raw === undefined) return { status: 'absent' }
    const salt = readSaltField(raw, field)
    if (salt === undefined) return { status: 'unreadable' }
    return { status: 'read', marks: readSaltMarks(salt) }
}

const hasOtherBlobMark = (
    other: OtherBlobState,
    mark: keyof SaltMarks,
): boolean => other.status === 'read' && other.marks[mark]

/** An unreadable blob closes the window but is not a mark to copy: it may be corrupt, not migrated. */
export const isClosedByOtherBlob = (
    other: OtherBlobState,
    mark: keyof SaltMarks,
): boolean => other.status === 'unreadable' || hasOtherBlobMark(other, mark)

/** A mark this blob has, earned on this unlock, or copied from the other blob. */
export const nextSaltMarks = (
    marks: SaltMarks,
    other: OtherBlobState,
    earned: SaltMarks,
): SaltMarks => ({
    isKvSealed:
        marks.isKvSealed ||
        earned.isKvSealed ||
        hasOtherBlobMark(other, 'isKvSealed'),
    isKeystoreResealed:
        marks.isKeystoreResealed ||
        earned.isKeystoreResealed ||
        hasOtherBlobMark(other, 'isKeystoreResealed'),
})

const importEngineKey = (masterKey: Uint8Array): Promise<CryptoKey> =>
    crypto.subtle.importKey(
        'raw',
        masterKey as BufferSource,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
    )

const logKeystoreFailure = (
    step: 'discard' | 'reseal',
    error: unknown,
): void => {
    logger.error('[vault] legacy keystore step failed', {
        step,
        reason: error instanceof Error ? error.name : 'unknown',
    })
}

/**
 * Re-seals while neither blob records a finished re-seal, and returns whether
 * this unlock earned the mark. Once one does, any pre-vault key left is planted
 * or orphaned, so it is discarded instead. An unreadable other blob closes the
 * window but proves nothing, so the key is kept for a later unlock.
 *
 * Best-effort like the record migration: a failure leaves the blob unmarked so
 * the next unlock retries, and the unlock itself still succeeds.
 */
export const runLegacyKeystoreStep = async ({
    masterKey,
    marks,
    other,
    options,
    canMark = true,
}: {
    masterKey: Uint8Array
    marks: SaltMarks
    other: OtherBlobState
    options: Optional<UnlockOptions>
    canMark?: boolean
}): Promise<boolean> => {
    if (
        marks.isKeystoreResealed ||
        hasOtherBlobMark(other, 'isKeystoreResealed')
    ) {
        if (!options?.discardLegacyKeystoreKey) return false
        try {
            await options.discardLegacyKeystoreKey(
                await importEngineKey(masterKey),
            )
        } catch (error) {
            logKeystoreFailure('discard', error)
        }
        return false
    }
    if (!canMark || other.status === 'unreadable') return false
    if (!options?.resealLegacyKeystore) return false
    try {
        await options.resealLegacyKeystore(await importEngineKey(masterKey))
        return true
    } catch (error) {
        logKeystoreFailure('reseal', error)
        return false
    }
}
