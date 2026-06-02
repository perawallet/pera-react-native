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

import { describe, it, expect, vi } from 'vitest'
import { createNegotiator } from '../negotiator'
import type { WalletProtocol } from '../types'

const walletProtocols: WalletProtocol[] = [{ id: 'arc0027', versions: ['1.0'] }]

const offerFrame = (protocols: unknown, peer?: unknown) =>
    JSON.stringify({
        id: 'o1',
        reference: 'liquidauth:negotiate:offer',
        params: { handshakeVersion: 1, protocols, peer },
    })

// Real ARC-0027 frames are base64(CBOR) text — opaque here, and crucially not
// a JSON object (they never start with `{`). The negotiator routes the raw
// frame verbatim to the arc0027 route, so an opaque token is a faithful stand-in.
const arc0027Request = 'omJpZGZyMWlkaXNjb3Zlcg'

const setup = (overrides = {}) => {
    const sent: string[] = []
    const arc0027 = vi.fn().mockResolvedValue('arc0027-response')
    const close = vi.fn()
    const onIdentity = vi.fn()
    const negotiator = createNegotiator({
        walletProtocols,
        routes: { arc0027 },
        send: (data: string) => sent.push(data),
        close,
        onIdentity,
        ...overrides,
    })
    return { negotiator, sent, arc0027, close, onIdentity }
}

describe('createNegotiator', () => {
    it('selects arc0027 from an offer, sends a select, and surfaces identity', async () => {
        const { negotiator, sent, onIdentity } = setup({
            serverAttestedOrigin: 'https://app.tinyman.org',
        })
        await negotiator.handleMessage(
            offerFrame([{ id: 'arc0027', versions: ['1.0'] }], {
                name: 'Tinyman',
                origin: 'https://app.tinyman.org',
            }),
        )
        const select = JSON.parse(sent[0])
        expect(select).toMatchObject({
            reference: 'liquidauth:negotiate:select',
            requestId: 'o1',
            result: { protocol: { id: 'arc0027', version: '1.0' } },
        })
        expect(onIdentity).toHaveBeenCalledWith(
            { name: 'Tinyman', origin: 'https://app.tinyman.org' },
            'https://app.tinyman.org',
        )
    })

    it('routes subsequent frames to the selected protocol', async () => {
        const { negotiator, sent, arc0027 } = setup()
        await negotiator.handleMessage(
            offerFrame([{ id: 'arc0027', versions: ['1.0'] }]),
        )
        await negotiator.handleMessage(arc0027Request)
        expect(arc0027).toHaveBeenCalledWith(arc0027Request)
        expect(sent.at(-1)).toBe('arc0027-response')
    })

    it('falls back to arc0027 when the first frame is a bare arc0027 request', async () => {
        const { negotiator, sent, arc0027 } = setup()
        await negotiator.handleMessage(arc0027Request)
        expect(arc0027).toHaveBeenCalledWith(arc0027Request)
        expect(sent).toEqual(['arc0027-response'])
    })

    it('surfaces the host-only identity immediately on the arc0027 fallback', async () => {
        // Legacy (non-negotiating) dApps must not stall the confirm step waiting
        // out the identity timeout — identity resolves the moment the dialect is
        // locked, with no peer metadata.
        const { negotiator, onIdentity } = setup({
            serverAttestedOrigin: 'https://host.example',
        })
        await negotiator.handleMessage(arc0027Request)
        expect(onIdentity).toHaveBeenCalledWith(
            undefined,
            'https://host.example',
        )
    })

    it('replies 5002 (MalformedOfferError) for a malformed protocol entry', async () => {
        const { negotiator, sent, close } = setup()
        // `protocols` present with a known offer id, but an entry is missing its
        // versions array — must produce a 5002 reply keyed on the id, not crash.
        await negotiator.handleMessage(offerFrame([{ id: 'arc0027' }]))
        const error = JSON.parse(sent[0])
        expect(error.requestId).toBe('o1')
        expect(error.error.code).toBe(5002)
        expect(close).toHaveBeenCalled()
    })

    it('closes silently on a malformed offer with no id', async () => {
        const { negotiator, sent, close } = setup()
        await negotiator.handleMessage(
            JSON.stringify({
                reference: 'liquidauth:negotiate:offer',
                params: { handshakeVersion: 1, protocols: [] },
            }),
        )
        expect(sent).toEqual([])
        expect(close).toHaveBeenCalled()
    })

    it('sends NoCommonProtocolError (5000) and closes when nothing overlaps', async () => {
        const { negotiator, sent, close } = setup()
        await negotiator.handleMessage(
            offerFrame([{ id: 'walletconnect', versions: ['2.0'] }]),
        )
        expect(JSON.parse(sent[0]).error.code).toBe(5000)
        expect(close).toHaveBeenCalled()
    })

    it('sends UnsupportedHandshakeVersionError (5001) for an unknown handshake version', async () => {
        const { negotiator, sent, close } = setup()
        const raw = JSON.stringify({
            id: 'o1',
            reference: 'liquidauth:negotiate:offer',
            params: {
                handshakeVersion: 99,
                protocols: [{ id: 'arc0027', versions: ['1.0'] }],
            },
        })
        await negotiator.handleMessage(raw)
        expect(JSON.parse(sent[0]).error.code).toBe(5001)
        expect(close).toHaveBeenCalled()
    })

    it('stays negotiating on unknown/heartbeat frames (no teardown)', async () => {
        const { negotiator, sent, close, arc0027 } = setup()
        await negotiator.handleMessage('')
        await negotiator.handleMessage('{not json')
        expect(sent).toEqual([])
        expect(close).not.toHaveBeenCalled()
        // still negotiating: a following arc0027 request falls back and routes
        await negotiator.handleMessage(arc0027Request)
        expect(arc0027).toHaveBeenCalledWith(arc0027Request)
    })

    it('does not surface identity when no common protocol is found', async () => {
        const { negotiator, onIdentity, close } = setup()
        await negotiator.handleMessage(
            offerFrame([{ id: 'walletconnect', versions: ['2.0'] }], {
                name: 'Tinyman',
                origin: 'https://app.tinyman.org',
            }),
        )
        expect(onIdentity).not.toHaveBeenCalled()
        expect(close).toHaveBeenCalled()
    })

    it('ignores everything after dispose', async () => {
        const { negotiator, arc0027 } = setup()
        negotiator.dispose()
        await negotiator.handleMessage(arc0027Request)
        expect(arc0027).not.toHaveBeenCalled()
    })
})
