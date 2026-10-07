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
import type {
    Migration,
    MigrationUtils,
} from '@algorandfoundation/provider-migrations'
import type { KeyData } from '@algorandfoundation/keystore-core'
import {
    METADATA_PREFIX,
    decode,
    serializeKey,
} from '@algorandfoundation/react-native-keystore'
import type { PeraMigrationContext } from '../types'
import { safeWarn } from '../safeLog'

const PASSKEY_KEY_TYPE = 'hd-derived-p256'

/** Linear `=` strip: `/=+$/` backtracks polynomially on a long run of `=`. */
const toUrlSafe = (value: string): string => {
    let end = value.length
    while (end > 0 && value.charCodeAt(end - 1) === 0x3d) end--
    return value.slice(0, end).replace(/\+/g, '-').replace(/\//g, '_')
}

const isStandardAlphabet = (value: string): boolean =>
    value.includes('+') || value.includes('/') || value.endsWith('=')

/**
 * The Android provider decodes `userId` as URL-safe base64 and throws on `+`
 * or `/`, which iOS-created credentials restored before the writer normalised
 * them still carry. A restore skips existing credentials, so only this fixes them.
 */
export const migration: Migration<PeraMigrationContext> = {
    id: 5,
    name: 'url-safe-passkey-user-id',
    up: async (
        context: PeraMigrationContext,
        _utils: MigrationUtils,
    ): Promise<void> => {
        const { storage, platform } = context
        if (platform !== 'android') return

        let allKeys: string[]
        try {
            allKeys = storage.getAllKeys()
        } catch {
            return
        }

        for (const key of allKeys) {
            if (!key.startsWith(METADATA_PREFIX)) continue

            let raw: string | undefined
            try {
                raw = storage.getString(key)
            } catch {
                continue
            }
            if (raw === undefined) continue

            let record: KeyData
            try {
                record = decode(raw)
            } catch {
                continue
            }

            if (record.type !== PASSKEY_KEY_TYPE) continue
            const metadata = (record.metadata ?? {}) as Record<string, unknown>
            const { userId, userHandle } = metadata
            if (typeof userId !== 'string' || !isStandardAlphabet(userId)) {
                continue
            }

            const urlSafe = toUrlSafe(userId)
            try {
                storage.set(
                    key,
                    serializeKey({
                        ...record,
                        metadata: {
                            ...metadata,
                            userId: urlSafe,
                            ...(userHandle === userId
                                ? { userHandle: urlSafe }
                                : {}),
                        },
                    }),
                )
            } catch {
                safeWarn(
                    `[provider] url-safe-passkey-user-id: could not rewrite ${key}`,
                )
            }
        }
    },
}
