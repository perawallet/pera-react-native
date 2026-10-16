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
import { renderHook } from '@testing-library/react'
import {
    useAccountScope,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useSendScope } from '../useSendScope'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
    useAccountScope: vi.fn(),
}))

describe('useSendScope', () => {
    it("runs the send on the selected account's own chain", () => {
        const account = {
            id: 'eth',
            custody: { kind: 'local', seed: null },
            chains: { ethereum: { address: '0xabc' } },
        }
        const scope = { chainId: 'ethereum', networkId: 'sepolia' } as const
        vi.mocked(useSelectedAccount).mockReturnValue(account as never)
        vi.mocked(useAccountScope).mockReturnValue(scope)

        const { result } = renderHook(() => useSendScope())

        expect(useAccountScope).toHaveBeenCalledWith(account, 'algorand')
        expect(result.current).toBe(scope)
    })
})
