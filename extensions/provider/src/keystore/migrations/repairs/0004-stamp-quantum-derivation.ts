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
import { PQ_DERIVATION_LEGACY } from '../../pqDerivation'

const FALCON_CHILD_TYPE = 'falcon-1024'

/**
 * Tags every pre-existing Falcon child with the derivation that produced it.
 *
 * Quantum children minted before PERA-4972 fed Falcon the raw algo25 entropy
 * rather than `SHA512_256("PQK" || scheme || entropy)`. Both mappings are
 * supported permanently — a legacy address may be the `auth-addr` of accounts
 * rekeyed to it, so its key can never be retired — which means the repair path
 * has to know which one to reproduce. Nothing can tell them apart until this
 * has run, so consumers treat an absent marker as an error rather than
 * guessing.
 *
 * Metadata only: it never opens material and never asks for the master key, so
 * it raises no biometric prompt. Every failure is skipped rather than thrown —
 * a rejecting `up` lands in `report.failed`, which blocks boot and, because the
 * ledger is written only after `up` resolves, would do so on every launch.
 */
export const migration: Migration<PeraMigrationContext> = {
    id: 4,
    name: 'stamp-quantum-derivation',
    up: async (
        context: PeraMigrationContext,
        _utils: MigrationUtils,
    ): Promise<void> => {
        const { storage } = context

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
                // Not a record this keystore wrote in the plaintext k/ shape.
                continue
            }

            if (record.type !== FALCON_CHILD_TYPE) continue
            if (record.metadata?.pqDerivation !== undefined) continue

            try {
                storage.set(
                    key,
                    serializeKey({
                        ...record,
                        metadata: {
                            ...(record.metadata ?? {}),
                            pqDerivation: PQ_DERIVATION_LEGACY,
                        },
                    }),
                )
            } catch {
                // An unstamped child is recoverable: the repair path fails
                // closed on it and reports, rather than re-deriving wrongly.
                safeWarn(
                    `[provider] stamp-quantum-derivation: could not stamp ${key}`,
                )
            }
        }
    },
}
