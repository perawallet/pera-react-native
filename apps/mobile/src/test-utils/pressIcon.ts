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

import { act, screen } from '@testing-library/react'

/**
 * Presses a `PWIcon` that takes `onPress` (a sheet header's close icon, say):
 * it renders an svg, and a DOM click never reaches its `onPress`.
 */
export const pressIcon = (testID: string): void => {
    const icon = screen.getByTestId(testID) as unknown as Record<
        string,
        { onPress: () => void }
    >
    const propsKey = Object.keys(icon).find(key =>
        key.startsWith('__reactProps'),
    )!
    act(() => icon[propsKey]!.onPress())
}
