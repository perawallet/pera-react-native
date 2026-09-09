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

import { randomBytes } from 'crypto'
import {
    argon2idDerive,
    openAesGcm,
    sealAesGcm,
    zeroBytes,
} from '@perawallet/wallet-core-kms'
import {
    encodeToBase64,
    decodeFromBase64,
} from '@perawallet/wallet-core-shared'
import type { Argon2idConfig } from '../models'
import { ARGON2ID_CONFIG } from './constants'

export const BACKUP_SYNC_QR_TYPE = 'backup-sync'
export const BACKUP_SYNC_QR_VERSION = 1

const QR_SALT_LENGTH = 16

const encoder = new TextEncoder()

export class BackupSyncQrError extends Error {
    constructor(message = 'Failed to read the sync QR payload') {
        super(message)
        this.name = 'BackupSyncQrError'
    }
}

/** Raised when the envelope was written by a newer app than this one. */
export class BackupSyncQrUnsupportedVersionError extends BackupSyncQrError {
    constructor(readonly version: number) {
        super(`Sync QR version ${version} needs a newer app`)
        this.name = 'BackupSyncQrUnsupportedVersionError'
    }
}

export type BackupSyncQrContents = {
    /** Space-separated backup phrase. */
    mnemonic: string
    /** Base64 salt from backup setup — not the QR's own KDF salt. */
    backupSalt: string
    /** The backup's master-key KDF — not the envelope's own `kdf` block. */
    argon2id: Argon2idConfig
}

type EncryptParams = {
    mnemonic: string
    /** Base64 salt from backup setup. */
    backupSalt: string
    /** The user-chosen code protecting this QR. */
    code: string
}

// Type and version travel in clear; binding them into the tag stops a future
// envelope from being relabelled as one this app will open.
const aadFor = (type: string, version: number): Uint8Array =>
    encoder.encode(`${type}|${version}`)

const deriveQrKey = (
    code: string,
    qrSalt: Uint8Array,
    config: Argon2idConfig = ARGON2ID_CONFIG,
): Promise<Uint8Array> => {
    const codeBytes = encoder.encode(code)
    return argon2idDerive(codeBytes, qrSalt, config).finally(() =>
        zeroBytes(codeBytes),
    )
}

const serializeConfig = (config: Argon2idConfig) => ({
    time_cost: config.timeCost,
    memory_cost: config.memoryCost,
    parallelism: config.parallelism,
    output_length: config.outputLength,
})

/**
 * Seals the backup phrase and setup salt under a user-chosen code and returns
 * the QR's string contents. The sealed object is self-contained: a scanner
 * derives `backupId` and `K_enc` from it with no prior state.
 */
export const encryptBackupSyncQr = async ({
    mnemonic,
    backupSalt,
    code,
}: EncryptParams): Promise<string> => {
    const qrSalt = new Uint8Array(randomBytes(QR_SALT_LENGTH))
    let key: Uint8Array | null = null
    try {
        key = await deriveQrKey(code, qrSalt)
        const payload = sealAesGcm(
            JSON.stringify({
                mnemonic,
                salt: backupSalt,
                argon2id: serializeConfig(ARGON2ID_CONFIG),
            }),
            key,
            aadFor(BACKUP_SYNC_QR_TYPE, BACKUP_SYNC_QR_VERSION),
        )
        return JSON.stringify({
            v: BACKUP_SYNC_QR_VERSION,
            t: BACKUP_SYNC_QR_TYPE,
            kdf: {
                salt: encodeToBase64(qrSalt),
                ...serializeConfig(ARGON2ID_CONFIG),
            },
            payload,
        })
    } finally {
        zeroBytes(key)
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const isPositiveInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value > 0

const readConfig = (value: unknown): Argon2idConfig => {
    if (!isRecord(value)) throw new BackupSyncQrError()
    const { time_cost, memory_cost, parallelism, output_length } = value
    if (
        !isPositiveInteger(time_cost) ||
        !isPositiveInteger(memory_cost) ||
        !isPositiveInteger(parallelism) ||
        !isPositiveInteger(output_length)
    ) {
        throw new BackupSyncQrError()
    }
    return {
        timeCost: time_cost,
        memoryCost: memory_cost,
        parallelism,
        outputLength: output_length,
    }
}

// Both KDF blocks are attacker-chosen — the inner one only proves whoever built
// the QR knew the code — and each value sizes an allocation. Bound before deriving.
const MAX_MEMORY_COST_MIB = 512
const MAX_TIME_COST = 10
const MAX_PARALLELISM = 4
// Argon2's own floor is 8 bytes; this build seals with 16.
const MIN_SALT_LENGTH = 8
const MAX_SALT_LENGTH = 64
// aes-256-gcm takes 32 and nothing else; a bound would let a bad length reach
// createDecipheriv and surface as a wrong-code error.
const REQUIRED_OUTPUT_LENGTH = 32

const assertDerivable = (config: Argon2idConfig): void => {
    if (
        config.memoryCost > MAX_MEMORY_COST_MIB ||
        config.timeCost > MAX_TIME_COST ||
        config.parallelism > MAX_PARALLELISM ||
        config.outputLength !== REQUIRED_OUTPUT_LENGTH
    ) {
        throw new BackupSyncQrError(
            'Sync QR asks for an unreasonable derivation',
        )
    }
}

const readSalt = (value: string): Uint8Array => {
    let salt: Uint8Array
    try {
        salt = decodeFromBase64(value)
    } catch {
        throw new BackupSyncQrError('Not a sync QR payload')
    }
    if (salt.length < MIN_SALT_LENGTH || salt.length > MAX_SALT_LENGTH) {
        throw new BackupSyncQrError(
            'Sync QR asks for an unreasonable derivation',
        )
    }
    return salt
}

export type BackupSyncQrEnvelope = {
    version: number
    /** Base64 `IV || CIPHERTEXT || TAG`. */
    payload: string
    kdfSalt: Uint8Array
    kdfConfig: Argon2idConfig
}

/**
 * Validates a scanned string as a sync envelope without deriving anything, so
 * a wrong QR is reported as a wrong QR rather than a wrong code.
 */
export const parseBackupSyncQrEnvelope = (
    raw: string,
): BackupSyncQrEnvelope => {
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        throw new BackupSyncQrError('Not a sync QR payload')
    }
    if (
        !isRecord(parsed) ||
        parsed.t !== BACKUP_SYNC_QR_TYPE ||
        !isPositiveInteger(parsed.v) ||
        typeof parsed.payload !== 'string' ||
        !isRecord(parsed.kdf) ||
        typeof parsed.kdf.salt !== 'string'
    ) {
        throw new BackupSyncQrError('Not a sync QR payload')
    }
    if (parsed.v > BACKUP_SYNC_QR_VERSION) {
        throw new BackupSyncQrUnsupportedVersionError(parsed.v)
    }

    const kdfConfig = readConfig(parsed.kdf)
    assertDerivable(kdfConfig)

    return {
        version: parsed.v,
        payload: parsed.payload,
        kdfSalt: readSalt(parsed.kdf.salt),
        kdfConfig,
    }
}

/**
 * Throws `BackupSyncQrUnsupportedVersionError` for an envelope a newer app
 * wrote, and `BackupSyncQrError` on a wrong code, a tampered envelope or junk.
 */
export const decryptBackupSyncQr = async (
    raw: string,
    code: string,
): Promise<BackupSyncQrContents> => {
    let key: Uint8Array | null = null
    try {
        const { version, payload, kdfSalt, kdfConfig } =
            parseBackupSyncQrEnvelope(raw)
        key = await deriveQrKey(code, kdfSalt, kdfConfig)
        const opened: unknown = JSON.parse(
            openAesGcm(payload, key, aadFor(BACKUP_SYNC_QR_TYPE, version)),
        )
        if (
            !isRecord(opened) ||
            typeof opened.mnemonic !== 'string' ||
            typeof opened.salt !== 'string'
        ) {
            throw new BackupSyncQrError()
        }
        const argon2id = readConfig(opened.argon2id)
        assertDerivable(argon2id)
        return {
            mnemonic: opened.mnemonic,
            backupSalt: opened.salt,
            argon2id,
        }
    } catch (error) {
        if (error instanceof BackupSyncQrError) throw error
        throw new BackupSyncQrError()
    } finally {
        zeroBytes(key)
    }
}
