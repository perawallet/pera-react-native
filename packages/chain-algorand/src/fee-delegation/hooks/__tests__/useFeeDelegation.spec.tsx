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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    assignGroupID,
    decodeSignedTransaction,
    decodeUnsignedTransaction,
    encodeUnsignedTransaction,
    generateAccount,
    type Transaction,
} from 'algosdk'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

import {
    FeeDelegationAttestationRequiredError,
    FeeDelegationResponseMismatchError,
} from '../../errors'
import {
    asUnsignedAlgorandTransaction,
    makeTestAddress,
    makeTestAssetTransferTx,
    makeTestPaymentTx,
} from '../../../signing/__tests__/transactions'
import { payloadTransactionsOf } from '../../../signing/unsignedAlgorandTransactions'

const {
    addSignRequestMock,
    submitAndAutoRefreshMock,
    canCallIntegrityGuardedRouteMock,
    requestFeeDelegationMock,
} = vi.hoisted(() => ({
    addSignRequestMock: vi.fn(),
    submitAndAutoRefreshMock: vi.fn(),
    canCallIntegrityGuardedRouteMock: vi.fn(),
    requestFeeDelegationMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: addSignRequestMock }),
    submitAndAutoRefresh: submitAndAutoRefreshMock,
}))

// Token expiry and the dev/staging exemption belong to the integrity policy
// (unit-tested in the app-integrity package); the hook only branches on it.
vi.mock('@perawallet/wallet-core-app-integrity', () => ({
    canCallIntegrityGuardedRoute: canCallIntegrityGuardedRouteMock,
}))

vi.mock('../../api', () => ({
    requestFeeDelegation: (...args: unknown[]) =>
        requestFeeDelegationMock(...args),
}))

import { useFeeDelegation } from '../useFeeDelegation'

const ACCOUNT_ADDRESS = makeTestAddress(1)
const ACCOUNT = ACCOUNT_ADDRESS.toString()
const ASSET_ID = 31566704n
const SPONSOR = generateAccount()

const optInTxn = makeTestAssetTransferTx(ACCOUNT_ADDRESS, {
    assetIndex: ASSET_ID,
    receiver: ACCOUNT_ADDRESS,
})

const baseParams = {
    account: ACCOUNT,
    transactions: [asUnsignedAlgorandTransaction(optInTxn)],
    includeAssetOptInMbr: true,
    optInAssetIds: [ASSET_ID],
    sourceMetadata: { name: 'test-flow', description: 'Test flow' },
}

const toBase64 = (txn: Transaction) =>
    encodeToBase64(encodeUnsignedTransaction(txn))

// Mirrors the backend: prepend a pre-signed sponsor payment and re-group, so
// the wallet slot comes back with a new group id.
const regroupWithSponsor = (walletTxn: Transaction) => {
    const sponsorTxn = makeTestPaymentTx(SPONSOR.addr, {
        receiver: ACCOUNT_ADDRESS,
        amount: 100_000n,
    })
    const returnedWalletTxn = decodeUnsignedTransaction(
        encodeUnsignedTransaction(walletTxn),
    )
    assignGroupID([sponsorTxn, returnedWalletTxn])
    const sponsorSigned = sponsorTxn.signTxn(SPONSOR.sk)
    return {
        sponsorTxn,
        sponsorSigned,
        returnedWalletTxn,
        response: {
            txnGroup: [
                {
                    txn: toBase64(sponsorTxn),
                    signers: [],
                    stxn: encodeToBase64(sponsorSigned),
                },
                { txn: toBase64(returnedWalletTxn), signers: [ACCOUNT] },
            ],
        },
    }
}

function renderDelegation() {
    return renderHook(() => useFeeDelegation()).result
}

beforeEach(() => {
    vi.clearAllMocks()
    canCallIntegrityGuardedRouteMock.mockReturnValue(true)
})

describe('fee-delegation/useFeeDelegation', () => {
    test('rejects with FeeDelegationAttestationRequiredError when the guarded route would refuse', async () => {
        canCallIntegrityGuardedRouteMock.mockReturnValue(false)

        const result = renderDelegation()

        await expect(
            result.current.submitWithFeeDelegation(baseParams),
        ).rejects.toBeInstanceOf(FeeDelegationAttestationRequiredError)
        expect(requestFeeDelegationMock).not.toHaveBeenCalled()
    })

    test('sends the encoded group, signs the wallet slot, and submits in order', async () => {
        const callOrder: string[] = []
        const { sponsorTxn, sponsorSigned, returnedWalletTxn, response } =
            regroupWithSponsor(optInTxn)
        const walletSigned = {
            txn: returnedWalletTxn,
            sig: new Uint8Array([9]),
        }

        // Sponsor slot (signed, first) + the wallet's opt-in slot (unsigned).
        requestFeeDelegationMock.mockImplementation(async () => {
            callOrder.push('request')
            return response
        })

        addSignRequestMock.mockImplementation(request => {
            callOrder.push('sign')
            // The pipeline returns one signed txn per unsigned slot.
            void request.approve([walletSigned])
        })

        submitAndAutoRefreshMock.mockImplementation(async () => {
            callOrder.push('submit')
            return ['submitted-tx']
        })

        const result = renderDelegation()
        await result.current.submitWithFeeDelegation(baseParams)

        // Request: base64 of the unsigned opt-in + MBR + asset id as string,
        // on the active network.
        expect(requestFeeDelegationMock).toHaveBeenCalledWith(
            {
                // Prefix-free wire form, not the "TX"-prefixed signable bytes:
                // ARC-0001 carries the former and the backend decoder rejects
                // the latter.
                txnGroup: [{ txn: toBase64(optInTxn) }],
                account: ACCOUNT,
                includeAssetOptInMbr: true,
                optInAssetIds: [ASSET_ID.toString()],
            },
            'mainnet',
        )

        // Signing: only the unsigned slot (index 1 of the re-grouped payload)
        // is signable; the full group is the integrity context.
        expect(addSignRequestMock).toHaveBeenCalledTimes(1)
        const signRequest = addSignRequestMock.mock.calls[0]![0]
        const algorand = signRequest.chainData.algorand
        expect(algorand.signableIndices).toEqual([1])
        expect(
            payloadTransactionsOf(signRequest.txs).map(tx => tx.txID()),
        ).toEqual([returnedWalletTxn.txID()])
        expect(
            payloadTransactionsOf(algorand.groupContext).map(tx => tx.txID()),
        ).toEqual([sponsorTxn.txID(), returnedWalletTxn.txID()])
        expect(signRequest.sourceMetadata).toEqual(baseParams.sourceMetadata)

        // Submission: sponsor's pre-signed slot first, wallet signature after,
        // and the steps ran request → sign → submit.
        expect(submitAndAutoRefreshMock).toHaveBeenCalledTimes(1)
        const [scope, orderedSigned] = submitAndAutoRefreshMock.mock.calls[0]!
        expect(scope).toEqual({ chainId: 'algorand', networkId: 'mainnet' })
        expect(orderedSigned).toEqual([
            decodeSignedTransaction(sponsorSigned),
            walletSigned,
        ])
        expect(callOrder).toEqual(['request', 'sign', 'submit'])
    })

    test('a signing rejection propagates and nothing is submitted', async () => {
        requestFeeDelegationMock.mockResolvedValue(
            regroupWithSponsor(optInTxn).response,
        )
        addSignRequestMock.mockImplementation(request => {
            void request.reject()
        })

        const result = renderDelegation()

        await expect(
            result.current.submitWithFeeDelegation(baseParams),
        ).rejects.toThrow(/rejected/i)
        expect(submitAndAutoRefreshMock).not.toHaveBeenCalled()
    })

    test('rejects without signing when a returned to-sign slot does not match what was sent', async () => {
        // The backend swaps the wallet's opt-in for an attacker-favorable
        // transaction in the same slot. It must never reach the signing
        // pipeline or be submitted.
        const drainPayment = makeTestPaymentTx(ACCOUNT_ADDRESS, {
            receiver: makeTestAddress(9),
            amount: 5_000_000n,
        })
        requestFeeDelegationMock.mockResolvedValue(
            regroupWithSponsor(drainPayment).response,
        )

        const result = renderDelegation()

        await expect(
            result.current.submitWithFeeDelegation(baseParams),
        ).rejects.toBeInstanceOf(FeeDelegationResponseMismatchError)
        expect(addSignRequestMock).not.toHaveBeenCalled()
        expect(submitAndAutoRefreshMock).not.toHaveBeenCalled()
    })
})
