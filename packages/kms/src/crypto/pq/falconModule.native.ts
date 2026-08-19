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

import { FalconModule } from '@joe-p/react-native-falcon'

import type { NativeFalconModule } from './types'

/**
 * On-device accessor for the native Falcon-1024 nitro module.
 *
 * The import is deliberately STATIC where the off-device twin uses a lazy
 * `require`. A lazy `require` does not survive this package's library build:
 * rolldown rewrites a `require` of an external into its own runtime shim
 * (`k("@joe-p/react-native-falcon")`), and Metro's dependency collector only
 * records calls whose callee is literally `require` — so the specifier would
 * become a dead string, the module would never enter the bundle graph, and the
 * shim would throw "Calling `require` ... in an environment that doesn't expose
 * the `require` function" the first time a quantum key was generated.
 *
 * A static import of an external emits a real `import ... from` that Metro
 * resolves statically. The eagerness is safe precisely because this file only
 * ever reaches an on-device bundle, where the HybridObject exists.
 */
export const getFalconModule = (): NativeFalconModule => FalconModule
