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

import { describe, expect, it, vi } from 'vitest'
import { Text } from 'react-native'
import { render, screen } from '@test-utils/render'
import { useCapability } from '@hooks/useCapability'
import { CapabilityGuard } from '../CapabilityGuard'

vi.mock('@hooks/useCapability', () => ({ useCapability: vi.fn() }))

const renderGuard = (isAllowed: boolean, withFallback = false) => {
    vi.mocked(useCapability).mockReturnValue(isAllowed)
    return render(
        <CapabilityGuard
            requires={{ platform: 'peraCard' }}
            fallback={withFallback ? <Text>fallback</Text> : undefined}
        >
            <Text>content</Text>
        </CapabilityGuard>,
    )
}

describe('CapabilityGuard', () => {
    it('renders its children when the requirement holds', () => {
        renderGuard(true, true)

        expect(screen.getByText('content')).toBeTruthy()
        expect(screen.queryByText('fallback')).toBeNull()
        expect(useCapability).toHaveBeenCalledWith({ platform: 'peraCard' })
    })

    it('renders nothing when it does not', () => {
        renderGuard(false)

        expect(screen.queryByText('content')).toBeNull()
    })

    it('renders the fallback when it does not and one is given', () => {
        renderGuard(false, true)

        expect(screen.queryByText('content')).toBeNull()
        expect(screen.getByText('fallback')).toBeTruthy()
    })
})
