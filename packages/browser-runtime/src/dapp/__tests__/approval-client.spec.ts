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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    DappRequestFailedError,
    DappRequestRejectedError,
} from '@perawallet/wallet-core-connections/dappRequest'
import {
    APPROVAL_POPUP_PORT_PREFIX,
    DAPP_APPROVAL_SCOPE,
} from '../approval-bridge'
import {
    ApprovalDeliveryError,
    declineConnectionRequest,
    getCurrentApproval,
    getPendingApproval,
    failConnectionRequest,
    rejectApproval,
    rejectPasskey,
    resolveApproval,
    resolvePasskey,
    submitConnectionRequest,
} from '../approval-client'

const sendMessage = vi.fn()
const connect = vi.fn()

beforeEach(() => {
    sendMessage.mockReset()
    connect.mockReset()
    globalThis.chrome = {
        runtime: { sendMessage, connect },
    } as unknown as typeof chrome
})

describe('getPendingApproval', () => {
    it('sends a get-approval message and returns the pending approval', async () => {
        sendMessage.mockResolvedValueOnce({
            requestId: 'q1',
            origin: 'https://x.com',
            kind: 'connection-proposal',
        })
        const approval = await getPendingApproval('q1')
        expect(sendMessage).toHaveBeenCalledWith({
            scope: DAPP_APPROVAL_SCOPE,
            kind: 'get-approval',
            requestId: 'q1',
        })
        expect(approval?.origin).toBe('https://x.com')
    })

    it('returns null when the SW has no matching pending approval', async () => {
        sendMessage.mockResolvedValueOnce({
            ok: false,
            error: 'unknown request',
        })
        expect(await getPendingApproval('missing')).toBeNull()
    })
})

describe('getCurrentApproval', () => {
    it('holds a port named for the claimed approval open for the page lifetime', async () => {
        sendMessage.mockResolvedValueOnce({
            requestId: 'c1',
            origin: 'https://x.com',
            kind: 'connection-proposal',
        })

        const approval = await getCurrentApproval()

        expect(approval?.requestId).toBe('c1')
        expect(connect).toHaveBeenCalledWith({
            name: `${APPROVAL_POPUP_PORT_PREFIX}c1`,
        })
    })

    it('opens no port when there is nothing to claim', async () => {
        sendMessage.mockResolvedValueOnce(null)

        expect(await getCurrentApproval()).toBeNull()
        expect(connect).not.toHaveBeenCalled()
    })
})

describe('resolveApproval', () => {
    it('sends a resolve-approval message with the approved addresses', async () => {
        sendMessage.mockResolvedValueOnce({ ok: true })
        await resolveApproval('q1', ['ADDR'])
        expect(sendMessage).toHaveBeenCalledWith({
            scope: DAPP_APPROVAL_SCOPE,
            kind: 'resolve-approval',
            requestId: 'q1',
            approvedAddresses: ['ADDR'],
        })
    })
})

describe('rejectApproval', () => {
    it('sends a reject-approval message', async () => {
        sendMessage.mockResolvedValueOnce({ ok: true })
        await rejectApproval('q1')
        expect(sendMessage).toHaveBeenCalledWith({
            scope: DAPP_APPROVAL_SCOPE,
            kind: 'reject-approval',
            requestId: 'q1',
        })
    })
})

describe('failConnectionRequest', () => {
    it('sends a fail-connection-request message with the failure kind', async () => {
        sendMessage.mockResolvedValueOnce({ ok: true })
        await failConnectionRequest('q1', 'unauthorized-account')
        expect(sendMessage).toHaveBeenCalledWith({
            scope: DAPP_APPROVAL_SCOPE,
            kind: 'fail-connection-request',
            requestId: 'q1',
            failure: 'unauthorized-account',
        })
    })
})

describe('declineConnectionRequest', () => {
    it('sends reject-approval for a user rejection', async () => {
        sendMessage.mockResolvedValue({ ok: true })
        const cancelled = new Error('cancelled')
        cancelled.name = 'UserCancelledError'

        await declineConnectionRequest('q1', new DappRequestRejectedError())
        await declineConnectionRequest('q2', cancelled)

        expect(sendMessage).toHaveBeenNthCalledWith(1, {
            scope: DAPP_APPROVAL_SCOPE,
            kind: 'reject-approval',
            requestId: 'q1',
        })
        expect(sendMessage).toHaveBeenNthCalledWith(2, {
            scope: DAPP_APPROVAL_SCOPE,
            kind: 'reject-approval',
            requestId: 'q2',
        })
    })

    it('sends fail-connection-request with the failure kind otherwise', async () => {
        sendMessage.mockResolvedValue({ ok: true })

        await declineConnectionRequest(
            'q1',
            new DappRequestFailedError('bad params', 'invalid-params'),
        )
        await declineConnectionRequest('q2', new Error('execution reverted'))

        expect(sendMessage).toHaveBeenNthCalledWith(1, {
            scope: DAPP_APPROVAL_SCOPE,
            kind: 'fail-connection-request',
            requestId: 'q1',
            failure: 'invalid-params',
        })
        expect(sendMessage).toHaveBeenNthCalledWith(2, {
            scope: DAPP_APPROVAL_SCOPE,
            kind: 'fail-connection-request',
            requestId: 'q2',
            failure: undefined,
        })
    })
})

describe('submitConnectionRequest', () => {
    const SIGNED = [
        {
            scope: { chainId: 'ethereum', networkId: 'mainnet' },
            id: '0xabc',
            bytes: new Uint8Array([1, 2, 3]),
        },
    ] as const

    it('sends the encoded transactions and returns the outcome', async () => {
        sendMessage.mockResolvedValueOnce({
            ok: true,
            outcome: { ok: true, txId: '0xabc' },
        })

        const outcome = await submitConnectionRequest('q1', SIGNED)

        expect(sendMessage).toHaveBeenCalledWith({
            scope: DAPP_APPROVAL_SCOPE,
            kind: 'submit-connection-request',
            requestId: 'q1',
            signedTransactions: [
                {
                    scope: { chainId: 'ethereum', networkId: 'mainnet' },
                    id: '0xabc',
                    bytes: 'AQID',
                },
            ],
        })
        expect(outcome).toEqual({ ok: true, txId: '0xabc' })
    })

    it('throws ApprovalDeliveryError when the bridge refuses', async () => {
        sendMessage.mockResolvedValueOnce({
            ok: false,
            error: 'unknown request',
        })

        await expect(
            submitConnectionRequest('q1', SIGNED),
        ).rejects.toBeInstanceOf(ApprovalDeliveryError)
    })
})

describe('resolvePasskey', () => {
    it('sends a resolve-passkey message with the serialized credential', async () => {
        sendMessage.mockResolvedValueOnce({ ok: true })
        const credential = {
            id: 'cred',
            rawId: 'cred',
            type: 'public-key' as const,
            response: { clientDataJSON: 'CDJ', attestationObject: 'AO' },
        }
        await resolvePasskey('q1', credential)
        expect(sendMessage).toHaveBeenCalledWith({
            scope: DAPP_APPROVAL_SCOPE,
            kind: 'resolve-passkey',
            requestId: 'q1',
            credential,
        })
    })
})

describe('rejectPasskey', () => {
    it('sends a reject-passkey message with the reason', async () => {
        sendMessage.mockResolvedValueOnce({ ok: true })
        await rejectPasskey('q1', 'declined')
        expect(sendMessage).toHaveBeenCalledWith({
            scope: DAPP_APPROVAL_SCOPE,
            kind: 'reject-passkey',
            requestId: 'q1',
            reason: 'declined',
        })
    })
})
