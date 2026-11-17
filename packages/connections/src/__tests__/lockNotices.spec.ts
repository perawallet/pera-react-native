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

import { describe, expect, it, vi } from 'vitest'
import { watchLockNotices } from '../walletNotices'

vi.mock('@perawallet/wallet-core-accounts', () => ({}))
vi.mock('@perawallet/wallet-core-chain-shared', () => ({}))

const setup = (isLockedNow: boolean | undefined) => {
    const notify = vi.fn().mockResolvedValue(undefined)
    let emit: (isLocked: boolean) => void = () => {}
    const unsubscribe = vi.fn()
    const stop = watchLockNotices({ notify }, isLockedNow, listener => {
        emit = listener
        return unsubscribe
    })
    return {
        notify,
        emit: (isLocked: boolean) => emit(isLocked),
        stop,
        unsubscribe,
    }
}

describe('watchLockNotices', () => {
    it('announces a lock and then an unlock', () => {
        const { notify, emit } = setup(false)

        emit(true)
        emit(false)

        expect(notify.mock.calls).toEqual([
            [{ type: 'lock-changed', isLocked: true }],
            [{ type: 'lock-changed', isLocked: false }],
        ])
    })

    it('never repeats the state it started from or last announced', () => {
        const { notify, emit } = setup(true)

        emit(true)
        emit(false)
        emit(false)

        expect(notify.mock.calls).toEqual([
            [{ type: 'lock-changed', isLocked: false }],
        ])
    })

    it('announces the first report when the starting state is unknown', () => {
        const { notify, emit } = setup(undefined)

        emit(true)

        expect(notify.mock.calls).toEqual([
            [{ type: 'lock-changed', isLocked: true }],
        ])
    })

    it('hands back the subscription to stop', () => {
        const { stop, unsubscribe } = setup(false)

        stop()

        expect(unsubscribe).toHaveBeenCalledOnce()
    })
})
