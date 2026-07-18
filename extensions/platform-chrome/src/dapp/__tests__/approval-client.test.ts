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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DAPP_APPROVAL_SCOPE } from '../approval-bridge'
import {
    getPendingApproval,
    rejectApproval,
    rejectPasskey,
    resolveApproval,
    resolvePasskey,
    resolveSignMessage,
    resolveSignTransactions,
} from '../approval-client'

const sendMessage = vi.fn()

beforeEach(() => {
    sendMessage.mockReset()
    globalThis.chrome = {
        runtime: { sendMessage },
    } as unknown as typeof chrome
})

describe('getPendingApproval', () => {
    it('sends a get-approval message and returns the pending approval', async () => {
        sendMessage.mockResolvedValueOnce({
            requestId: 'q1',
            origin: 'https://x.com',
            kind: 'enable',
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

describe('resolveSignTransactions', () => {
    it('sends a resolve-sign-transactions message with the signed txns', async () => {
        sendMessage.mockResolvedValueOnce({ ok: true })
        await resolveSignTransactions('q1', ['SIGNED', null])
        expect(sendMessage).toHaveBeenCalledWith({
            scope: DAPP_APPROVAL_SCOPE,
            kind: 'resolve-sign-transactions',
            requestId: 'q1',
            stxns: ['SIGNED', null],
        })
    })
})

describe('resolveSignMessage', () => {
    it('sends a resolve-sign-message message with the signature', async () => {
        sendMessage.mockResolvedValueOnce({ ok: true })
        await resolveSignMessage('q1', 'SIG')
        expect(sendMessage).toHaveBeenCalledWith({
            scope: DAPP_APPROVAL_SCOPE,
            kind: 'resolve-sign-message',
            requestId: 'q1',
            signature: 'SIG',
        })
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
