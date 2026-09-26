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

// This package imports neither barrel; the source-aliased connections barrel
// does, and both transitively reach react-native-mmkv, whose entry resolves a
// platform-suffixed file with no node build — and it fails at resolution time,
// before a `vi.mock` of the native module itself could intervene
// (`packages/connections` hits the same wall). Every module named here is the
// REAL one, narrowed to what the registry actually reaches: the point of the
// specs is that the registry's validation behaves as the real code does, so a
// hand-written fake would prove nothing.
vi.mock('@perawallet/wallet-core-signing', async () => ({
    ...(await import('../signing/src/pipeline/errors')),
    ...(await import('../signing/src/utils/arc60-wire')),
    ...(await import('../signing/src/constants')),
}))
vi.mock(
    '@perawallet/wallet-core-blockchain',
    async () => await import('../blockchain/src/arc0001'),
)
// Reached only by `signing/src/constants`, for one string. Its own barrel is
// the mmkv wall a third time over, and its constants module has no imports.
vi.mock(
    '@perawallet/wallet-core-kms',
    async () => await import('../kms/src/constants'),
)
// Reached only through the connections barrel's signing-adapter, which these
// specs never exercise; `utils` is the mmkv-free half it imports.
vi.mock(
    '@perawallet/wallet-core-accounts',
    async () => await import('../accounts/src/utils'),
)
