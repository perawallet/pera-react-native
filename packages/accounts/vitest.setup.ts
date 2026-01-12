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

import 'reflect-metadata'
import { vi, beforeEach } from 'vitest'

// Create a simple in-memory key store for mocking
const mockKeyStore = new Map<string, any>()

beforeEach(() => {
    mockKeyStore.clear()
})

vi.mock('@perawallet/wallet-core-kms', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-kms')>()
    const { useSecureStorageService } = await import(
        '@perawallet/wallet-core-platform-integration'
    )

    return {
        ...actual,
        useKMS: vi.fn(() => ({
            saveKey: vi.fn(async (keyPair, privateKey) => {
                const storage = useSecureStorageService()
                await storage.setItem(keyPair.id, privateKey)
                mockKeyStore.set(keyPair.id, keyPair)
            }),
            deleteKey: vi.fn(async id => {
                const storage = useSecureStorageService()
                await storage.removeItem(id)
                mockKeyStore.delete(id)
            }),
            getPrivateData: vi.fn(async id => {
                const storage = useSecureStorageService()
                return await storage.getItem(id)
            }),
            getKey: vi.fn(id => {
                return mockKeyStore.get(id) ?? null
            }),
            keys: mockKeyStore,
        })),
        useWithKey: vi.fn(() => ({
            executeWithKey: vi.fn(async (id, domain, handler) => {
                const storage = useSecureStorageService()
                const data = await storage.getItem(id)
                if (!data) {
                    throw new actual.KeyNotFoundError(id)
                }
                return handler(data)
            }),
        })),
    }
})
