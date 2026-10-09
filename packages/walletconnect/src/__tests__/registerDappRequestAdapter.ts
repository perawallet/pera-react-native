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
// Only the auth-data wire pieces and the two size constants are needed here,
// so they are re-exported for real; `useArc0001Resolver`/`useEnqueueArc0001SignRequest`
// are stubbed because nothing in this package's specs calls the enqueue hook
// this file registers — only its identity as a function reference matters.
vi.mock('@perawallet/wallet-core-signing', async () => {
    const constants = await import('../../../signing/src/constants')
    const wire =
        await import('../../../chain-algorand/src/signing/message/arc60-wire')
    return {
        MAX_DATA_SIGN_REQUESTS: constants.MAX_DATA_SIGN_REQUESTS,
        MAX_TRANSACTION_SIGN_REQUESTS: constants.MAX_TRANSACTION_SIGN_REQUESTS,
        isAuthDataWirePayload: (_chainId: string, ...args: [unknown]) =>
            wire.isArc60WirePayload(...args),
        parseAuthDataWireRequest: (_chainId: string, ...args: [unknown]) =>
            wire.parseArc60WireRequest(...args),
        messageSignerChainAdapters: { has: () => false },
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

// Reached only because the connections barrel's `signing-adapter.ts` imports
// it, for a hook this package's specs never call (see the signing mock
// above). Stubbed rather than real, same wall as the other two.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [],
    chainAccountOf: () => undefined,
    findAccountByAddressOn: () => undefined,
}))

// Reached through the adapter's `emptySignaturesFor`, which specs here stub;
// the real one drags in react-native-mmkv, the same wall as above.
vi.mock('@perawallet/wallet-core-kms', () => ({
    resolvePQSigningInfo: () => null,
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
    getKeystoreStore: () => ({ state: { keys: [] } }),
}))

const { dappRequestChainAdapters } =
    await import('@perawallet/wallet-core-connections/dappRequest')
const { algorandDappRequestAdapter } =
    await import('@perawallet/wallet-core-chain-algorand/connect')

// A vitest setup file, run before every spec in this package: registers the
// real Algorand adapter so every v1/v2 handler spec resolves live
// `walletConnectSupportFor(...)` lookups exactly as the app does. Lives under
// `__tests__` so lanekeep's `withoutTests` exempts it from
// `pera/no-chain-package-imports` — this is the one place walletconnect may
// name a chain package, and only for tests.
dappRequestChainAdapters.register(algorandDappRequestAdapter)
