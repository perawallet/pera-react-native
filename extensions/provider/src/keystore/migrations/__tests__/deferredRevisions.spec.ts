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

import { describe, expect, it } from 'vitest'
import { memoryLedger } from '@algorandfoundation/provider-migrations'
import {
    deferRevisionToNextLaunch,
    withDeferredRevisions,
} from '../deferredRevisions'

const revision = (id: number) => ({
    id,
    name: `r${id}`,
    appliedAt: '2026-11-25T00:00:00.000Z',
})

describe('withDeferredRevisions', () => {
    it('keeps a deferred module at its last revision before the deferral', async () => {
        const ledger = withDeferredRevisions(memoryLedger())
        await ledger.write('held', revision(2))

        deferRevisionToNextLaunch('held', 3)
        await ledger.write('held', revision(3))
        await ledger.write('held', revision(4))

        await expect(ledger.read()).resolves.toMatchObject({
            held: { id: 2 },
        })
    })

    it('keeps the earliest deferral when a later revision also defers', async () => {
        const ledger = withDeferredRevisions(memoryLedger())

        deferRevisionToNextLaunch('twice', 3)
        deferRevisionToNextLaunch('twice', 5)
        await ledger.write('twice', revision(4))

        await expect(ledger.read()).resolves.toEqual({})
    })

    it('ledgers other modules as usual', async () => {
        const ledger = withDeferredRevisions(memoryLedger())

        deferRevisionToNextLaunch('other-held', 1)
        await ledger.write('free', revision(1))

        await expect(ledger.read()).resolves.toMatchObject({
            free: { id: 1 },
        })
    })
})
