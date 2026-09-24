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

import { vi } from 'vitest'

// The one design-system stub unit tests keep: a real PWIcon renders an
// anonymous <svg>, so specs could not tell which glyph a component chose. The
// stub exposes it as `icon-${name}`. The integration project unmocks it;
// PWIcon's own spec loads the real module with vi.importActual.
vi.mock('@components/core/PWIcon/PWIcon', () => {
    const React = require('react')
    return {
        PWIcon: ({ onPress, name, testID }: any) =>
            React.createElement('div', {
                onClick: onPress,
                role: onPress ? 'button' : undefined,
                'data-testid': testID || `icon-${name}`,
            }),
    }
})
