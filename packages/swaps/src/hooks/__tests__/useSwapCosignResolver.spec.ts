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
    getSignRequestsWithSignatures: vi.fn(),
    getSignRequestsWithSignaturesQueryKey: vi.fn(),
    useMarkSignRequestsConfirmedMutation: vi.fn(),
    classifyHandoffPoll: vi.fn(),
    submitRawSignedTransactionGroup: vi.fn(),
    useHandoffResolver: vi.fn(),
    resolveSwapHandoffOutcome: vi.fn(),
    useUpdateSwapStatusMutation: vi.fn(),
    markHandoffSubmitted: vi.fn(),
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
    getSignRequestsWithSignatures: mocks.getSignRequestsWithSignatures,
    getSignRequestsWithSignaturesQueryKey:
        mocks.getSignRequestsWithSignaturesQueryKey,
    useMarkSignRequestsConfirmedMutation:
        mocks.useMarkSignRequestsConfirmedMutation,
}))
vi.mock('@perawallet/wallet-core-signing', () => ({
    classifyHandoffPoll: mocks.classifyHandoffPoll,
    submitRawSignedTransactionGroup: mocks.submitRawSignedTransactionGroup,
    useHandoffResolver: mocks.useHandoffResolver,
}))
vi.mock('../../utils', () => ({
    resolveSwapHandoffOutcome: mocks.resolveSwapHandoffOutcome,
}))
vi.mock('../../store', () => ({
    useSwapHandoffStore: (selector: (s: unknown) => unknown) =>
        selector({
            handoffs: mocks.handoffs,
            markHandoffSubmitted: mocks.markHandoffSubmitted,
            removeHandoff: mocks.removeHandoff,
        }),
}))
vi.mock('../useUpdateSwapStatusMutation', () => ({
    useUpdateSwapStatusMutation: mocks.useUpdateSwapStatusMutation,
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

// The config object the hook hands to the shared resolver core.
type ResolverConfig = Parameters<typeof mocks.useHandoffResolver>[0]
const config = (): ResolverConfig => mocks.useHandoffResolver.mock.calls[0][0]

beforeEach(() => {
    vi.clearAllMocks()
    mocks.handoffs = {}
    mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
    mocks.useAlgorandClient.mockReturnValue(ALGORAND_CLIENT)
    mocks.useDeviceID.mockReturnValue('device-1')
    mocks.getSignRequestsWithSignaturesQueryKey.mockImplementation(
        (network: string, id: string) => ['msig', network, id],
    )
    mocks.useMarkSignRequestsConfirmedMutation.mockReturnValue({
        markConfirmed: vi.fn(),
    })
    mocks.useUpdateSwapStatusMutation.mockReturnValue({ mutateAsync: vi.fn() })
    mocks.resolveSwapHandoffOutcome.mockResolvedValue(undefined)
})

describe('swaps/useSwapCosignResolver', () => {
    it('drives the shared resolver over all handoffs, opting into the active-network filter', () => {
        const onMainnet = makeRecord({ signRequestId: 'a', network: 'mainnet' })
        const onTestnet = makeRecord({ signRequestId: 'b', network: 'testnet' })
        mocks.handoffs = { a: onMainnet, b: onTestnet }

        render()

        const cfg = config()
        // The core owns the filter; the wrapper just supplies all handoffs plus
        // the active network and a per-handoff network accessor.
        expect(cfg.handoffs).toEqual([onMainnet, onTestnet])
        expect(cfg.activeNetwork).toBe('mainnet')
        expect(cfg.networkOf(onTestnet)).toBe('testnet')
        expect(cfg.keyOf(onMainnet)).toBe('a')
    })

    it('builds a with-signatures poll keyed by network + id, gated on foreground and device id', () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }

        render()

        const descriptor = config().poll(handoff)
        expect(descriptor.queryKey).toEqual(['msig', 'mainnet', 'req-1'])
        expect(descriptor.enabled).toBe(true)

        descriptor.queryFn()
        expect(mocks.getSignRequestsWithSignatures).toHaveBeenCalledWith(
            'mainnet',
            { device_id: 'device-1', proposed_sign_request_ids: ['req-1'] },
        )

        const match = { id: 'req-1' }
        expect(descriptor.select([{ id: 'other' }, match])).toBe(match)
    })

    it('disables the poll while backgrounded or before a device id is set', () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }

        render(false)
        expect(config().poll(handoff).enabled).toBe(false)

        vi.clearAllMocks()
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
        mocks.useAlgorandClient.mockReturnValue(ALGORAND_CLIENT)
        mocks.useDeviceID.mockReturnValue(null)
        mocks.getSignRequestsWithSignaturesQueryKey.mockImplementation(
            (network: string, id: string) => ['msig', network, id],
        )
        mocks.useMarkSignRequestsConfirmedMutation.mockReturnValue({
            markConfirmed: vi.fn(),
        })
        mocks.useUpdateSwapStatusMutation.mockReturnValue({
            mutateAsync: vi.fn(),
        })
        render(true)
        expect(config().poll(handoff).enabled).toBe(false)
    })

    it('classifies a poll with the record assembly context', () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }
        const detail = { id: 'req-1' }

        render()

        config().classify(detail, handoff)
        expect(mocks.classifyHandoffPoll).toHaveBeenCalledWith(detail, {
            multisigAddress: 'JOINT_ADDR',
            msigMetadata: { version: 1, threshold: 2, addresses: ['A', 'B'] },
            expectedRawTransactionsBase64: ['cmF3'],
        })
    })

    it('short-circuits classification for an already-submitted record', async () => {
        const handoff = makeRecord({
            submission: { txIds: ['txid-1'], submittedAt: 2 },
        })
        mocks.handoffs = { 'req-1': handoff }

        render()

        // The group is on chain; re-verifying signatures (or stalling on a
        // pruned poll body) is pointless — resolve immediately.
        const outcome = await config().classify({ id: 'req-1' }, handoff)
        expect(outcome).toEqual({ kind: 'ready', assembledBytes: [] })
        expect(mocks.classifyHandoffPoll).not.toHaveBeenCalled()
    })

    it('persists the submitted marker through the store action', async () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }

        render()

        config().resolve({ kind: 'ready', assembledBytes: [] }, handoff, {
            proposer_address: 'PROPOSER',
        })
        const { deps } = mocks.resolveSwapHandoffOutcome.mock.calls[0][0]

        deps.markSubmitted(['txid-1'])
        expect(mocks.markHandoffSubmitted).toHaveBeenCalledWith('req-1', [
            'txid-1',
        ])
    })

    it('resolves a terminal outcome through resolveSwapHandoffOutcome with the record', () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }
        const outcome = { kind: 'ready', assembledBytes: [] }

        render()

        config().resolve(outcome, handoff, { proposer_address: 'PROPOSER' })
        expect(mocks.resolveSwapHandoffOutcome).toHaveBeenCalledWith(
            expect.objectContaining({ outcome, record: handoff }),
        )
    })

    it('wires submitGroup through to the algod submission helper', async () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }
        mocks.submitRawSignedTransactionGroup.mockResolvedValue(['txid'])

        render()

        config().resolve({ kind: 'ready', assembledBytes: [] }, handoff, {
            proposer_address: 'PROPOSER',
        })
        const { deps } = mocks.resolveSwapHandoffOutcome.mock.calls[0][0]

        const bytes = [new Uint8Array([1])]
        await deps.submitGroup(bytes)
        expect(mocks.submitRawSignedTransactionGroup).toHaveBeenCalledWith(
            ALGORAND_CLIENT,
            bytes,
        )
    })

    it('declines on the proposer address carried by the poll detail', async () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }

        render()

        config().resolve(
            {
                kind: 'error',
                reason: { kind: 'backend-failed', displayReason: null },
            },
            handoff,
            { proposer_address: 'PROPOSER' },
        )
        const { deps } = mocks.resolveSwapHandoffOutcome.mock.calls[0][0]

        await deps.declineSignRequest('req-1')
        expect(mocks.addSignature).toHaveBeenCalledWith('mainnet', 'req-1', [
            {
                address: 'PROPOSER',
                response: 'declined',
                device_id: 'device-1',
            },
        ])
    })

    it('skips the decline when the poll carried no proposer address', async () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }

        render()

        config().resolve(
            {
                kind: 'error',
                reason: { kind: 'backend-failed', displayReason: null },
            },
            handoff,
            {},
        )
        const { deps } = mocks.resolveSwapHandoffOutcome.mock.calls[0][0]

        await deps.declineSignRequest('req-1')
        expect(mocks.addSignature).not.toHaveBeenCalled()
    })
})
