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
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { OnrampEvent, trackEvent } from '@analytics'
import {
    algorandAccountAt,
    registerAlgorandRampAdapter,
} from '@test-utils/rampChainAdapter'
import { useTrackOnrampEvent } from '../useTrackOnrampEvent'

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent: vi.fn(),
}))

describe('useTrackOnrampEvent', () => {
    beforeEach(() => {
        vi.mocked(trackEvent).mockClear()
        useRemoteConfigStore.getState().resetState()
        vi.mocked(useSelectedAccount).mockReturnValue(null)
        registerAlgorandRampAdapter()
    })

    it('names the chain Fund is buying onto', () => {
        vi.mocked(useSelectedAccount).mockReturnValue(
            algorandAccountAt('ALGORAND_ADDRESS'),
        )
        const { result } = renderHook(() => useTrackOnrampEvent())

        result.current(OnrampEvent.ProceedTap)

        expect(trackEvent).toHaveBeenCalledWith(OnrampEvent.ProceedTap, {
            chain_id: 'algorand',
        })
    })

    it('sends nothing while there is no chain to name', () => {
        const { result } = renderHook(() => useTrackOnrampEvent())

        result.current(OnrampEvent.ProceedTap)

        expect(trackEvent).not.toHaveBeenCalled()
    })
})
