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

import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProvenPasskeysStore } from '../provenPasskeysStore'
import type { BackupPasskey } from '../../sync/types'

const passkey: BackupPasskey = {
    credentialId: 'cred-1',
    origin: 'webauthn.io',
    identity: 'alice',
    counter: 0,
    publicKeySpkiDer: 'cHVi',
    seedAddress: 'SEEDADDRESS',
    createdAt: 1,
}

beforeEach(() => {
    act(() => useProvenPasskeysStore.getState().resetState())
})

describe('useProvenPasskeysStore', () => {
    test('starts empty and follows setProvenPasskeys', () => {
        const { result } = renderHook(() => useProvenPasskeysStore())
        expect(result.current.provenPasskeys).toEqual([])

        act(() => result.current.setProvenPasskeys([passkey]))

        expect(result.current.provenPasskeys).toEqual([passkey])
    })

    test('holds no persist middleware, so proof does not outlive the process', () => {
        act(() =>
            useProvenPasskeysStore.getState().setProvenPasskeys([passkey]),
        )

        expect(
            (useProvenPasskeysStore as unknown as { persist?: unknown })
                .persist,
        ).toBeUndefined()
    })

    test('resetState clears the list', () => {
        const { result } = renderHook(() => useProvenPasskeysStore())
        act(() => result.current.setProvenPasskeys([passkey]))

        act(() => result.current.resetState())

        expect(result.current.provenPasskeys).toEqual([])
    })
})
