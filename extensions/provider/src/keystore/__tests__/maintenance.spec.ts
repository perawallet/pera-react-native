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

import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getAllKeys: vi.fn(() => [] as string[]),
    getString: vi.fn(),
    decode: vi.fn(),
}))

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    METADATA_PREFIX: 'k/',
    decode: mocks.decode,
    storage: {
        getAllKeys: mocks.getAllKeys,
        getString: mocks.getString,
    },
}))

import { readPersistedKeys } from '../maintenance'

describe('readPersistedKeys', () => {
    beforeEach(() => {
        mocks.getAllKeys.mockReset().mockReturnValue([])
        mocks.getString.mockReset()
        mocks.decode.mockReset()
    })

    test('decodes every k/ record and ignores the material bucket', () => {
        mocks.getAllKeys.mockReturnValue(['m/a', 'k/a', 'k/b'])
        mocks.getString.mockImplementation((key: string) => `{"id":"${key}"}`)
        mocks.decode.mockImplementation((raw: string) => JSON.parse(raw))

        const result = readPersistedKeys()

        expect(result.keys).toEqual([{ id: 'k/a' }, { id: 'k/b' }])
        expect(result.failedIds).toEqual([])
        expect(mocks.getString).not.toHaveBeenCalledWith('m/a')
    })

    test('reports an undecodable record in failedIds and keeps the rest', () => {
        mocks.getAllKeys.mockReturnValue(['k/good', 'k/bad'])
        mocks.getString.mockReturnValue('{"meta":true}')
        mocks.decode.mockImplementationOnce(() => ({ id: 'good' }))
        mocks.decode.mockImplementationOnce(() => {
            throw new Error('decode failed')
        })

        const result = readPersistedKeys()

        expect(result.keys).toEqual([{ id: 'good' }])
        expect(result.failedIds).toEqual(['k/bad'])
    })

    // `decode` also tolerates the pre-unification legacy payload, but the
    // engine's hydration does not: a record accepted here would still fail
    // `keystore.ready` on the next launch, so it must be rejected now.
    test('rejects a legacy-format record without handing it to decode', () => {
        mocks.getAllKeys.mockReturnValue(['k/legacy'])
        mocks.getString.mockReturnValue('bGVnYWN5LXBheWxvYWQ')

        const result = readPersistedKeys()

        expect(result.keys).toEqual([])
        expect(result.failedIds).toEqual(['k/legacy'])
        expect(mocks.decode).not.toHaveBeenCalled()
    })

    test('skips a record that vanished between getAllKeys and getString', () => {
        mocks.getAllKeys.mockReturnValue(['k/gone'])
        mocks.getString.mockReturnValue(undefined)

        const result = readPersistedKeys()

        expect(result.keys).toEqual([])
        expect(result.failedIds).toEqual([])
    })
})
