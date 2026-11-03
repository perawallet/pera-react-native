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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { navigationRef } from '@routes/navigationRef'
import { navigateToAccountHistory } from '../navigateToScreen'

describe('navigateToAccountHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("opens the Home tab's account screen on its History tab", () => {
        vi.mocked(navigationRef.isReady).mockReturnValue(true)

        navigateToAccountHistory()

        expect(navigationRef.navigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: {
                screen: 'AccountDetails',
                pop: true,
                params: { tab: 'History' },
            },
        })
    })

    it('does nothing before navigation is ready', () => {
        vi.mocked(navigationRef.isReady).mockReturnValue(false)

        navigateToAccountHistory()

        expect(navigationRef.navigate).not.toHaveBeenCalled()
    })
})
