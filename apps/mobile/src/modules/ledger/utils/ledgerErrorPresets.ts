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

import {
    BLE_CLASS_ERROR_KINDS,
    classifyLedgerErrorKind,
    type LedgerErrorPresetKind,
} from '@perawallet/wallet-core-signing'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type { LedgerErrorPresetKind }

/**
 * A system-settings shortcut the user needs in order to resolve the error,
 * beyond retrying. Resolved to a platform handler by `useLedgerErrorAction`.
 */
export type LedgerErrorActionKind = 'bluetooth' | 'app_settings' | 'location'

export type LedgerErrorPreset = {
    kind: LedgerErrorPresetKind
    title: string
    body: string
    isTroubleshootable: boolean
    isRetryable: boolean
    /** null when retrying (or acting on the device) is the whole remedy. */
    action: Nullable<{ kind: LedgerErrorActionKind; label: string }>
}

type Translate = (key: string, options?: Record<string, unknown>) => string

// Aliased so the existing local name remains the call-site identifier;
// the source of truth lives in `@perawallet/wallet-core-signing` so the
// actor lifecycle and the UI agree on which kinds keep the troubleshooting
// sheet open.
const TROUBLESHOOTABLE_KINDS = BLE_CLASS_ERROR_KINDS

const NON_RETRYABLE_KINDS: ReadonlySet<LedgerErrorPresetKind> = new Set([
    'address_mismatch',
    'unsupported_device',
    'app_outdated',
])

/**
 * Only for failures the user cannot clear from inside Pera or from the device
 * — each one needs an OS-level toggle. Everything else (unlock, open the app,
 * move closer) is resolved on the Ledger itself, where a settings deep link
 * would be a dead end.
 */
const ACTION_BY_KIND: Partial<
    Record<LedgerErrorPresetKind, { kind: LedgerErrorActionKind; key: string }>
> = {
    bluetooth_disabled: {
        kind: 'bluetooth',
        key: 'ledger.errors.action_enable_bluetooth',
    },
    bluetooth_permission: {
        kind: 'app_settings',
        key: 'ledger.errors.action_open_settings',
    },
    location_services_disabled: {
        kind: 'location',
        key: 'ledger.errors.action_open_location_settings',
    },
}

/**
 * Builds a preset directly from a `LedgerErrorPresetKind` without needing the
 * original Error instance. Used by overlay adapters whose state already holds
 * the classified kind (e.g. the hardware-signing store), so we don't have to
 * round-trip through `instanceof` matching to render the UI copy.
 */
export const getLedgerErrorPresetByKind = (
    kind: LedgerErrorPresetKind,
    t: Translate,
): LedgerErrorPreset => {
    const action = ACTION_BY_KIND[kind]

    return {
        kind,
        title: t(`ledger.errors.${kind}_title`),
        body: t(`ledger.errors.${kind}`),
        isTroubleshootable: TROUBLESHOOTABLE_KINDS.has(kind),
        isRetryable: !NON_RETRYABLE_KINDS.has(kind),
        action: action ? { kind: action.kind, label: t(action.key) } : null,
    }
}

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
