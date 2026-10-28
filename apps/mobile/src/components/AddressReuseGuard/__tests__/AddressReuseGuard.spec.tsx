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

import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
    AddressReuseGuardProvider,
    useAddressReuseGuard,
    type AddressReuseGuard,
} from '../AddressReuseGuard'

describe('useAddressReuseGuard', () => {
    it('allows every address outside a provider', async () => {
        const { result } = renderHook(() => useAddressReuseGuard())

        await expect(result.current.confirmReuse('ANY')).resolves.toBe(true)
    })

    it("asks the provider's guard", async () => {
        const guard: AddressReuseGuard = {
            confirmReuse: vi.fn().mockResolvedValue(false),
        }
        const wrapper = ({ children }: { children: ReactNode }) => (
            <AddressReuseGuardProvider guard={guard}>
                {children}
            </AddressReuseGuardProvider>
        )

        const { result } = renderHook(() => useAddressReuseGuard(), {
            wrapper,
        })

        await expect(result.current.confirmReuse('ADDR')).resolves.toBe(false)
        expect(guard.confirmReuse).toHaveBeenCalledWith('ADDR')
    })
})
