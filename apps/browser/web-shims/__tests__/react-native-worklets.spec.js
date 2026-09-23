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

// Plain-JS spec (not .spec.ts) deliberately, as in flash-list's sibling spec:
// web-shims/ is untyped JS outside tsc's include glob.
import { describe, it, expect, vi } from 'vitest'
import {
    executeOnUIRuntimeSync,
    runOnJS,
    runOnRuntimeAsync,
    runOnRuntimeAsyncWithId,
    runOnRuntimeSync,
    runOnRuntimeSyncWithId,
    runOnUI,
    runOnUIAsync,
    runOnUISync,
    scheduleOnRN,
    scheduleOnRuntime,
    scheduleOnRuntimeWithId,
    scheduleOnUI,
} from '../react-native-worklets'

const RUNTIME = {}
const RUNTIME_ID = 7

describe('react-native-worklets web shim', () => {
    // Gesture Handler 3 binds shared values with scheduleOnUI(worklet, tag,
    // value, name); dropping the arguments crashed its worklet on undefined.
    it.each([
        ['scheduleOnRN', worklet => scheduleOnRN(worklet, 'a', 2)],
        ['scheduleOnUI', worklet => scheduleOnUI(worklet, 'a', 2)],
        [
            'scheduleOnRuntime',
            worklet => scheduleOnRuntime(RUNTIME, worklet, 'a', 2),
        ],
        [
            'scheduleOnRuntimeWithId',
            worklet => scheduleOnRuntimeWithId(RUNTIME_ID, worklet, 'a', 2),
        ],
    ])('%s runs the worklet at once with its arguments', (_name, schedule) => {
        const worklet = vi.fn()

        expect(schedule(worklet)).toBeUndefined()

        expect(worklet).toHaveBeenCalledWith('a', 2)
    })

    it.each([
        ['runOnUISync', worklet => runOnUISync(worklet, 'a', 2)],
        [
            'runOnRuntimeSync',
            worklet => runOnRuntimeSync(RUNTIME, worklet, 'a', 2),
        ],
        [
            'runOnRuntimeSyncWithId',
            worklet => runOnRuntimeSyncWithId(RUNTIME_ID, worklet, 'a', 2),
        ],
    ])('%s returns what the worklet returns', (_name, run) => {
        expect(run((text, count) => text.repeat(count))).toBe('aa')
    })

    it.each([
        ['runOnUIAsync', worklet => runOnUIAsync(worklet, 'a', 2)],
        [
            'runOnRuntimeAsync',
            worklet => runOnRuntimeAsync(RUNTIME, worklet, 'a', 2),
        ],
        [
            'runOnRuntimeAsyncWithId',
            worklet => runOnRuntimeAsyncWithId(RUNTIME_ID, worklet, 'a', 2),
        ],
    ])(
        '%s resolves with the result and rejects on a throw',
        async (_name, run) => {
            await expect(
                run((text, count) => text.repeat(count)),
            ).resolves.toBe('aa')
            await expect(
                run(() => {
                    throw new Error('boom')
                }),
            ).rejects.toThrow('boom')
        },
    )

    it.each([
        ['runOnJS', runOnJS],
        ['runOnUI', runOnUI],
        ['executeOnUIRuntimeSync', executeOnUIRuntimeSync],
    ])(
        '%s returns a callable instead of running the worklet',
        (_name, wrap) => {
            const worklet = vi.fn((text, count) => text.repeat(count))

            const callable = wrap(worklet)

            expect(worklet).not.toHaveBeenCalled()
            expect(callable('a', 2)).toBe('aa')
        },
    )
})
