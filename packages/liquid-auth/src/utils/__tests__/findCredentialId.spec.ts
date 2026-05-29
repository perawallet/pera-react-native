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

import { describe, expect, it } from 'vitest'
import { findCredentialId } from '../findCredentialId'
import type { LiquidAuthCredentialRecord } from '../../models'

const credential = (
    over: Partial<LiquidAuthCredentialRecord>,
): LiquidAuthCredentialRecord => ({
    host: 'https://dapp.example',
    address: 'ADDR_A',
    credentialId: 'cred-a',
    createdAt: 0,
    ...over,
})

describe('findCredentialId', () => {
    it('returns the credentialId for a matching host + address', () => {
        const credentials = [credential({})]
        expect(
            findCredentialId(credentials, 'https://dapp.example', 'ADDR_A'),
        ).toBe('cred-a')
    })

    it('returns undefined when the host matches but the address does not', () => {
        const credentials = [credential({})]
        expect(
            findCredentialId(credentials, 'https://dapp.example', 'OTHER'),
        ).toBeUndefined()
    })

    it('returns undefined when the address matches but the host does not', () => {
        const credentials = [credential({})]
        expect(
            findCredentialId(credentials, 'https://other.example', 'ADDR_A'),
        ).toBeUndefined()
    })

    it('returns undefined when there are no credentials', () => {
        expect(
            findCredentialId([], 'https://dapp.example', 'ADDR_A'),
        ).toBeUndefined()
    })
})
