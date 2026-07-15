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

import type { ComponentType } from 'react'

import { AgeGated } from './AgeGated'

// Wrap a navigator screen so its content — and any side effects/data fetching in
// its body — only mount once the user passes the age gate; blocked users get the
// restricted view instead. Assign the result to a module-scope const and pass that
// to the navigator's `component` prop (never wrap inline, which would remount on
// every render).
export const withAgeGate = <P extends object>(
    Screen: ComponentType<P>,
): ComponentType<P> => {
    const AgeGatedScreen = (props: P) => (
        <AgeGated>
            <Screen {...props} />
        </AgeGated>
    )
    AgeGatedScreen.displayName = `withAgeGate(${
        Screen.displayName ?? Screen.name ?? 'Screen'
    })`
    return AgeGatedScreen
}
