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

import { subtle as nativeSubtle } from 'react-native-quick-crypto'

/**
 * React Native has no global `SubtleCrypto`, so callers must supply one.
 * Split out of `singleton.ts` so that file — which has no `.web.ts` twin and
 * is exported unconditionally for both platforms — never carries a
 * react-native-only runtime import. Metro resolves `subtle.web.ts` in its
 * place for web bundles.
 */
export const subtle = nativeSubtle as unknown as SubtleCrypto
