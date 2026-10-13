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

import { describe, test, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFindAlternateImportKinds } from '../useFindAlternateImportKinds'
import {
    FAKE_EXPLICIT_SEED,
    FAKE_SINGLE_SEED,
    fakeAccountsChain,
    registerFakeAccountsChain,
    TESTNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'

const INDICES = new Uint16Array(25)

const findOp = () =>
    vi.mocked(
        fakeAccountsChain().adapter.singleKeyAccounts!.findAlternateImportKinds,
    )

describe('useFindAlternateImportKinds', () => {
    test('returns what the chain finds under the other kinds, on the scope it was given', async () => {
        const alternates = [{ seed: FAKE_EXPLICIT_SEED, address: 'OTHER' }]
        findOp().mockResolvedValue(alternates)

        const { result } = renderHook(() =>
            useFindAlternateImportKinds(TESTNET_SCOPE),
        )

        await expect(result.current(FAKE_SINGLE_SEED, INDICES)).resolves.toBe(
            alternates,
        )
        expect(findOp()).toHaveBeenCalledWith(
            FAKE_SINGLE_SEED,
            INDICES,
            TESTNET_SCOPE,
        )
    })

    test('finds none on a chain without single-key accounts', async () => {
        registerFakeAccountsChain({ singleKeyAccounts: undefined })

        const { result } = renderHook(() =>
            useFindAlternateImportKinds(TESTNET_SCOPE),
        )

        await expect(
            result.current(FAKE_SINGLE_SEED, INDICES),
        ).resolves.toEqual([])
    })
})
