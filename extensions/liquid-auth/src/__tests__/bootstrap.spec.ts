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

import { describe, it, expect, vi } from 'vitest'

// registerGlobals is a native RN call; stub it so the import is harmless in jsdom.
vi.mock('react-native-webrtc', () => ({ registerGlobals: () => undefined }))

import { installCredentialsPolyfill } from '../bootstrap'

describe('installCredentialsPolyfill', () => {
    it('installs navigator.credentials.get/create backed by the mechanism', async () => {
        const target = {} as { navigator?: { credentials?: unknown } }
        const get = vi.fn().mockResolvedValue({ id: 'c' })
        const create = vi.fn().mockResolvedValue({ id: 'c' })

        installCredentialsPolyfill(target as never, { get, create })

        const creds = (
            target.navigator as {
                credentials: {
                    get: (o: unknown) => Promise<unknown>
                    create: (o: unknown) => Promise<unknown>
                }
            }
        ).credentials
        await creds.get({ publicKey: {} })
        await creds.create({ publicKey: {} })
        expect(get).toHaveBeenCalled()
        expect(create).toHaveBeenCalled()
    })
})
