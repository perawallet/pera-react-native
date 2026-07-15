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

import { LogicSig } from 'algosdk'

/**
 * Builds the msgpack-encoded delegated LogicSig from a program and an
 * externally produced ed25519 signature over `"Program" || program`.
 */
export const encodeDelegatedLsig = (
    program: Uint8Array,
    sig: Uint8Array,
): Uint8Array => {
    const lsig = new LogicSig(program)
    lsig.sig = sig
    return lsig.toByte()
}
