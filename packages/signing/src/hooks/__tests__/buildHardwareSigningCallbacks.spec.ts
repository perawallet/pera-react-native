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
import { buildHardwareSigningCallbacks } from '../useSigningActorLifecycle'

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

    it('onProgress updates progress and returns status to "awaitingApproval"', () => {
        const cbs = buildHardwareSigningCallbacks(request, hwAccount)
        cbs.onPhaseChange?.('connecting')
        cbs.onSigningStart?.()
        cbs.onProgress?.(2, 5)
        const state = useHardwareSigningStore.getState()
        expect(state.currentTx).toBe(2)
        expect(state.totalTxs).toBe(5)
        expect(state.status).toBe('awaitingApproval')
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
