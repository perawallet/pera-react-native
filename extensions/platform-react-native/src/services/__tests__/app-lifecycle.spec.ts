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

const appStateFake = vi.hoisted(() => {
    type Handler = (state: string) => void
    const handlers: Handler[] = []
    return {
        handlers,
        AppState: {
            currentState: 'active',
            addEventListener: vi.fn((_type: string, handler: Handler) => {
                handlers.push(handler)
                return {
                    remove: () => {
                        const index = handlers.indexOf(handler)
                        if (index >= 0) handlers.splice(index, 1)
                    },
                }
            }),
        },
        emit(state: string) {
            this.AppState.currentState = state
            for (const handler of [...handlers]) handler(state)
        },
    }
})

vi.mock('react-native', () => ({ AppState: appStateFake.AppState }))

import { runAppLifecycleContract } from '../../../../platform/src/test-utils/app-lifecycle-contract'
import { RNAppLifecycleService } from '../app-lifecycle'

runAppLifecycleContract('RNAppLifecycleService', () => {
    appStateFake.handlers.length = 0
    appStateFake.AppState.currentState = 'active'
    return {
        service: new RNAppLifecycleService(),
        emit: state => appStateFake.emit(state),
    }
})

describe('RNAppLifecycleService', () => {
    it('subscribes to AppState change events', () => {
        new RNAppLifecycleService().addChangeListener(() => {})

        expect(appStateFake.AppState.addEventListener).toHaveBeenCalledWith(
            'change',
            expect.any(Function),
        )
    })

    it('passes states RN reports beyond active/background straight through', () => {
        const service = new RNAppLifecycleService()
        const listener = vi.fn()
        service.addChangeListener(listener)

        appStateFake.emit('inactive')

        expect(listener).toHaveBeenCalledWith('inactive')
        expect(service.getCurrentState()).toBe('inactive')
    })
})
