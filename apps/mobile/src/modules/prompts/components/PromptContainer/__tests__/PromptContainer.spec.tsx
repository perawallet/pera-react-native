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

import { useContext } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NavigationContainerRefContext } from '@react-navigation/native'
import { render } from '@test-utils/render'
import { navigationRef } from '@routes/navigationRef'
import { PWText } from '@components/core'
import { PromptContainer } from '../PromptContainer'

// PERA-4870 moved this container out of AccountScreen and up to RootComponent,
// where it is a sibling of <MainRoutes /> and so mounts outside
// NavigationContainer. PinSecurityPrompt's useNavigation threw there and the
// root error boundary replaced the app with its error screen. Asserting the
// context directly rather than through a rendered useNavigation: vitest.setup
// mocks @react-navigation/native with a useNavigation that never throws and
// never reads context, so a render-level assertion would pass either way.
let capturedRef: unknown = 'not-rendered'

const ProbePrompt = () => {
    capturedRef = useContext(NavigationContainerRefContext)
    return <PWText>probe</PWText>
}

vi.mock('../usePromptContainer', () => ({
    usePromptContainer: () => ({
        nextPrompt: { id: 'probe', component: ProbePrompt },
        dismissPrompt: vi.fn(),
        hidePrompt: vi.fn(),
    }),
}))

describe('PromptContainer', () => {
    it('gives prompts the navigation container ref they cannot get from context', () => {
        render(<PromptContainer />)

        expect(capturedRef).toBe(navigationRef)
    })
})
