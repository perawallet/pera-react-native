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

import { describe, it, expect } from 'vitest'
import { LogicSig } from 'algosdk'
import { encodeDelegatedLsig } from '../lsig'

describe('encodeDelegatedLsig', () => {
    it('round-trips program and signature through algosdk msgpack', () => {
        const program = new Uint8Array([0x04, 0x81, 0x01])
        const sig = new Uint8Array(64).fill(42)

        const encoded = encodeDelegatedLsig(program, sig)
        const decoded = LogicSig.fromByte(encoded)

        expect([...decoded.logic]).toEqual([...program])
        expect([...(decoded.sig ?? [])]).toEqual([...sig])
        expect(decoded.msig).toBeUndefined()
    })
})
