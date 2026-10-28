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

import { describe, expect, test } from 'vitest'
import {
    deriveClaimedKey,
    isKeyClaimed,
    isKeyClaimedByOthers,
    trackWalk,
} from '../key-claims'

const deferred = () => {
    let resolve!: () => void
    const promise = new Promise<void>(done => {
        resolve = done
    })
    return { promise, resolve }
}

const derivation = (keyPairId: string, gate?: Promise<void>) => async () => {
    await gate
    return { keyPairId }
}

describe('key claims', () => {
    test('claims a key while its derivation runs, walk or not', async () => {
        const gate = deferred()

        const deriving = deriveClaimedKey('k', derivation('k', gate.promise))
        expect(isKeyClaimed('k')).toBe(true)
        gate.resolve()
        await deriving

        expect(isKeyClaimed('k')).toBe(false)
    })

    test('keeps a key derived during a walk claimed until every walk ends', async () => {
        const firstWalk = deferred()
        const secondWalk = deferred()
        const first = trackWalk(() => firstWalk.promise)
        const second = trackWalk(() => secondWalk.promise)

        await deriveClaimedKey('expected', derivation('derived'))
        firstWalk.resolve()
        await first

        expect(isKeyClaimed('expected')).toBe(true)
        expect(isKeyClaimed('derived')).toBe(true)
        secondWalk.resolve()
        await second
        expect(isKeyClaimed('expected')).toBe(false)
        expect(isKeyClaimed('derived')).toBe(false)
    })

    test('keeps a derivation begun before a walk claimed through that walk', async () => {
        const gate = deferred()
        const walk = deferred()
        const deriving = deriveClaimedKey('k', derivation('k', gate.promise))
        const walking = trackWalk(async () => {
            await walk.promise
            return isKeyClaimed('k')
        })

        gate.resolve()
        await deriving
        walk.resolve()

        await expect(walking).resolves.toBe(true)
    })

    test("tells a walk its own claims from another flow's", async () => {
        const walk = deferred()
        const walkClaims = {}
        const walking = trackWalk(() => walk.promise)

        await deriveClaimedKey('own', derivation('own'), walkClaims)
        await deriveClaimedKey('shared', derivation('shared'), walkClaims)
        await deriveClaimedKey('shared', derivation('shared'))

        expect(isKeyClaimedByOthers('own', walkClaims)).toBe(false)
        expect(isKeyClaimedByOthers('shared', walkClaims)).toBe(true)
        walk.resolve()
        await walking
    })

    test('releases the claim when the derivation fails', async () => {
        await expect(
            deriveClaimedKey('k', () => Promise.reject(new Error('locked'))),
        ).rejects.toThrow('locked')

        expect(isKeyClaimed('k')).toBe(false)
    })
})
