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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { platformMock, encodeMock, encryptMock, masterKeyMock, storageMock } =
    vi.hoisted(() => ({
        platformMock: { OS: 'android' as 'android' | 'ios' },
        encodeMock: vi.fn((value: unknown) => value),
        encryptMock: vi.fn(() => new Uint8Array([1])),
        masterKeyMock: vi.fn(async () => new Uint8Array(32)),
        storageMock: { set: vi.fn(), getString: vi.fn() },
    }))

vi.mock('react-native', () => ({ Platform: platformMock }))

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    encode: encodeMock,
    encryptData: encryptMock,
    getMasterKey: masterKeyMock,
    storage: storageMock,
}))

import { writeNativePasskeyEntry } from '../writeNativePasskeyEntry'

const OPAQUE_USER_ID = 'dXNlci1pZA' // WebAuthn user.id (base64, opaque)
const HUMAN_USER_NAME = 'alice@example.com' // WebAuthn user.name (display)

const writeFor = async (os: 'android' | 'ios') => {
    platformMock.OS = os
    await writeNativePasskeyEntry({
        credentialId: 'cred-1',
        origin: 'https://webauthn.io',
        userId: OPAQUE_USER_ID,
        userName: HUMAN_USER_NAME,
        displayName: 'Alice',
        publicKeySpkiDer: new Uint8Array(91),
        privateKey: new Uint8Array(32),
    })
    const keyData = encodeMock.mock.calls.at(-1)?.[0] as {
        metadata: Record<string, unknown>
    }
    return keyData.metadata
}

beforeEach(() => {
    encodeMock.mockClear()
    encryptMock.mockClear()
    storageMock.set.mockClear()
})

describe('writeNativePasskeyEntry metadata mapping', () => {
    it('Android: metadata.userHandle is the human-readable user.name (the OS picker label)', async () => {
        const metadata = await writeFor('android')

        expect(metadata.userHandle).toBe(HUMAN_USER_NAME)
        expect(metadata.userId).toBe(OPAQUE_USER_ID)
    })

    it('iOS: metadata.userHandle is the opaque user.id, display comes from userName', async () => {
        const metadata = await writeFor('ios')

        expect(metadata.userHandle).toBe(OPAQUE_USER_ID)
        expect(metadata.userId).toBe(OPAQUE_USER_ID)
        expect(metadata.userName).toBe(HUMAN_USER_NAME)
    })
})
