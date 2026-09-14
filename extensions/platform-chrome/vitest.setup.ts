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

// The connections barrel transitively reaches react-native-mmkv, which has no
// loadable binding under vitest (`packages/connections` hits the same wall).
// This package only needs the error class and the pairing-outcome helper, both
// dependency-light, so they are re-exported for real instead of faked.
vi.mock('@perawallet/wallet-core-connections', async () => {
    const errors = await import('../../packages/connections/src/errors')
    const pairingOutcome =
        await import('../../packages/connections/src/pairingOutcome')
    return { ...errors, ...pairingOutcome }
})
