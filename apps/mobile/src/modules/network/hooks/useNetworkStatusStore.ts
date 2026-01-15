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

import { create } from 'zustand'

type NetworkStatusState = {
    hasInternet: boolean
}

type NetworkStatusActions = {
    setHasInternet: (hasInternet: boolean) => void
}

type NetworkStatusStore = NetworkStatusState & NetworkStatusActions

const initialState: NetworkStatusState = {
    hasInternet: true,
}

export const useNetworkStatusStore = create<NetworkStatusStore>()(set => ({
    ...initialState,
    setHasInternet: (hasInternet: boolean) => set({ hasInternet }),
}))

// Explicit return types for decoupled access
type UseNetworkStatusResult = {
    hasInternet: boolean
}

export const useNetworkStatus = (): UseNetworkStatusResult => {
    const hasInternet = useNetworkStatusStore(state => state.hasInternet)
    return { hasInternet }
}
