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

import { describe, it, expect, vi } from 'vitest'
import WalletConnect from '@perawallet/walletconnect'
import { PERA_CLIENT_META } from '../../constants'
import { createWalletConnectConnector } from '../createConnector'

// The real WC v1 client opens a relay socket jsdom can't service — this
// mock only needs to capture the constructor call so the test can assert
// on the options the factory forwarded.
vi.mock('@perawallet/walletconnect', () => ({ default: vi.fn() }))

// `../../constants` re-exports signing limits from this package, whose
// import chain pulls in react-native-mmkv (unavailable under jsdom) — same
// workaround as `sessionOutcome.test.ts`.
vi.mock('@perawallet/wallet-core-signing', () => ({
    MAX_DATA_SIGN_REQUESTS: 10,
    MAX_TRANSACTION_SIGN_REQUESTS: 64,
    ARC60_MAX_REQUEST_BYTES: 64 * 1024,
}))

describe('createWalletConnectConnector', () => {
    it('passes PERA_CLIENT_META through', () => {
        createWalletConnectConnector({ uri: 'wc:topic@1' })

        expect(WalletConnect).toHaveBeenCalledWith(
            expect.objectContaining({ clientMeta: PERA_CLIENT_META }),
        )
    })

    it('forwards a pairing uri', () => {
        createWalletConnectConnector({ uri: 'wc:topic@1?bridge=b&key=00' })

        expect(WalletConnect).toHaveBeenCalledWith(
            expect.objectContaining({
                uri: 'wc:topic@1?bridge=b&key=00',
            }),
        )
    })

    it('forwards a persisted session', () => {
        const session = { clientId: 'client-1', peerId: 'peer-1' }

        createWalletConnectConnector({ session })

        expect(WalletConnect).toHaveBeenCalledWith(
            expect.objectContaining({ session }),
        )
    })

    // Without an explicit `storage`, the SDK defaults to
    // `window.localStorage` and adopts whatever session is sitting there —
    // see `createConnectorSessionStorage.test.ts` for the full corruption
    // repro against the real SDK class.
    it('passes a no-op session storage so the SDK never touches window.localStorage', () => {
        createWalletConnectConnector({ uri: 'wc:topic@1?bridge=b&key=00' })

        const options = vi.mocked(WalletConnect).mock.calls[0][0] as {
            storage?: { getSession: () => unknown }
        }
        expect(options.storage).toBeDefined()
        expect(options.storage?.getSession()).toBeNull()
    })
})
