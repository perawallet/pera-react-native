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
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { isKnownContractSite } from '../isKnownContractSite'

const verified = (
    status: NonNullable<SignRequestSource['verification']>['status'],
    verifiedOrigin?: string,
): SignRequestSource => ({
    name: 'Uniswap',
    url: 'https://app.uniswap.org',
    verification: { status, verifiedOrigin },
})

describe('isKnownContractSite', () => {
    it('matches an origin the platform observed', () => {
        expect(
            isKnownContractSite(
                'uniswap.org',
                undefined,
                'https://app.uniswap.org',
            ),
        ).toBe(true)
    })

    it('matches an origin WalletConnect Verify says is valid', () => {
        expect(
            isKnownContractSite(
                'uniswap.org',
                verified('valid', 'https://app.uniswap.org'),
            ),
        ).toBe(true)
    })

    it.each(['mismatch', 'unknown', 'scam'] as const)(
        'ignores an origin Verify rates %s',
        status => {
            expect(
                isKnownContractSite(
                    'uniswap.org',
                    verified(status, 'https://app.uniswap.org'),
                ),
            ).toBe(false)
        },
    )

    it('never trusts the url the dApp claims for itself', () => {
        expect(
            isKnownContractSite('uniswap.org', {
                name: 'Uniswap',
                url: 'https://app.uniswap.org',
            }),
        ).toBe(false)
    })

    it('does not fall back to a Verify origin once the platform observed another', () => {
        expect(
            isKnownContractSite(
                'uniswap.org',
                verified('valid', 'https://app.uniswap.org'),
                'https://evil.example',
            ),
        ).toBe(false)
    })

    it('rejects a look-alike origin', () => {
        expect(
            isKnownContractSite(
                'uniswap.org',
                undefined,
                'https://app.uniswap.org.evil.example',
            ),
        ).toBe(false)
    })

    it('is false for a contract with no project domain', () => {
        expect(
            isKnownContractSite(
                undefined,
                undefined,
                'https://app.uniswap.org',
            ),
        ).toBe(false)
    })

    it('is false with no origin at all', () => {
        expect(isKnownContractSite('uniswap.org')).toBe(false)
    })
})
