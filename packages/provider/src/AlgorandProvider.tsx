/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { createContext, type Key } from 'react'
import { type Extension, Provider } from '@algorandfoundation/wallet-provider'
import { WithKeyStore } from '@perawallet/react-native-keystore'
import type { KeyStoreAPI } from '@algorandfoundation/keystore'
import type { HookCollection } from 'before-after-hook'

export class AlgorandProvider extends Provider<readonly Extension[]> {
    static EXTENSIONS = [WithKeyStore] as const

    keys!: Key[]
    key!: {
        store: KeyStoreAPI & { hooks: HookCollection }
    }
}

export const AlgorandContext = createContext<null | AlgorandProvider>(null)
