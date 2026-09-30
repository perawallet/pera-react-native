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

import { vi } from 'vitest'

// The signing barrel transitively reaches react-native-mmkv (through its
// store hooks), which has no loadable binding under vitest — the same wall
// `packages/connections`' own vitest.setup.ts documents and routes around.
// Only the ARC-60 wire pieces and the two size constants are needed here, so
// they are re-exported for real; `useArc0001Resolver`/`useEnqueueArc0001SignRequest`
// are stubbed because nothing in this package's specs calls the enqueue hook
// this file registers — only its identity as a function reference matters.
vi.mock('@perawallet/wallet-core-signing', async () => {
    const constants = await import('../../../signing/src/constants')
    const wire = await import('../../../signing/src/utils/arc60-wire')
    return {
        MAX_DATA_SIGN_REQUESTS: constants.MAX_DATA_SIGN_REQUESTS,
        MAX_TRANSACTION_SIGN_REQUESTS: constants.MAX_TRANSACTION_SIGN_REQUESTS,
        ARC60_MAX_REQUEST_BYTES: wire.ARC60_MAX_REQUEST_BYTES,
        arc60WireSchema: wire.arc60WireSchema,
        assertArc60RequestWithinLimits: wire.assertArc60RequestWithinLimits,
        parseArc60WireRequest: wire.parseArc60WireRequest,
        useArc0001Resolver: () => () => {
            throw new Error(
                'useArc0001Resolver is stubbed in walletconnect specs; nothing here should call it',
            )
        },
        useEnqueueArc0001SignRequest: () => async () => {
            throw new Error(
                'useEnqueueArc0001SignRequest is stubbed in walletconnect specs; nothing here should call it',
            )
        },
    }
})

// Same wall as the signing barrel, and the same remedy: ARC-0001 is the only
// part of the blockchain package this layer touches, and it is self-contained.
vi.mock(
    '@perawallet/wallet-core-blockchain',
    async () => await import('../../../blockchain/src/arc0001'),
)

// Reached only because the connections barrel's `signing-adapter.ts` imports
// it, for a hook this package's specs never call (see the signing mock
// above). Stubbed rather than real, same wall as the other two.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [],
    canSignArbitraryData: () => false,
    canSignArc60: () => false,
}))

const { dappRequestChainAdapters } = await import(
    '@perawallet/wallet-core-connections/dappRequest'
)
const { algorandDappRequestAdapter } = await import(
    '@perawallet/wallet-core-chain-algorand/connect'
)

// A vitest setup file, run before every spec in this package: registers the
// real Algorand adapter so every v1/v2 handler spec resolves live
// `walletConnectSupportFor(...)` lookups exactly as the app does. Lives under
// `__tests__` so lanekeep's `withoutTests` exempts it from
// `pera/no-chain-package-imports` — this is the one place walletconnect may
// name a chain package, and only for tests.
dappRequestChainAdapters.register(algorandDappRequestAdapter)
