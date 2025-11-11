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

/**
 * Factory to create a vi.mock()-compatible module that exposes a Zustand-like useAppStore.
 * It supports selector usage and exposes getState/setState helpers for tests.
 */
export function createUseAppStoreMock<TState extends Record<string, any>>(
    initial: TState,
) {
    let state = { ...initial } as TState

    const useAppStore: any = (selector: (s: TState) => any) => selector(state)
    useAppStore.getState = () => state
    useAppStore.setState = (partial: Partial<TState>) => {
        state = { ...state, ...partial } as TState
    }

    return { useAppStore }
}
