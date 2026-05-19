/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import {
    classifyLedgerErrorKind,
    type LedgerErrorPresetKind,
} from '@perawallet/wallet-core-signing'

export type { LedgerErrorPresetKind }

export type LedgerErrorPreset = {
    kind: LedgerErrorPresetKind
    title: string
    body: string
    isTroubleshootable: boolean
    isRetryable: boolean
}

type Translate = (key: string, options?: Record<string, unknown>) => string

const TROUBLESHOOTABLE_KINDS: ReadonlySet<LedgerErrorPresetKind> = new Set([
    'bluetooth_disabled',
    'bluetooth_permission',
    'scan_timeout',
    'connection_failed',
    'connection_lost',
])

const NON_RETRYABLE_KINDS: ReadonlySet<LedgerErrorPresetKind> = new Set([
    'address_mismatch',
    'unsupported_device',
])

/**
 * Builds a preset directly from a `LedgerErrorPresetKind` without needing the
 * original Error instance. Used by overlay adapters whose state already holds
 * the classified kind (e.g. the hardware-signing store), so we don't have to
 * round-trip through `instanceof` matching to render the UI copy.
 */
export const getLedgerErrorPresetByKind = (
    kind: LedgerErrorPresetKind,
    t: Translate,
): LedgerErrorPreset => ({
    kind,
    title: t(`ledger.errors.${kind}_title`),
    body: t(`ledger.errors.${kind}`),
    isTroubleshootable: TROUBLESHOOTABLE_KINDS.has(kind),
    isRetryable: !NON_RETRYABLE_KINDS.has(kind),
})

/**
 * Maps a Ledger-domain error (or plain Error) to a user-facing preset for the
 * shared PWResultView. Falls back to generic "connection_failed" copy for
 * anything we don't recognise so the UI is always actionable.
 */
export const getLedgerErrorPreset = (
    error: unknown,
    t: Translate,
): LedgerErrorPreset =>
    getLedgerErrorPresetByKind(classifyLedgerErrorKind(error), t)
