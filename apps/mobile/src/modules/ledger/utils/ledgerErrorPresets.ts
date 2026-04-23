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
    LedgerAppNotOpenError,
    LedgerConnectionError,
    LedgerDisconnectedError,
    LedgerTimeoutError,
    LedgerUserRejectedError,
    LedgerAddressMismatchError,
} from '@perawallet/wallet-core-ledger'

export type LedgerErrorPresetKind =
    | 'app_not_open'
    | 'user_rejected'
    | 'connection_lost'
    | 'timeout'
    | 'connection_failed'
    | 'address_mismatch'

export type LedgerErrorPreset = {
    kind: LedgerErrorPresetKind
    title: string
    body: string
}

type Translate = (key: string, options?: Record<string, unknown>) => string

const KIND_BY_ERROR: Array<{
    match: (error: Error) => boolean
    kind: LedgerErrorPresetKind
}> = [
    {
        match: error => error instanceof LedgerUserRejectedError,
        kind: 'user_rejected',
    },
    {
        match: error => error instanceof LedgerAppNotOpenError,
        kind: 'app_not_open',
    },
    {
        match: error => error instanceof LedgerDisconnectedError,
        kind: 'connection_lost',
    },
    {
        match: error => error instanceof LedgerTimeoutError,
        kind: 'timeout',
    },
    {
        match: error => error instanceof LedgerAddressMismatchError,
        kind: 'address_mismatch',
    },
    {
        match: error => error instanceof LedgerConnectionError,
        kind: 'connection_failed',
    },
]

/**
 * Maps a Ledger-domain error (or plain Error) to a user-facing preset for the
 * shared PWResultView. Falls back to generic "connection_failed" copy for
 * anything we don't recognise so the UI is always actionable.
 */
export const getLedgerErrorPreset = (
    error: unknown,
    t: Translate,
): LedgerErrorPreset => {
    const kind: LedgerErrorPresetKind =
        error instanceof Error
            ? (KIND_BY_ERROR.find(entry => entry.match(error))?.kind ??
              'connection_failed')
            : 'connection_failed'

    return {
        kind,
        title: t(`ledger.errors.${kind}_title`),
        body: t(`ledger.errors.${kind}`),
    }
}
