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

import type { NativeFalconModule } from './types'

/**
 * Off-device accessor for the native Falcon-1024 nitro module.
 *
 * The pq barrel re-exports `createRNFalconProvider` regardless of which
 * `getPQProvider` variant the bundler picked, so node/vitest still import this
 * file's consumer. `@joe-p/react-native-falcon` instantiates its HybridObject
 * at module scope and throws off-device, so the specifier stays behind a lazy
 * `require` that only runs if something actually calls the native provider —
 * pinned by `pqImportSideEffects.spec.ts`.
 *
 * On device, `falconModule.native.ts` replaces this file with a static import
 * (see there for why the lazy form cannot survive a library build).
 */
export const getFalconModule = (): NativeFalconModule => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FalconModule } = require('@joe-p/react-native-falcon') as {
        FalconModule: NativeFalconModule
    }
    return FalconModule
}
