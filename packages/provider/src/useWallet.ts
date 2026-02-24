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

import { useStore } from '@tanstack/react-store'
import { useContext } from 'react'
import { AlgorandContext } from './AlgorandProvider'
import { keyStore } from './stores/keyStore'

export function useWallet() {
    const provider = useContext(AlgorandContext)
    if (provider === null) throw new Error('No Provider Found')

    const keys = useStore(keyStore, s => s.keys)
    const status = useStore(keyStore, s => s.status)

    return {
        ...provider,
        keys,
        status,
    }
}
