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

import { describe, expect, it } from 'vitest'
import type { WalletKitVerifyContext } from '../client'
import { toPeerVerification } from '../verification'
import { makeVerifyContext as context } from './fakeWalletKit'

describe('toPeerVerification', () => {
    it('reports an attested matching origin as valid', () => {
        expect(toPeerVerification(context({ validation: 'VALID' }))).toEqual({
            status: 'valid',
            verifiedOrigin: 'https://dapp.example',
        })
    })

    it('reports an attested origin that differs from the claimed one as a mismatch', () => {
        expect(
            toPeerVerification(
                context({
                    validation: 'INVALID',
                    origin: 'https://evil.example',
                }),
            ),
        ).toEqual({ status: 'mismatch', verifiedOrigin: 'https://evil.example' })
    })

    it.each(['VALID', 'INVALID'] as const)(
        'reports a flagged origin as scam whatever the validation (%s)',
        validation => {
            expect(
                toPeerVerification(context({ validation, isScam: true })),
            ).toEqual({ status: 'scam', verifiedOrigin: 'https://dapp.example' })
        },
    )

    it('drops the origin of an unattested context, which only echoes the peer', () => {
        expect(toPeerVerification(context({ validation: 'UNKNOWN' }))).toEqual({
            status: 'unknown',
        })
    })

    it('treats a missing context as unknown', () => {
        expect(toPeerVerification(undefined)).toEqual({ status: 'unknown' })
    })

    it('treats an unrecognised validation value as unknown', () => {
        expect(
            toPeerVerification(
                context({
                    validation: 'MAYBE' as WalletKitVerifyContext['verified']['validation'],
                }),
            ),
        ).toEqual({ status: 'unknown' })
    })

    it('carries no origin when the attested one is empty', () => {
        expect(
            toPeerVerification(context({ validation: 'VALID', origin: '' })),
        ).toEqual({ status: 'valid' })
    })
})
