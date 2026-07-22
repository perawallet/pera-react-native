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

import { describe, it, expect, vi } from 'vitest'
import { Text, type RefreshControl } from 'react-native'
import { render, screen } from '@test-utils/render'
import { PWRefreshControl } from '../PWRefreshControl.web'

// The `@modules/network` barrel re-exports useNetworkStatusListener, which
// imports the NetInfo native module vitest can't parse (same pattern as
// usePWRefreshControl.spec.ts).
vi.mock('@react-native-community/netinfo', () => ({
    default: {
        addEventListener: vi.fn(),
    },
}))

// The test harness's global `react-native` mock has no `RefreshControl`
// export. react-native-web's real one is `(props) => createElement(View,
// rest)` — spreading every prop (including `children`) onto a plain View —
// so a bare View stand-in exercises the exact behavior this test guards.
// Cast past the `SIZE` static RefreshControl carries that View doesn't;
// PWRefreshControl.web.tsx never reads it.
vi.mock(import('react-native'), async importOriginal => {
    const actual = await importOriginal()
    return {
        ...actual,
        RefreshControl: actual.View as unknown as typeof RefreshControl,
    }
})

describe('PWRefreshControl (web)', () => {
    // Regression guard: react-native-web's ScrollView renders a
    // `refreshControl` element via `cloneElement(refreshControl, { style },
    // scrollView)` — it hands the control the entire scrollable content as
    // `children` and expects the control to render them. The
    // gesture-handler-backed native variant's RefreshControl doesn't do
    // this on web, silently rendering every list (any PWFlatList, or a raw
    // SectionList) empty. This wrapper must forward `children` through to
    // react-native's own RefreshControl, which does.
    it('renders its children (the list content react-native-web hands it via cloneElement)', () => {
        render(
            <PWRefreshControl
                isRefreshing={false}
                onRefresh={() => {}}
            >
                <Text>list content</Text>
            </PWRefreshControl>,
        )

        expect(screen.getByText('list content')).toBeTruthy()
    })
})
