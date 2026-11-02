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

import { createContext } from 'react'

export type KeyValueRowAppearance = 'default' | 'detail'

/**
 * Set by a container that restyles every row it holds, including rows another
 * module renders into it. `detail` is the transaction details card: a 15pt
 * medium label and the value pinned to the right edge.
 */
export const KeyValueRowAppearanceContext =
    createContext<KeyValueRowAppearance>('default')
