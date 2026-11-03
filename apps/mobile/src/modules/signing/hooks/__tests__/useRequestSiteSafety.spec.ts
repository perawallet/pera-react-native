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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    useSiteSafetyQuery,
    type SiteSafetyVerdict,
} from '@perawallet/wallet-core-site-safety'
import {
    useRequestSiteSafety,
    useSiteWarningAcknowledgementStore,
} from '../useRequestSiteSafety'

const signing = vi.hoisted(() => ({ currentRequest: undefined as unknown }))

vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<object>()),
    useSigningRequest: () => ({ currentRequest: signing.currentRequest }),
}))

const BLOCKED: SiteSafetyVerdict = {
    kind: 'blocked',
    host: 'phish.example',
    reason: 'phishing-list',
}

const withVerdict = (verdict: SiteSafetyVerdict, isChecking = false) => {
    vi.mocked(useSiteSafetyQuery).mockReturnValue({ verdict, isChecking })
}

const requestWith = (
    id = 'request-1',
    overrides: Record<string, unknown> = {},
) => {
    signing.currentRequest = {
        id,
        verifiedOrigin: 'https://verified.example',
        sourceMetadata: {
            url: 'https://dapp.example',
            verification: {
                status: 'valid',
                verifiedOrigin: 'https://verify.example',
            },
        },
        ...overrides,
    }
}

describe('useRequestSiteSafety', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useSiteWarningAcknowledgementStore.getState().resetState()
        requestWith()
        withVerdict({ kind: 'clear' })
    })

    it('shows nothing and holds nothing for a clear site', () => {
        const { result } = renderHook(() => useRequestSiteSafety())

        expect(result.current.blockedSite).toBeUndefined()
        expect(result.current.isConfirmBlocked).toBe(false)
    })

    it.each(['phishing-list', 'walletconnect-verify'] as const)(
        'holds Confirm for a site blocked by %s until it is acknowledged',
        reason => {
            const blocked: SiteSafetyVerdict = {
                kind: 'blocked',
                host: 'phish.example',
                reason,
            }
            withVerdict(blocked)

            const { result } = renderHook(() => useRequestSiteSafety())
            expect(result.current.blockedSite).toEqual(blocked)
            expect(result.current.isConfirmBlocked).toBe(true)

            act(() => result.current.toggleAcknowledged())

            expect(result.current.isAcknowledged).toBe(true)
            expect(result.current.isConfirmBlocked).toBe(false)
        },
    )

    it('leaves a look-alike site to the gate', () => {
        withVerdict({
            kind: 'look-alike',
            host: 'uniswap-app.org',
            imitates: { name: 'Uniswap', domain: 'uniswap.org' },
        })

        const { result } = renderHook(() => useRequestSiteSafety())

        expect(result.current.blockedSite).toBeUndefined()
        expect(result.current.isConfirmBlocked).toBe(false)
    })

    it('asks about the same urls and Verify flag as the sign gate', () => {
        requestWith('request-1', {
            sourceMetadata: {
                url: 'https://dapp.example',
                verification: {
                    status: 'scam',
                    verifiedOrigin: 'https://verify.example',
                },
            },
        })

        renderHook(() => useRequestSiteSafety())

        expect(useSiteSafetyQuery).toHaveBeenCalledWith({
            urls: [
                'https://dapp.example',
                'https://verified.example',
                'https://verify.example',
            ],
            isFlaggedByWalletConnectVerify: true,
            isEnabled: true,
        })
    })

    it('holds Confirm while the check runs', () => {
        withVerdict({ kind: 'clear' }, true)

        const { result } = renderHook(() => useRequestSiteSafety())

        expect(result.current.isConfirmBlocked).toBe(true)
    })

    it('does not check a request that names no site', () => {
        requestWith('request-1', {
            verifiedOrigin: undefined,
            sourceMetadata: undefined,
        })

        const { result } = renderHook(() => useRequestSiteSafety())

        expect(useSiteSafetyQuery).toHaveBeenCalledWith(
            expect.objectContaining({ isEnabled: false }),
        )
        expect(result.current.isConfirmBlocked).toBe(false)
    })

    it('starts the next request unacknowledged', () => {
        withVerdict(BLOCKED)
        const { result, rerender } = renderHook(() => useRequestSiteSafety())
        act(() => result.current.toggleAcknowledged())
        expect(result.current.isConfirmBlocked).toBe(false)

        requestWith('request-2')
        rerender()

        expect(result.current.isAcknowledged).toBe(false)
        expect(result.current.isConfirmBlocked).toBe(true)
    })
})
