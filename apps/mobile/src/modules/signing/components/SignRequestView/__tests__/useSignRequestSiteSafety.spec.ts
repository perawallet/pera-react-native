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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSiteSafetyQuery } from '@perawallet/wallet-core-site-safety'
import type { SignRequest } from '@perawallet/wallet-core-signing'
import { useSignRequestSiteSafety } from '../useSignRequestSiteSafety'

const request = (overrides: Partial<SignRequest> = {}): SignRequest =>
    ({
        id: 'r1',
        type: 'transactions',
        transport: 'callback',
        sourceType: 'walletconnect',
        ...overrides,
    }) as SignRequest

describe('useSignRequestSiteSafety', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("checks the claimed url, the observed origin and Verify's origin", () => {
        renderHook(() =>
            useSignRequestSiteSafety(
                request({
                    sourceMetadata: {
                        url: 'https://claimed.example',
                        verification: {
                            status: 'scam',
                            verifiedOrigin: 'https://attested.example',
                        },
                    },
                    verifiedOrigin: 'https://observed.example',
                }),
            ),
        )

        expect(useSiteSafetyQuery).toHaveBeenLastCalledWith({
            urls: [
                'https://claimed.example',
                'https://observed.example',
                'https://attested.example',
            ],
            isFlaggedByWalletConnectVerify: true,
            isEnabled: true,
        })
    })

    it('does not check a request that names no site', () => {
        const { result } = renderHook(() =>
            useSignRequestSiteSafety(request({ sourceType: 'local' })),
        )

        expect(useSiteSafetyQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({
                isFlaggedByWalletConnectVerify: false,
                isEnabled: false,
            }),
        )
        expect(result.current.isApprovalAllowed).toBe(true)
    })
})
