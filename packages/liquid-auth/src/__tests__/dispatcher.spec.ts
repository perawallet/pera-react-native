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
import { createArc0027Dispatcher } from '../arc0027/dispatcher'
import { encodeFrame, decodeFrame } from '../arc0027/codec'
import { Arc0027Error } from '../arc0027/errors'
import { ARC0027_ERROR_CODES } from '../arc0027/types'

const decode = (raw: string) => decodeFrame(raw) as Record<string, never>

describe('createArc0027Dispatcher', () => {
    it('routes a request to the matching handler and serializes its result', async () => {
        const dispatch = createArc0027Dispatcher({
            enable: vi.fn().mockResolvedValue({ accounts: ['A'] }),
        })
        const raw = encodeFrame({
            id: 'r1',
            reference: 'arc0027:enable:request',
            params: {},
        })
        const out = decode((await dispatch(raw)) as string)
        expect(out).toMatchObject({
            reference: 'arc0027:enable:response',
            requestId: 'r1',
            result: { accounts: ['A'] },
        })
    })

    it('returns an error envelope when a handler throws Arc0027Error', async () => {
        const dispatch = createArc0027Dispatcher({
            enable: vi
                .fn()
                .mockRejectedValue(
                    new Arc0027Error(
                        ARC0027_ERROR_CODES.MethodCanceledError,
                        'no',
                    ),
                ),
        })
        const raw = encodeFrame({
            id: 'r2',
            reference: 'arc0027:enable:request',
        })
        const out = decode((await dispatch(raw)) as string) as {
            error: { code: number }
        }
        expect(out.error.code).toBe(4001)
    })

    it('returns MethodNotSupportedError for an unregistered method', async () => {
        const dispatch = createArc0027Dispatcher({})
        const raw = encodeFrame({
            id: 'r3',
            reference: 'arc0027:disable:request',
        })
        const out = decode((await dispatch(raw)) as string) as {
            error: { code: number }
        }
        expect(out.error.code).toBe(4003)
    })

    it('ignores response-type and heartbeat (empty) messages', async () => {
        const dispatch = createArc0027Dispatcher({})
        expect(await dispatch('')).toBeNull()
        const resp = encodeFrame({
            id: 'x',
            reference: 'arc0027:enable:response',
        })
        expect(await dispatch(resp)).toBeNull()
    })
})
