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
import {
    settleCosignAttempt,
    useSwapCosignResolver,
} from '../useSwapCosignResolver'

const mocks = vi.hoisted(() => ({
    useNetwork: vi.fn(),
    useAlgorandClient: vi.fn(),
    useDeviceID: vi.fn(),
    decodeFromBase64: vi.fn(),
    loggerWarn: vi.fn(),
    addSignature: vi.fn(),
    getSignRequestsWithSignatures: vi.fn(),
    getSignRequestsWithSignaturesQueryKey: vi.fn(),
    useMarkSignRequestsConfirmedMutation: vi.fn(),
    classifyHandoffPoll: vi.fn(),
    submitRawSignedTransactionGroup: vi.fn(),
    useHandoffResolver: vi.fn(),
    resolveSwapHandoffOutcome: vi.fn(),
    useUpdateSwapStatusMutation: vi.fn(),
    recordSubmissionAttempt: vi.fn(),
    markSubmissionUnknown: vi.fn(),
    resolveSubmissionAttempt: vi.fn(),
    setSubmissionSettledHandler: vi.fn(),
    markHandoffSubmitted: vi.fn(),
    removeHandoff: vi.fn(),
    markConfirmed: vi.fn(),
    updateSwapStatus: vi.fn(),
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
    logger: { warn: mocks.loggerWarn },
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
    recordSubmissionAttempt: mocks.recordSubmissionAttempt,
    markSubmissionUnknown: mocks.markSubmissionUnknown,
    resolveSubmissionAttempt: mocks.resolveSubmissionAttempt,
    setSubmissionSettledHandler: mocks.setSubmissionSettledHandler,
}))
vi.mock('../../utils', () => ({
    resolveSwapHandoffOutcome: mocks.resolveSwapHandoffOutcome,
}))
vi.mock('../../store', () => {
    const store = (selector: (s: unknown) => unknown) =>
        selector({
            handoffs: mocks.handoffs,
            markHandoffSubmitted: mocks.markHandoffSubmitted,
            removeHandoff: mocks.removeHandoff,
        })
    store.getState = () => ({
        handoffs: mocks.handoffs,
        markHandoffSubmitted: mocks.markHandoffSubmitted,
        removeHandoff: mocks.removeHandoff,
    })
    return { useSwapHandoffStore: store }
})
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
        markConfirmed: mocks.markConfirmed,
    })
    mocks.useUpdateSwapStatusMutation.mockReturnValue({
        mutateAsync: mocks.updateSwapStatus,
    })
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

    it('wires the submission-ledger deps through to the signing package', async () => {
        const handoff = makeRecord()
        mocks.handoffs = { 'req-1': handoff }

        render()

        config().resolve({ kind: 'ready', assembledBytes: [] }, handoff, {
            proposer_address: 'PROPOSER',
        })
        const { deps } = mocks.resolveSwapHandoffOutcome.mock.calls[0][0]

        await deps.recordSubmissionAttempt({
            network: 'mainnet',
            txIds: ['t'],
            flow: 'cosign',
            intentKey: { kind: 'cosign', signRequestId: 'req-1', swapId: '42' },
        })
        expect(mocks.recordSubmissionAttempt).toHaveBeenCalledWith({
            network: 'mainnet',
            txIds: ['t'],
            flow: 'cosign',
            intentKey: { kind: 'cosign', signRequestId: 'req-1', swapId: '42' },
        })

        await deps.markSubmissionUnknown('row-1')
        expect(mocks.markSubmissionUnknown).toHaveBeenCalledWith({
            id: 'row-1',
        })

        await deps.markSubmissionFailed('row-1')
        expect(mocks.resolveSubmissionAttempt).toHaveBeenCalledWith({
            id: 'row-1',
            status: 'failed',
        })
    })

    it('registers a cosign settle handler that replays the tail on confirmation', async () => {
        mocks.handoffs = {
            'req-1': makeRecord({
                submission: { txIds: ['txid-1'], submittedAt: 2 },
            }),
        }

        render()

        expect(mocks.setSubmissionSettledHandler).toHaveBeenCalledWith(
            'cosign',
            expect.any(Function),
        )
        const handler = mocks.setSubmissionSettledHandler.mock.calls[0][1]

        await handler(['txid-1'], 'mainnet', 'confirmed')

        expect(mocks.markConfirmed).toHaveBeenCalledWith({
            network: 'mainnet',
            deviceId: 'device-1',
            signRequestIds: ['req-1'],
        })
        expect(mocks.updateSwapStatus).toHaveBeenCalledWith({
            swapId: '42',
            data: {
                status: 'in_progress',
                submitted_transaction_ids: ['txid-1'],
                swap_version: 'v2',
            },
        })
        expect(mocks.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    it('fails and removes the retained handoff without declining on a definitive failure', async () => {
        mocks.handoffs = {
            'req-1': makeRecord({
                submission: { txIds: ['txid-1'], submittedAt: 2 },
            }),
        }

        render()

        const handler = mocks.setSubmissionSettledHandler.mock.calls[0][1]
        await handler(['txid-1'], 'mainnet', 'failed')

        expect(mocks.updateSwapStatus).toHaveBeenCalledWith({
            swapId: '42',
            data: {
                status: 'failed',
                reason: 'blockchain_error',
                swap_version: 'v2',
            },
        })
        expect(mocks.addSignature).not.toHaveBeenCalled()
        expect(mocks.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    it('clears the cosign settle handler on unmount', () => {
        const view = render()

        view.unmount()

        expect(mocks.setSubmissionSettledHandler).toHaveBeenLastCalledWith(
            'cosign',
            null,
        )
    })
})

describe('settleCosignAttempt', () => {
    const settleDeps = () => ({
        markConfirmed: vi.fn().mockResolvedValue(undefined),
        updateSwapStatus: vi.fn().mockResolvedValue(undefined),
        removeHandoff: vi.fn(),
    })

    it('confirmed: replays the post-submit tail for each matching handoff', async () => {
        const handoff = makeRecord({
            submission: { txIds: ['txid-1', 'txid-2'], submittedAt: 2 },
        })
        const deps = settleDeps()

        await settleCosignAttempt(
            { 'req-1': handoff },
            ['txid-2'],
            'mainnet',
            'confirmed',
            deps,
        )

        expect(deps.markConfirmed).toHaveBeenCalledWith({
            network: 'mainnet',
            deviceId: 'device-1',
            signRequestIds: ['req-1'],
        })
        expect(deps.updateSwapStatus).toHaveBeenCalledWith({
            swapId: '42',
            data: {
                status: 'in_progress',
                submitted_transaction_ids: ['txid-2'],
                swap_version: 'v2',
            },
        })
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    it('failed: marks the swap failed and removes the handoff', async () => {
        const handoff = makeRecord({
            submission: { txIds: ['txid-1'], submittedAt: 2 },
        })
        const deps = settleDeps()

        await settleCosignAttempt(
            { 'req-1': handoff },
            ['txid-1'],
            'mainnet',
            'failed',
            deps,
        )

        expect(deps.updateSwapStatus).toHaveBeenCalledWith({
            swapId: '42',
            data: {
                status: 'failed',
                reason: 'blockchain_error',
                swap_version: 'v2',
            },
        })
        expect(deps.markConfirmed).not.toHaveBeenCalled()
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    it('confirmed: a throwing markConfirmed is best-effort — status and cleanup still run', async () => {
        const handoff = makeRecord({
            submission: { txIds: ['txid-1'], submittedAt: 2 },
        })
        const deps = settleDeps()
        deps.markConfirmed.mockRejectedValueOnce(new Error('network'))

        await settleCosignAttempt(
            { 'req-1': handoff },
            ['txid-1'],
            'mainnet',
            'confirmed',
            deps,
        )

        expect(deps.updateSwapStatus).toHaveBeenCalled()
        expect(deps.removeHandoff).toHaveBeenCalledWith('req-1')
    })

    it('ignores handoffs on other networks or without an intersecting submission', async () => {
        const otherNetwork = makeRecord({
            signRequestId: 'other-net',
            network: 'testnet',
            submission: { txIds: ['txid-1'], submittedAt: 2 },
        })
        const noSubmission = makeRecord({ signRequestId: 'no-sub' })
        const noIntersection = makeRecord({
            signRequestId: 'other-txids',
            submission: { txIds: ['txid-other'], submittedAt: 2 },
        })
        const deps = settleDeps()

        await settleCosignAttempt(
            {
                'other-net': otherNetwork,
                'no-sub': noSubmission,
                'other-txids': noIntersection,
            },
            ['txid-1'],
            'mainnet',
            'confirmed',
            deps,
        )

        expect(deps.markConfirmed).not.toHaveBeenCalled()
        expect(deps.updateSwapStatus).not.toHaveBeenCalled()
        expect(deps.removeHandoff).not.toHaveBeenCalled()
    })
})
