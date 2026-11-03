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
import type { SignRequest } from '@perawallet/wallet-core-signing'
import { signRequestSiteSafetyParams } from '../signRequestSiteSafetyParams'

const requestWith = (verification?: {
    status: string
    verifiedOrigin?: string
}) =>
    ({
        id: 'r1',
        verifiedOrigin: 'https://verified.example',
        sourceMetadata: { url: 'https://source.example', verification },
    }) as unknown as SignRequest

describe('signRequestSiteSafetyParams', () => {
    it('lists the source url, the verified origin and the Verify origin in order', () => {
        const params = signRequestSiteSafetyParams(
            requestWith({
                status: 'valid',
                verifiedOrigin: 'https://verify.example',
            }),
        )

        expect(params.urls).toEqual([
            'https://source.example',
            'https://verified.example',
            'https://verify.example',
        ])
    })

    it('flags a request WalletConnect Verify marks as a scam', () => {
        expect(
            signRequestSiteSafetyParams(requestWith({ status: 'scam' }))
                .isFlaggedByWalletConnectVerify,
        ).toBe(true)
    })

    it('does not flag any other Verify status or none at all', () => {
        expect(
            signRequestSiteSafetyParams(requestWith({ status: 'valid' }))
                .isFlaggedByWalletConnectVerify,
        ).toBe(false)
        expect(
            signRequestSiteSafetyParams(requestWith())
                .isFlaggedByWalletConnectVerify,
        ).toBe(false)
    })
})
