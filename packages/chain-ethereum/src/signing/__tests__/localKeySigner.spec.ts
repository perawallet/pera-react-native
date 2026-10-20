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

import { describe, expect, it } from 'vitest'
import { isRetryableError } from '@perawallet/wallet-core-shared'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { CannotSignError, SigningError } from '@perawallet/wallet-core-signing'
import { createEvmLocalKeySignerAdapter } from '../localKeySigner'
import { ETHEREUM } from '../../__tests__/evm-chains'

const adapter = createEvmLocalKeySignerAdapter(ETHEREUM)

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

describe('ethereumLocalKeySignerAdapter', () => {
    it('refuses to sign transactions or groups, and a retry cannot change that', async () => {
        await expect(
            adapter.signTransactions({} as never, [], [], {} as WalletAccount),
        ).rejects.toBeInstanceOf(SigningError)
        const error = await adapter
            .signGroups({ scope: SCOPE } as never)
            .catch((e: unknown) => e)

        expect(isRetryableError(error)).toBe(false)
    })

    it('builds a strategy that signs for no account', async () => {
        const strategy = adapter.createStrategy({ scope: SCOPE } as never)

        expect(strategy.canSign({} as WalletAccount)).toBe(false)
        await expect(
            strategy.sign({} as never, { id: 'a' } as WalletAccount),
        ).rejects.toBeInstanceOf(CannotSignError)
    })
})
