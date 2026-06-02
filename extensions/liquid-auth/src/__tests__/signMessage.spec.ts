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
import { createSignMessageHandler } from '../handlers/signMessage'
import { Arc0027Error } from '../arc0027/errors'

describe('sign_message handler', () => {
    const params = { data: 'ZGF0YQ==', signer: 'ADDR', domain: 'x' }

    it('forwards the raw params + transportId and resolves with the first signature', async () => {
        const enqueueArc60 = vi.fn(({ approve }) => approve(['c2lnbmF0dXJl']))
        const handler = createSignMessageHandler({
            enqueueArc60,
            transportId: 's1',
        })
        const result = await handler({
            id: 'r',
            reference: 'arc0027:sign_message:request',
            params,
        })
        expect(enqueueArc60).toHaveBeenCalledWith(
            expect.objectContaining({ params, transportId: 's1' }),
        )
        expect(result).toEqual({ signature: 'c2lnbmF0dXJl' })
    })

    it('rejects with MethodCanceledError when rejected', async () => {
        const enqueueArc60 = vi.fn(({ reject }) => reject())
        const handler = createSignMessageHandler({
            enqueueArc60,
            transportId: 's1',
        })
        await expect(
            handler({
                id: 'r',
                reference: 'arc0027:sign_message:request',
                params,
            }),
        ).rejects.toBeInstanceOf(Arc0027Error)
    })

    it('rejects with an error when enqueue signals an error', async () => {
        const enqueueArc60 = vi.fn(({ error }) =>
            error(new Error('bad payload')),
        )
        const handler = createSignMessageHandler({
            enqueueArc60,
            transportId: 's1',
        })
        await expect(
            handler({
                id: 'r',
                reference: 'arc0027:sign_message:request',
                params,
            }),
        ).rejects.toThrow('bad payload')
    })
})
