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
import { useSiteSafetyGate } from '../useSiteSafetyGate'

const BLOCKED: SiteSafetyVerdict = {
    kind: 'blocked',
    host: 'phish.example',
    reason: 'phishing-list',
}
const LOOK_ALIKE: SiteSafetyVerdict = {
    kind: 'look-alike',
    host: 'uniswap-app.org',
    imitates: { name: 'Uniswap', domain: 'uniswap.org' },
}

const withVerdict = (verdict: SiteSafetyVerdict, isChecking = false) => {
    vi.mocked(useSiteSafetyQuery).mockReturnValue({ verdict, isChecking })
}

const render = () =>
    renderHook(() => useSiteSafetyGate({ urls: ['https://site.example'] }))

describe('useSiteSafetyGate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('holds approval while the check runs', () => {
        withVerdict({ kind: 'clear' }, true)

        const { result } = render()

        expect(result.current.isApprovalAllowed).toBe(false)
        expect(result.current.isBlockedViewShown).toBe(false)
    })

    it('allows approval for a site with no warning', () => {
        withVerdict({ kind: 'clear' })

        expect(render().result.current.isApprovalAllowed).toBe(true)
    })

    it('blocks a listed site until the user reveals, acknowledges and continues', () => {
        withVerdict(BLOCKED)
        const { result } = render()
        expect(result.current.isBlockedViewShown).toBe(true)

        act(() => result.current.handleContinueAnyway())
        expect(result.current.isApprovalAllowed).toBe(false)

        act(() => result.current.handleRevealContinueAnyway())
        act(() => result.current.handleToggleRiskAcknowledged())
        expect(result.current.isApprovalAllowed).toBe(false)

        act(() => result.current.handleContinueAnyway())
        expect(result.current.isBlockedViewShown).toBe(false)
        expect(result.current.isApprovalAllowed).toBe(true)
    })

    it('holds a look-alike until it is acknowledged', () => {
        withVerdict(LOOK_ALIKE)
        const { result } = render()
        expect(result.current.isLookAlikeWarningShown).toBe(true)
        expect(result.current.isApprovalAllowed).toBe(false)

        act(() => result.current.handleAcknowledgeLookAlike())

        expect(result.current.isLookAlikeWarningShown).toBe(false)
        expect(result.current.isApprovalAllowed).toBe(true)
    })

    it('passes the urls and the Verify flag to the check', () => {
        withVerdict({ kind: 'clear' })

        renderHook(() =>
            useSiteSafetyGate({
                urls: ['https://a.example'],
                isFlaggedByWalletConnectVerify: true,
            }),
        )

        expect(useSiteSafetyQuery).toHaveBeenCalledWith({
            urls: ['https://a.example'],
            isFlaggedByWalletConnectVerify: true,
            isEnabled: true,
        })
    })

    it('skips the check for a request that names no site', () => {
        withVerdict({ kind: 'clear' })

        renderHook(() => useSiteSafetyGate({ urls: [undefined, null] }))

        expect(useSiteSafetyQuery).toHaveBeenCalledWith(
            expect.objectContaining({ isEnabled: false }),
        )
    })
})
