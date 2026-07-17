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

// Exhaustiveness contract between the Ledger extension's error classes and
// the signing-layer classifier: every exported `Ledger*Error` must be
// recognized by `isLedgerError` and classify to a specific preset kind —
// otherwise a new error class silently bypasses the troubleshooting surface
// and flattens to generic "connection failed" copy. This test fails the
// moment a class is added without classifier coverage.

import { describe, it, expect } from 'vitest'
import * as ledger from '@perawallet/wallet-core-ledger'
import {
    classifyLedgerErrorKind,
    isLedgerError,
} from '../classifyLedgerErrorKind'

type ErrorClass = new (...args: string[]) => Error

const ERROR_CLASS_NAMES = Object.keys(ledger)
    .filter(name => /^Ledger\w*Error$/.test(name))
    .sort()

describe('ledger error class coverage', () => {
    it('sees the full exported error-class surface', () => {
        // Guards the enumeration itself: if the export pattern changes and
        // this collapses to a handful of names, the per-class cases below
        // would vacuously pass.
        expect(ERROR_CLASS_NAMES.length).toBeGreaterThanOrEqual(19)
    })

    it.each(ERROR_CLASS_NAMES)(
        '%s is recognized by isLedgerError and classifies to a specific kind',
        name => {
            const ErrorCls = (ledger as Record<string, unknown>)[
                name
            ] as ErrorClass
            // Constructors take (message?, originalError?) or (originalError?);
            // a lone string satisfies both shapes at runtime.
            const instance = new ErrorCls('x')

            expect(isLedgerError(instance)).toBe(true)

            if (name !== 'LedgerConnectionError') {
                expect(classifyLedgerErrorKind(instance)).not.toBe(
                    'connection_failed',
                )
            }
        },
    )
})
