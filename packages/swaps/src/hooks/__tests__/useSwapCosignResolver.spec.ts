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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { SwapHandoffRecord } from '../../models'
import { useSwapCosignResolver } from '../useSwapCosignResolver'

const mocks = vi.hoisted(() => ({
    useNetwork: vi.fn(),
    useAlgorandClient: vi.fn(),
    useDeviceID: vi.fn(),
    decodeFromBase64: vi.fn(),
    addSignature: vi.fn(),
    useMarkSignRequestsConfirmedMutation: vi.fn(),
    classifyHandoffPoll: vi.fn(),
    submitRawSignedTransactionGroup: vi.fn(),
    resolveSwapHandoffOutcome: vi.fn(),
    useUpdateSwapStatusMutation: vi.fn(),
    useSwapHandoffPolls: vi.fn(),
    removeHandoff: vi.fn(),
    handoffs: {} as Record<string, SwapHandoffRecord>,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mocks.useNetwork,
    useAlgorandClient: mocks.useAlgorandClient,
}))
vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: mocks.useDeviceID,
}))
vi.mock('@perawallet/wallet-core-shared', () => ({
    decodeFromBase64: mocks.decodeFromBase64,
}))
vi.mock('@perawallet/wallet-core-multisig', () => ({
    addSignature: mocks.addSignature,
    useMarkSignRequestsConfirmedMutation:
        mocks.useMarkSignRequestsConfirmedMutation,
}))
vi.mock('@perawallet/wallet-core-signing', () => ({
    classifyHandoffPoll: mocks.classifyHandoffPoll,
    submitRawSignedTransactionGroup: mocks.submitRawSignedTransactionGroup,
}))
vi.mock('../../utils', () => ({
    resolveSwapHandoffOutcome: mocks.resolveSwapHandoffOutcome,
}))
vi.mock('../../store', () => ({
    useSwapHandoffStore: (selector: (s: unknown) => unknown) =>
        selector({
            handoffs: mocks.handoffs,
            removeHandoff: mocks.removeHandoff,
        }),
}))
vi.mock('../useUpdateSwapStatusMutation', () => ({
    useUpdateSwapStatusMutation: mocks.useUpdateSwapStatusMutation,
}))
vi.mock('../useSwapHandoffPolls', () => ({
    useSwapHandoffPolls: mocks.useSwapHandoffPolls,
}))

const ALGORAND_CLIENT = { id: 'algod' }

const makeRecord = (
    overrides: Partial<SwapHandoffRecord> = {},
): SwapHandoffRecord => ({
    swapIdStr: '42',
    signRequestId: 'req-1',
    network: 'mainnet',
    multisigAddress: 'JOINT_ADDR',
    deviceId: 'device-1',
    msigMetadata: { version: 1, threshold: 2, addresses: ['A', 'B'] },
    plan: [],
    expectedRawTransactionsBase64: ['cmF3'],
    registeredAt: 1,
    ...overrides,
})

const reportError = vi.fn()

const render = (isAppActive = true) =>
    renderHook(props => useSwapCosignResolver(props), {
        initialProps: { isAppActive, reportError },
    })

// The deps object the hook builds and hands to resolveSwapHandoffOutcome.
const capturedDeps = () => mocks.resolveSwapHandoffOutcome.mock.calls[0][0].deps

beforeEach(() => {
    vi.clearAllMocks()
    mocks.handoffs = {}
    mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
    mocks.useAlgorandClient.mockReturnValue(ALGORAND_CLIENT)
    mocks.useDeviceID.mockReturnValue('device-1')
    mocks.useMarkSignRequestsConfirmedMutation.mockReturnValue({
        markConfirmed: vi.fn(),
    })
    mocks.useUpdateSwapStatusMutation.mockReturnValue({ mutateAsync: vi.fn() })
    mocks.resolveSwapHandoffOutcome.mockResolvedValue(undefined)
    mocks.classifyHandoffPoll.mockReturnValue({ kind: 'keep-polling' })
    mocks.useSwapHandoffPolls.mockReturnValue([])
})

describe('swaps/useSwapCosignResolver', () => {
    it('polls only the handoffs on the active network', () => {
        const onMainnet = makeRecord({ signRequestId: 'a', network: 'mainnet' })
        const onTestnet = makeRecord({ signRequestId: 'b', network: 'testnet' })
        mocks.handoffs = { a: onMainnet, b: onTestnet }

        render()

        expect(mocks.useSwapHandoffPolls).toHaveBeenCalledWith(
            expect.objectContaining({ handoffs: [onMainnet] }),
        )
    })

    it('resolves a terminal outcome exactly once with the matching record', () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }
        mocks.useSwapHandoffPolls.mockReturnValue([
            { handoff, detail: { proposer_address: 'PROPOSER' } },
        ])
        mocks.classifyHandoffPoll.mockReturnValue({
            kind: 'ready',
            assembledBytes: [],
        })

        render()

        expect(mocks.resolveSwapHandoffOutcome).toHaveBeenCalledTimes(1)
        expect(mocks.resolveSwapHandoffOutcome).toHaveBeenCalledWith(
            expect.objectContaining({
                outcome: { kind: 'ready', assembledBytes: [] },
                record: handoff,
            }),
        )
    })

    it('keeps polling without resolving while the outcome is non-terminal', () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }
        mocks.useSwapHandoffPolls.mockReturnValue([
            { handoff, detail: { proposer_address: 'PROPOSER' } },
        ])
        mocks.classifyHandoffPoll.mockReturnValue({ kind: 'keep-polling' })

        render()

        expect(mocks.resolveSwapHandoffOutcome).not.toHaveBeenCalled()
    })

    it('skips polls with no result yet, and never classifies them', () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }
        mocks.useSwapHandoffPolls.mockReturnValue([
            { handoff, detail: undefined },
        ])

        render()

        expect(mocks.classifyHandoffPoll).not.toHaveBeenCalled()
        expect(mocks.resolveSwapHandoffOutcome).not.toHaveBeenCalled()
    })

    it('does not re-resolve the same handoff on a later re-render', () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }
        mocks.classifyHandoffPoll.mockReturnValue({
            kind: 'ready',
            assembledBytes: [],
        })
        // Distinct array references force the effect to re-run each render.
        mocks.useSwapHandoffPolls
            .mockReturnValueOnce([
                { handoff, detail: { proposer_address: 'PROPOSER' } },
            ])
            .mockReturnValueOnce([
                { handoff, detail: { proposer_address: 'PROPOSER' } },
            ])

        const { rerender } = render()
        rerender({ isAppActive: true, reportError })

        expect(mocks.resolveSwapHandoffOutcome).toHaveBeenCalledTimes(1)
    })

    it('wires submitGroup through to the algod submission helper', async () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }
        mocks.useSwapHandoffPolls.mockReturnValue([
            { handoff, detail: { proposer_address: 'PROPOSER' } },
        ])
        mocks.classifyHandoffPoll.mockReturnValue({
            kind: 'ready',
            assembledBytes: [],
        })
        mocks.submitRawSignedTransactionGroup.mockResolvedValue(['txid'])

        render()

        const bytes = [new Uint8Array([1])]
        await capturedDeps().submitGroup(bytes)
        expect(mocks.submitRawSignedTransactionGroup).toHaveBeenCalledWith(
            ALGORAND_CLIENT,
            bytes,
        )
    })

    it('declines the proposer request on the proposer address from the poll', async () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }
        mocks.useSwapHandoffPolls.mockReturnValue([
            { handoff, detail: { proposer_address: 'PROPOSER' } },
        ])
        mocks.classifyHandoffPoll.mockReturnValue({
            kind: 'error',
            reason: { kind: 'backend-failed', displayReason: null },
        })

        render()

        await capturedDeps().declineSignRequest('req-1')
        expect(mocks.addSignature).toHaveBeenCalledWith('mainnet', 'req-1', [
            { address: 'PROPOSER', response: 'declined', device_id: 'device-1' },
        ])
    })

    it('skips the decline when the poll carried no proposer address', async () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }
        mocks.useSwapHandoffPolls.mockReturnValue([
            { handoff, detail: {} },
        ])
        mocks.classifyHandoffPoll.mockReturnValue({
            kind: 'error',
            reason: { kind: 'backend-failed', displayReason: null },
        })

        render()

        await capturedDeps().declineSignRequest('req-1')
        expect(mocks.addSignature).not.toHaveBeenCalled()
    })
})
