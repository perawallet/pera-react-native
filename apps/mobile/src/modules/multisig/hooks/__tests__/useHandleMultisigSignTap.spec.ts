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
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    MultisigSignRequest,
    SignRequestStatus,
} from '@perawallet/wallet-core-multisig'

const openSheetMock = vi.fn()
const addSignRequestMock = vi.fn()
const decodeTransactionMock = vi.fn(() => ({}))
const localUnsignedSignersMock = vi.fn<() => WalletAccount[]>(() => [])
const buildCosignArgsMock = vi.fn()
const cosignRequestStub = { id: 'cosign-stub' }

vi.mock('../../stores/usePendingSignaturesSheetStore', () => ({
    usePendingSignaturesSheetStore: (
        selector: (state: { openSheet: typeof openSheetMock }) => unknown,
    ) => selector({ openSheet: openSheetMock }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAllAccounts: () => [],
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    // The accounts barrel subscribes to the network store at load.
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
    useTransactionEncoder: () => ({ decodeTransaction: decodeTransactionMock }),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: addSignRequestMock }),
}))

vi.mock('../../utils/getLocalUnsignedSigners', () => ({
    getLocalUnsignedSigners: (...args: unknown[]) =>
        localUnsignedSignersMock(...(args as [])),
}))

vi.mock('../../utils/buildMultisigCosignRequest', () => ({
    buildMultisigCosignRequest: (
        args: Parameters<typeof buildCosignArgsMock>[0],
    ) => {
        buildCosignArgsMock(args)
        return cosignRequestStub
    },
}))

import { useHandleMultisigSignTap } from '../useHandleMultisigSignTap'

const buildSignRequest = (
    overrides: Partial<MultisigSignRequest> = {},
): MultisigSignRequest =>
    ({
        id: 'sr-9',
        status: 'pending',
        type: 'async',
        createdAt: new Date('2026-05-06T09:00:00Z'),
        expectedExpireDatetime: new Date('2026-05-06T11:00:00Z'),
        failReasonDisplay: null,
        proposerAddress: null,
        multisigAccount: {
            customId: 'm-1',
            createdAt: new Date('2026-05-06T09:00:00Z'),
            address: 'MULTISIG',
            version: 1,
            threshold: 2,
            participantAddresses: ['A', 'B', 'C'],
        },
        transactionLists: [
            {
                id: 'txl-1',
                rawTransactions: ['tx'],
                firstValidBlock: 1,
                lastValidBlock: 100,
                expectedExpireDatetime: new Date('2026-05-06T11:00:00Z'),
                responses: [],
            },
        ],
        ...overrides,
    }) as unknown as MultisigSignRequest

const buildAccount = (address: string): WalletAccount => ({
    id: `algo25-${address}`,
    type: AccountTypes.algo25,
    address,
    keyPairId: `kp-${address}`,
})

const buildHardwareAccount = (address: string): WalletAccount => ({
    id: `hardware-${address}`,
    type: AccountTypes.hardware,
    address,
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'dev-1',
        deviceName: 'Ledger Nano X',
        accountIndex: 0,
        transportType: 'ble',
    },
})

describe('useHandleMultisigSignTap', () => {
    beforeEach(() => {
        openSheetMock.mockClear()
        addSignRequestMock.mockClear()
        buildCosignArgsMock.mockClear()
        localUnsignedSignersMock.mockReset()
        localUnsignedSignersMock.mockReturnValue([])
    })

    it.each<SignRequestStatus>(['pending', 'ready'])(
        'dispatches a cosign SignRequest for status %s when a local signer is unsigned and does NOT open the pending sheet',
        status => {
            localUnsignedSignersMock.mockReturnValue([buildAccount('A')])

            const { result } = renderHook(() => useHandleMultisigSignTap())
            const signRequest = buildSignRequest({ id: 'sr-1', status })
            result.current(signRequest)

            expect(buildCosignArgsMock).toHaveBeenCalledTimes(1)
            expect(buildCosignArgsMock).toHaveBeenCalledWith({
                signRequest,
                signerAddress: 'A',
                decodeTransaction: decodeTransactionMock,
            })
            expect(addSignRequestMock).toHaveBeenCalledTimes(1)
            expect(addSignRequestMock).toHaveBeenCalledWith(cosignRequestStub)
            expect(openSheetMock).not.toHaveBeenCalled()
        },
    )

    it('dispatches one cosign per local unsigned signer in order', () => {
        localUnsignedSignersMock.mockReturnValue([
            buildAccount('A'),
            buildAccount('B'),
        ])

        const { result } = renderHook(() => useHandleMultisigSignTap())
        result.current(buildSignRequest({ status: 'pending' }))

        expect(buildCosignArgsMock).toHaveBeenCalledTimes(2)
        expect(
            (
                buildCosignArgsMock.mock.calls[0]![0] as {
                    signerAddress: string
                }
            ).signerAddress,
        ).toBe('A')
        expect(
            (
                buildCosignArgsMock.mock.calls[1]![0] as {
                    signerAddress: string
                }
            ).signerAddress,
        ).toBe('B')
        expect(addSignRequestMock).toHaveBeenCalledTimes(2)
        expect(addSignRequestMock).toHaveBeenNthCalledWith(1, cosignRequestStub)
        expect(addSignRequestMock).toHaveBeenNthCalledWith(2, cosignRequestStub)
        expect(openSheetMock).not.toHaveBeenCalled()
    })

    it('opens the pending sheet when status is actionable but no local signer is unsigned', () => {
        localUnsignedSignersMock.mockReturnValue([])

        const { result } = renderHook(() => useHandleMultisigSignTap())
        result.current(buildSignRequest({ id: 'sr-42', status: 'pending' }))

        expect(openSheetMock).toHaveBeenCalledTimes(1)
        expect(openSheetMock).toHaveBeenCalledWith('sr-42')
        expect(addSignRequestMock).not.toHaveBeenCalled()
        expect(buildCosignArgsMock).not.toHaveBeenCalled()
    })

    it.each<SignRequestStatus>([
        'submitting',
        'confirmed',
        'failed',
        'expired',
        'declined',
    ])(
        'opens the pending sheet for non-actionable status %s even when a local signer is present',
        status => {
            localUnsignedSignersMock.mockReturnValue([buildAccount('A')])

            const { result } = renderHook(() => useHandleMultisigSignTap())
            result.current(buildSignRequest({ id: `sr-${status}`, status }))

            expect(openSheetMock).toHaveBeenCalledWith(`sr-${status}`)
            expect(addSignRequestMock).not.toHaveBeenCalled()
            expect(buildCosignArgsMock).not.toHaveBeenCalled()
            expect(localUnsignedSignersMock).not.toHaveBeenCalled()
        },
    )

    it('opens the pending sheet when transactionLists is empty (no local unsigned signers resolvable)', () => {
        localUnsignedSignersMock.mockReturnValue([])

        const { result } = renderHook(() => useHandleMultisigSignTap())
        result.current(
            buildSignRequest({
                id: 'sr-empty',
                status: 'pending',
                transactionLists: [],
            }),
        )

        expect(openSheetMock).toHaveBeenCalledWith('sr-empty')
        expect(addSignRequestMock).not.toHaveBeenCalled()
    })

    it('dispatches local-key cosigns AND opens the pending sheet when hardware participants are also unsigned', () => {
        // Ledger prompts must never auto-fire on inbox tap; the per-row
        // Sign button in PendingSignaturesContent is the only entry point.
        localUnsignedSignersMock.mockReturnValue([
            buildAccount('A'),
            buildHardwareAccount('L'),
        ])

        const { result } = renderHook(() => useHandleMultisigSignTap())
        result.current(buildSignRequest({ id: 'sr-mixed', status: 'pending' }))

        // Local-key A is dispatched; hardware L is NOT.
        expect(buildCosignArgsMock).toHaveBeenCalledTimes(1)
        expect(
            (
                buildCosignArgsMock.mock.calls[0]![0] as {
                    signerAddress: string
                }
            ).signerAddress,
        ).toBe('A')
        expect(addSignRequestMock).toHaveBeenCalledTimes(1)
        // Sheet opens so the user can per-row Sign the Ledger participant.
        expect(openSheetMock).toHaveBeenCalledWith('sr-mixed')
    })

    it('opens the pending sheet WITHOUT dispatching anything when only hardware participants are unsigned', () => {
        localUnsignedSignersMock.mockReturnValue([buildHardwareAccount('L')])

        const { result } = renderHook(() => useHandleMultisigSignTap())
        result.current(
            buildSignRequest({ id: 'sr-hw-only', status: 'pending' }),
        )

        expect(addSignRequestMock).not.toHaveBeenCalled()
        expect(buildCosignArgsMock).not.toHaveBeenCalled()
        expect(openSheetMock).toHaveBeenCalledWith('sr-hw-only')
    })
})
