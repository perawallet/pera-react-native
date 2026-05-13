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

import { describe, it, expect, beforeEach } from 'vitest'
import {
    LedgerAppNotOpenError,
    LedgerUserRejectedError,
} from '@perawallet/wallet-core-ledger'
import { AccountTypes } from '@perawallet/wallet-core-accounts'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useHardwareSigningStore } from '../../store/hardwareSigningStore'
import type { SignRequest } from '../../models'
import { buildHardwareSigningCallbacks } from '../buildHardwareSigningCallbacks'

const hwAccount: WalletAccount = {
    type: AccountTypes.hardware,
    address: 'ADDR',
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'dev-1',
        deviceName: 'Nano X',
        accountIndex: 0,
        transportType: 'ble',
    },
} as never

const request = { id: 'req-1' } as SignRequest

describe('buildHardwareSigningCallbacks', () => {
    beforeEach(() => {
        useHardwareSigningStore.getState().resetState()
    })

    it('onPhaseChange("connecting") sets status="searching" and captures deviceName', () => {
        const cbs = buildHardwareSigningCallbacks(request, hwAccount)
        cbs.onPhaseChange?.('connecting')
        const state = useHardwareSigningStore.getState()
        expect(state.status).toBe('searching')
        expect(state.deviceName).toBe('Nano X')
        expect(state.requestId).toBe('req-1')
    })

    it('captures null deviceName when signerAccount is not a hardware account', () => {
        const cbs = buildHardwareSigningCallbacks(request, undefined)
        cbs.onPhaseChange?.('connecting')
        expect(useHardwareSigningStore.getState().deviceName).toBeNull()
    })

    it('onPhaseChange("awaiting-approval") sets status="awaitingApproval"', () => {
        const cbs = buildHardwareSigningCallbacks(request, hwAccount)
        cbs.onPhaseChange?.('connecting')
        cbs.onPhaseChange?.('awaiting-approval')
        expect(useHardwareSigningStore.getState().status).toBe(
            'awaitingApproval',
        )
    })

    it('onSigningStart sets status="signing"', () => {
        const cbs = buildHardwareSigningCallbacks(request, hwAccount)
        cbs.onPhaseChange?.('connecting')
        cbs.onSigningStart?.()
        expect(useHardwareSigningStore.getState().status).toBe('signing')
    })

    it('onProgress updates progress counters without changing status', () => {
        const cbs = buildHardwareSigningCallbacks(request, hwAccount)
        cbs.onPhaseChange?.('connecting')
        cbs.onSigningStart?.()
        // Status is now 'signing'; onProgress must NOT flip it to 'awaitingApproval'
        cbs.onProgress?.(2, 5)
        const state = useHardwareSigningStore.getState()
        expect(state.currentTx).toBe(2)
        expect(state.totalTxs).toBe(5)
        expect(state.status).toBe('signing')
    })

    it('onProgress for a skipped index does not flip status to "awaitingApproval"', () => {
        // Simulates a 3-tx group where indicesToSign=[0,2] — index 1 is skipped.
        // The strategy should not call onProgress for skipped indices at all,
        // so this test verifies that calling onProgress directly does not
        // inadvertently change status.
        const cbs = buildHardwareSigningCallbacks(request, hwAccount)
        cbs.onPhaseChange?.('connecting')
        cbs.onSigningStart?.()
        // Even if onProgress were called for a skipped index, it must not
        // change the status — status transitions belong to onPhaseChange.
        cbs.onProgress?.(1, 3)
        expect(useHardwareSigningStore.getState().status).toBe('signing')
    })

    it('onPhaseChange("awaiting-approval") after onSigningStart sets status="awaitingApproval"', () => {
        // Verifies that status transitions between txs come from onPhaseChange,
        // not from onProgress. The strategy emits onPhaseChange('awaiting-approval')
        // before each signTransaction call.
        const cbs = buildHardwareSigningCallbacks(request, hwAccount)
        cbs.onPhaseChange?.('connecting')
        cbs.onSigningStart?.()
        expect(useHardwareSigningStore.getState().status).toBe('signing')
        cbs.onPhaseChange?.('awaiting-approval')
        expect(useHardwareSigningStore.getState().status).toBe(
            'awaitingApproval',
        )
    })

    it('onSigningStart status "signing" survives until next onPhaseChange signal', () => {
        // Verifies the sequence: onSigningStart → 'signing' (durable) →
        // onPhaseChange('awaiting-approval') → 'awaitingApproval'.
        // In between, calling onProgress must not disturb the 'signing' state.
        const cbs = buildHardwareSigningCallbacks(request, hwAccount)
        cbs.onPhaseChange?.('connecting')
        cbs.onSigningStart?.()
        const afterSigningStart = useHardwareSigningStore.getState().status
        expect(afterSigningStart).toBe('signing')

        // Progress fires (for a signable tx) — status must remain 'signing'
        cbs.onProgress?.(1, 3)
        expect(useHardwareSigningStore.getState().status).toBe('signing')

        // Only onPhaseChange may advance the status
        cbs.onPhaseChange?.('awaiting-approval')
        expect(useHardwareSigningStore.getState().status).toBe(
            'awaitingApproval',
        )
    })

    it('onError(LedgerAppNotOpenError) sets payload kind="app_not_open"', () => {
        const cbs = buildHardwareSigningCallbacks(request, hwAccount)
        cbs.onPhaseChange?.('connecting')
        cbs.onError?.(new LedgerAppNotOpenError())
        expect(useHardwareSigningStore.getState().error?.kind).toBe(
            'app_not_open',
        )
    })

    it('onError(LedgerUserRejectedError) sets kind="user_rejected"', () => {
        const cbs = buildHardwareSigningCallbacks(request, hwAccount)
        cbs.onPhaseChange?.('connecting')
        cbs.onError?.(new LedgerUserRejectedError())
        expect(useHardwareSigningStore.getState().error?.kind).toBe(
            'user_rejected',
        )
    })

    it('onError(generic Error) falls back to kind="connection_failed"', () => {
        const cbs = buildHardwareSigningCallbacks(request, hwAccount)
        cbs.onPhaseChange?.('connecting')
        cbs.onError?.(new Error('boom'))
        expect(useHardwareSigningStore.getState().error?.kind).toBe(
            'connection_failed',
        )
    })
})
