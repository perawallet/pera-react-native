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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBackRemovalGuard } from '../useBackRemovalGuard'

type BeforeRemoveEvent = {
    data: { action: { type: string } }
    preventDefault: () => void
}

const { addListenerMock, setOptionsMock, unsubscribeMock } = vi.hoisted(() => ({
    addListenerMock: vi.fn(),
    setOptionsMock: vi.fn(),
    unsubscribeMock: vi.fn(),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        addListener: addListenerMock,
        setOptions: setOptionsMock,
    }),
}))

beforeEach(() => {
    vi.clearAllMocks()
    addListenerMock.mockReturnValue(unsubscribeMock)
})

const renderGuard = (options?: Parameters<typeof useBackRemovalGuard>[0]) => {
    const rendered = renderHook(
        (props?: Parameters<typeof useBackRemovalGuard>[0]) =>
            useBackRemovalGuard(props),
        { initialProps: options },
    )
    const [eventName, listener] = addListenerMock.mock.calls[0] as [
        string,
        (event: BeforeRemoveEvent) => void,
    ]
    expect(eventName).toBe('beforeRemove')

    return { ...rendered, listener }
}

const back = (preventDefault = vi.fn()) => ({
    event: { data: { action: { type: 'GO_BACK' } }, preventDefault },
    preventDefault,
})

describe('useBackRemovalGuard', () => {
    test('leaves a back action alone when there is nothing to guard', () => {
        const { listener } = renderGuard()
        const { event, preventDefault } = back()

        listener(event)

        expect(preventDefault).not.toHaveBeenCalled()
    })

    test('refuses a back action while blocking', () => {
        const onBackAttempt = vi.fn()
        const { listener } = renderGuard({ isBlocking: true, onBackAttempt })
        const { event, preventDefault } = back()

        listener(event)

        expect(preventDefault).toHaveBeenCalledTimes(1)
        // Blocking means blocking: the caller doesn't get to reopen the exit.
        expect(onBackAttempt).not.toHaveBeenCalled()
    })

    test.each(['GO_BACK', 'POP'])('intercepts %s and hands it over', type => {
        const onBackAttempt = vi.fn()
        const { listener } = renderGuard({ onBackAttempt })
        const preventDefault = vi.fn()

        listener({ data: { action: { type } }, preventDefault })

        expect(preventDefault).toHaveBeenCalledTimes(1)
        expect(onBackAttempt).toHaveBeenCalledWith(
            { type },
            expect.any(Function),
        )
    })

    // The whole point of the action filter: the navigation a screen performs
    // when its work finishes must not be trapped by its own back guard.
    test.each(['REPLACE', 'RESET', 'POP_TO', 'NAVIGATE'])(
        'lets %s through even while blocking',
        type => {
            const onBackAttempt = vi.fn()
            const { listener } = renderGuard({
                isBlocking: true,
                onBackAttempt,
            })
            const preventDefault = vi.fn()

            listener({ data: { action: { type } }, preventDefault })

            expect(preventDefault).not.toHaveBeenCalled()
            expect(onBackAttempt).not.toHaveBeenCalled()
        },
    )

    test('stops guarding once the caller allows the removal', () => {
        const onBackAttempt = vi.fn(
            (_action: unknown, allowRemoval: () => void) => allowRemoval(),
        )
        const { listener } = renderGuard({ onBackAttempt })

        listener(back().event)
        const second = back()
        listener(second.event)

        expect(second.preventDefault).not.toHaveBeenCalled()
        expect(onBackAttempt).toHaveBeenCalledTimes(1)
    })

    test('guards again after the screen re-subscribes', () => {
        const onBackAttempt = vi.fn(
            (_action: unknown, allowRemoval: () => void) => allowRemoval(),
        )
        const { listener, rerender } = renderGuard({ onBackAttempt })
        listener(back().event)

        rerender({ isBlocking: true, onBackAttempt })

        const [, next] = addListenerMock.mock.calls[1] as [
            string,
            (event: BeforeRemoveEvent) => void,
        ]
        const { event, preventDefault } = back()
        next(event)

        expect(unsubscribeMock).toHaveBeenCalled()
        expect(preventDefault).toHaveBeenCalledTimes(1)
    })

    test('drops the back affordance only while blocking', () => {
        const { rerender } = renderGuard({ isBlocking: true })

        expect(setOptionsMock).toHaveBeenLastCalledWith({
            headerLeft: expect.any(Function),
            gestureEnabled: false,
        })

        rerender({ isBlocking: false })

        expect(setOptionsMock).toHaveBeenLastCalledWith({
            headerLeft: undefined,
            gestureEnabled: undefined,
        })
    })

    // A screen that always intercepts keeps the native gesture off even when it
    // isn't blocking, or iOS dismisses before the listener ever runs.
    test('keeps the native gesture off whenever it intends to intercept', () => {
        renderGuard({ onBackAttempt: vi.fn() })

        expect(setOptionsMock).toHaveBeenLastCalledWith({
            headerLeft: undefined,
            gestureEnabled: false,
        })
    })
})
