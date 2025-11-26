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

import { describe, test, expect, vi } from 'vitest'
import { container } from 'tsyringe'
import { type SecureStorageService } from '../../models'
import {
    useSecureStorageService,
    SecureStorageServiceContainerKey,
} from '../index'

describe('useSecureStorageService tests', () => {
    test('useSecureStorageService resolves the registered SecureStorageService from the container', async () => {
        const dummy: SecureStorageService = {
            setItem: vi.fn(async (_k: string, _v: Buffer) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        container.register(SecureStorageServiceContainerKey, {
            useValue: dummy,
        })

        const svc = useSecureStorageService()
        expect(svc).toBe(dummy)
    })
})
