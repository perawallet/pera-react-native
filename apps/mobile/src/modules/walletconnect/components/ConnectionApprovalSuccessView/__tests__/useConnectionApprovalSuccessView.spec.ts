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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type {
    Connection,
    ConnectionOrigin,
} from '@perawallet/wallet-extension-connections'
import { useConnectionApprovalSuccessView } from '../useConnectionApprovalSuccessView'

const { canReturnToDapp, returnToDapp, resolve } = vi.hoisted(() => ({
    canReturnToDapp: vi.fn(() => true),
    returnToDapp: vi.fn(async () => {}),
    resolve: vi.fn(),
}))

vi.mock('../../../hooks/useReturnToDapp', () => ({
    useReturnToDapp: () => ({ canReturnToDapp, returnToDapp }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, args?: Record<string, unknown>) =>
            args ? `${key}:${String(args.name)}` : key,
    }),
}))

const connection = (origin?: ConnectionOrigin): Connection => ({
    id: 'client-1',
    kind: 'walletconnect-v1',
    name: 'Tinyman',
    peer: { name: 'Tinyman', url: 'https://tinyman.org' },
    accounts: ['AAAA'],
    status: 'active',
    createdAt: 0,
    lastActiveAt: 0,
    ...(origin ? { origin } : {}),
})

describe('useConnectionApprovalSuccessView', () => {
    beforeEach(() => {
        canReturnToDapp.mockReturnValue(true)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    // The gate this hook exists for: only a pairing that arrived from an
    // external browser has anywhere to hand the user back to.
    it('offers the hand-off for an external-browser pairing the platform can return to', () => {
        const { result } = renderHook(() =>
            useConnectionApprovalSuccessView(
                connection({
                    source: 'external-browser',
                    browserName: 'Chrome',
                }),
            ),
        )

        expect(result.current.showReturnCta).toBe(true)
        expect(canReturnToDapp).toHaveBeenCalledWith({ browserName: 'Chrome' })
    })

    it.each([['qr' as const], ['in-app' as const]])(
        'withholds the hand-off for a %s pairing',
        source => {
            const { result } = renderHook(() =>
                useConnectionApprovalSuccessView(connection({ source })),
            )

            expect(result.current.showReturnCta).toBe(false)
        },
    )

    // A migrated connection predating the origin field, or one whose stamp
    // failed — it must read as "no hand-off", never crash on the missing field.
    it('withholds the hand-off for a connection with no recorded origin', () => {
        const { result } = renderHook(() =>
            useConnectionApprovalSuccessView(connection()),
        )

        expect(result.current.showReturnCta).toBe(false)
    })

    // iOS Safari and unknown browsers have no focus-only scheme, so the
    // platform half of the gate has to be honoured even for a browser pairing.
    it('withholds the hand-off when the platform cannot return to that browser', () => {
        canReturnToDapp.mockReturnValue(false)

        const { result } = renderHook(() =>
            useConnectionApprovalSuccessView(
                connection({
                    source: 'external-browser',
                    browserName: 'Safari',
                }),
            ),
        )

        expect(result.current.showReturnCta).toBe(false)
    })

    it('returns to the dApp and closes the sheet itself', () => {
        const { result } = renderHook(() =>
            useConnectionApprovalSuccessView(
                connection({
                    source: 'external-browser',
                    browserName: 'Chrome',
                }),
            ),
        )

        result.current.handleReturnToDapp()

        expect(returnToDapp).toHaveBeenCalledWith({ browserName: 'Chrome' })
        // Overriding onConfirm suppresses ConfirmActionContent's own resolve.
        expect(resolve).toHaveBeenCalledWith(true)
    })

    it('names the dApp in the return label', () => {
        const { result } = renderHook(() =>
            useConnectionApprovalSuccessView(connection()),
        )

        expect(result.current.dAppName).toBe('Tinyman')
        expect(result.current.returnLabel).toBe(
            'walletconnect.request.success_sheet_return_to_dapp:Tinyman',
        )
    })
})
