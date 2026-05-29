/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useLiquidAuthRegistryStore } from '../store/registryStore'
import type { LiquidAuthSignalClient } from '@perawallet/wallet-extension-liquid-auth'

const fakeClient = () => ({}) as unknown as LiquidAuthSignalClient

describe('useLiquidAuthRegistryStore', () => {
    beforeEach(() => useLiquidAuthRegistryStore.getState().resetState())

    it('registers and forgets clients by sessionId', () => {
        const client = fakeClient()
        useLiquidAuthRegistryStore.getState().registerClient('s1', client)
        expect(useLiquidAuthRegistryStore.getState().clients.s1).toBe(client)

        useLiquidAuthRegistryStore.getState().forgetClient('s1')
        expect(useLiquidAuthRegistryStore.getState().clients.s1).toBeUndefined()
    })

    it('resetState clears all clients', () => {
        useLiquidAuthRegistryStore.getState().registerClient('s1', fakeClient())
        useLiquidAuthRegistryStore.getState().resetState()
        expect(useLiquidAuthRegistryStore.getState().clients).toEqual({})
    })
})
