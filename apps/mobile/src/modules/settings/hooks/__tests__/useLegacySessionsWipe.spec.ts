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

// Both throw on EVALUATION rather than on call: the point of the native twin
// is that the legacy persisted store — whose `partialize` keeps each
// connection's plaintext `session.key` — is never even loaded during a wipe,
// and merely importing this chain is what would rehydrate it.
vi.mock('@perawallet/wallet-core-walletconnect', () => {
    throw new Error(
        'the native legacy sweep must not evaluate the WalletConnect package',
    )
})
vi.mock('@modules/walletconnect/hooks/useWalletConnectSessionsControl', () => {
    throw new Error(
        'the native legacy sweep must not evaluate the sessions-control hook',
    )
})

const { useLegacySessionsWipe } = await import('../useLegacySessionsWipe')

describe('useLegacySessionsWipe', () => {
    it('resolves without reaching the legacy WalletConnect store', async () => {
        const { result } = renderHook(() => useLegacySessionsWipe())

        await expect(
            result.current.deleteAllSessions(),
        ).resolves.toBeUndefined()
    })
})
