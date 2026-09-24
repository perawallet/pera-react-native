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
import React from 'react'
import { render, waitFor } from '@testing-library/react'
import type { Persister } from '@tanstack/react-query-persist-client'
import { AppProviders } from '../AppProviders'

const createPersister = (): Persister => ({
    persistClient: vi.fn(),
    restoreClient: vi.fn(async () => undefined),
    removeClient: vi.fn(),
})

describe('AppProviders', () => {
    it('renders children inside the query layer, restored from the given persister', async () => {
        const persister = createPersister()
        const Probe = vi.fn(() => null)

        render(
            <AppProviders persister={persister}>
                <Probe />
            </AppProviders>,
        )

        expect(Probe).toHaveBeenCalled()
        await waitFor(() => expect(persister.restoreClient).toHaveBeenCalled())
    })
})
