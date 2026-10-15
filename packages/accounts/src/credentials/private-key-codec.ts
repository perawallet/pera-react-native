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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import {
    accountsChainAdapters,
    type AccountsChainAdapter,
} from '../chain-adapter'
import { PrivateKeyCodecUnsupportedError } from '../errors'

const codecOf = <K extends 'parsePrivateKey' | 'formatPrivateKey'>(
    chainId: ChainId,
    method: K,
): NonNullable<AccountsChainAdapter[K]> => {
    const adapter = accountsChainAdapters.has(chainId)
        ? accountsChainAdapters.get(chainId)
        : undefined
    const fn = adapter?.[method]
    if (!adapter || !fn) throw new PrivateKeyCodecUnsupportedError(chainId)
    return fn.bind(adapter) as NonNullable<AccountsChainAdapter[K]>
}

/** The key bytes of user-entered text on `chainId`. The caller zeroes the result. */
export const parsePrivateKey = (chainId: ChainId, input: string): Uint8Array =>
    codecOf(chainId, 'parsePrivateKey')(input)

/** Parses and zeroes at once, so validating input never leaves key bytes behind. */
export const isValidPrivateKeyInput = (
    chainId: ChainId,
    input: string,
): boolean => {
    try {
        zeroBytes(parsePrivateKey(chainId, input))
        return true
    } catch {
        return false
    }
}

export const formatPrivateKey = (
    chainId: ChainId,
    privateKey: Uint8Array,
): string => codecOf(chainId, 'formatPrivateKey')(privateKey)
