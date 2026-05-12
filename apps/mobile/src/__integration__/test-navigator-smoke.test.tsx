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

import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useNavigation, useRoute } from '@react-navigation/native'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'

// Smoke test for the test-navigator stand-in: covers the three core
// transitions (push, replace, goBack) plus route-param propagation.

const ScreenA = () => {
    const navigation = useNavigation() as unknown as {
        navigate: (n: string, p?: object) => void
        replace: (n: string, p?: object) => void
    }
    return (
        <div data-testid='screen_a'>
            <button
                data-testid='go_b'
                onClick={() => navigation.navigate('B', { from: 'A' })}
            >
                go b
            </button>
            <button
                data-testid='replace_with_c'
                onClick={() => navigation.replace('C', { via: 'replace' })}
            >
                replace with c
            </button>
        </div>
    )
}

const ScreenB = () => {
    const navigation = useNavigation() as unknown as { goBack: () => void }
    const route = useRoute() as unknown as { params: { from?: string } }
    return (
        <div data-testid='screen_b'>
            <span data-testid='b_from'>{String(route.params?.from ?? '')}</span>
            <button
                data-testid='back'
                onClick={() => navigation.goBack()}
            >
                back
            </button>
        </div>
    )
}

const ScreenC = () => {
    const route = useRoute() as unknown as { params: { via?: string } }
    return (
        <div data-testid='screen_c'>
            <span data-testid='c_via'>{String(route.params?.via ?? '')}</span>
        </div>
    )
}

describe('Test navigator stand-in', () => {
    it('Given screen A, when navigate("B", { from: "A" }), then screen B renders with the params', async () => {
        renderWithNavigation(ScreenA, 'A', {
            additionalScreens: [
                { name: 'B', component: ScreenB },
                { name: 'C', component: ScreenC },
            ],
        })

        await waitFor(() => screen.getByTestId('screen_a'))
        fireEvent.click(screen.getByTestId('go_b'))

        await waitFor(() => screen.getByTestId('screen_b'))
        expect(screen.getByTestId('b_from').textContent).toBe('A')
    })

    it('Given navigate then goBack, when goBack is called, then screen A is rendered again', async () => {
        renderWithNavigation(ScreenA, 'A', {
            additionalScreens: [{ name: 'B', component: ScreenB }],
        })

        fireEvent.click(screen.getByTestId('go_b'))
        await waitFor(() => screen.getByTestId('screen_b'))

        fireEvent.click(screen.getByTestId('back'))
        await waitFor(() => screen.getByTestId('screen_a'))
    })

    it('Given screen A, when replace("C"), then screen C renders and goBack does NOT return to A', async () => {
        renderWithNavigation(ScreenA, 'A', {
            additionalScreens: [
                { name: 'B', component: ScreenB },
                { name: 'C', component: ScreenC },
            ],
        })

        fireEvent.click(screen.getByTestId('replace_with_c'))
        await waitFor(() => screen.getByTestId('screen_c'))
        expect(screen.getByTestId('c_via').textContent).toBe('replace')
        expect(screen.queryByTestId('screen_a')).toBeFalsy()
    })
})
