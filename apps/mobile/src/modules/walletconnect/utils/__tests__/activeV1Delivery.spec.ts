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

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WalletConnectV1Delivery } from '@perawallet/wallet-core-walletconnect'
import {
    clearActiveWalletConnectV1Delivery,
    deliverApprove,
    deliverReject,
    deliverRejectInBackground,
    setActiveWalletConnectV1Delivery,
} from '../activeV1Delivery'

// The shared setup mocks the package down to its deep-link parser.
vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    WalletConnectInvalidSessionError: class extends Error {},
}))

const makeDelivery = (): WalletConnectV1Delivery => ({
    deliverApprove: vi.fn(async () => {}),
    deliverReject: vi.fn(async () => {}),
    deliverRejectInBackground: vi.fn(),
})

describe('activeV1Delivery', () => {
    let active: WalletConnectV1Delivery | null = null

    afterEach(() => {
        if (active) clearActiveWalletConnectV1Delivery(active)
        active = null
    })

    it('routes every delivery through the published handler', async () => {
        active = makeDelivery()
        setActiveWalletConnectV1Delivery(active)
        const error = new Error('declined')

        await deliverApprove('c1', 1, ['c2ln'])
        await deliverReject('c1', 2, error)
        deliverRejectInBackground('c1', 3, error)

        expect(active.deliverApprove).toHaveBeenCalledWith('c1', 1, ['c2ln'])
        expect(active.deliverReject).toHaveBeenCalledWith('c1', 2, error)
        expect(active.deliverRejectInBackground).toHaveBeenCalledWith(
            'c1',
            3,
            error,
        )
    })

    it('rejects a foreground delivery and skips a background one when no handler is mounted', async () => {
        await expect(deliverApprove('c1', 1, [])).rejects.toThrow(
            'No WalletConnect v1 handler is mounted',
        )
        await expect(deliverReject('c1', 2, new Error('x'))).rejects.toThrow(
            'No WalletConnect v1 handler is mounted',
        )
        expect(() =>
            deliverRejectInBackground('c1', 3, new Error('x')),
        ).not.toThrow()
    })

    it('lets a departing owner clear only its own registration', async () => {
        const departing = makeDelivery()
        active = makeDelivery()
        setActiveWalletConnectV1Delivery(departing)
        setActiveWalletConnectV1Delivery(active)

        clearActiveWalletConnectV1Delivery(departing)
        await deliverApprove('c1', 1, [])

        expect(active.deliverApprove).toHaveBeenCalledTimes(1)
        expect(departing.deliverApprove).not.toHaveBeenCalled()
    })
})
