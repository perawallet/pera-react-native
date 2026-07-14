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

import { useEffect } from 'react'

type NestedNavigateParams = {
    screen?: string
    params?: Record<string, unknown>
}

type NestedNavigateRedirectProps = {
    route: { params?: NestedNavigateParams }
    navigation: { replace: (name: string, params?: object) => void }
}

/**
 * Bridges production's nested-navigator calls onto the flat in-memory test
 * navigator. Production rekey screens navigate with
 * `navigate('RekeyToStandard', { screen, params })`; the test navigator
 * (`test-navigator.tsx`) is flat, so register this component under the parent
 * route name and register each inner screen as a sibling. When the parent
 * route is hit, this immediately `replace`s it with the requested inner
 * screen, forwarding the unwrapped params so the inner screen's `useRoute`
 * sees the shape it expects.
 */
export const NestedNavigateRedirect = ({
    route,
    navigation,
}: NestedNavigateRedirectProps) => {
    const screen = route.params?.screen
    const params = route.params?.params

    useEffect(() => {
        if (screen) navigation.replace(screen, params)
        // Forward once per requested screen; params are carried alongside it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screen])

    return null
}
