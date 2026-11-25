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
import { renderHook } from '@test-utils/render'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { wipeMigratedLegacyData } from '@perawallet/wallet-core-migrate'
import { useLegacyDataWipe } from '../useLegacyDataWipe'

vi.mock('@perawallet/wallet-core-migrate', () => ({
    wipeMigratedLegacyData: vi.fn().mockResolvedValue('wiped'),
}))

describe('useLegacyDataWipe', () => {
    beforeEach(() => {
        vi.mocked(wipeMigratedLegacyData).mockClear()
    })

    it('waits while the migration gate is still busy', () => {
        renderHook(() => useLegacyDataWipe({ isEnabled: false }))

        expect(wipeMigratedLegacyData).not.toHaveBeenCalled()
    })

    it('runs once for the Algorand chain when enabled, not again on rerender', () => {
        const { rerender } = renderHook(
            ({ isEnabled }) => useLegacyDataWipe({ isEnabled }),
            { initialProps: { isEnabled: false } },
        )

        rerender({ isEnabled: true })
        rerender({ isEnabled: false })
        rerender({ isEnabled: true })

        expect(wipeMigratedLegacyData).toHaveBeenCalledOnce()
        expect(wipeMigratedLegacyData).toHaveBeenCalledWith(
            getProvider().migration,
            'algorand',
        )
    })
})
