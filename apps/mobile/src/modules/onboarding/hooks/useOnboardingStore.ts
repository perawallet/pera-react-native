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

type OnboardingState = {
    shouldPlayConfetti: boolean
    isOnboarding: boolean
}

type OnboardingActions = {
    setShouldPlayConfetti: (value: boolean) => void
    setIsOnboarding: (value: boolean) => void
    reset: () => void
}

type OnboardingStore = OnboardingState & OnboardingActions

const initialState: OnboardingState = {
    shouldPlayConfetti: false,
    isOnboarding: false,
}

export const useOnboardingStore = create<OnboardingStore>()(set => ({
    ...initialState,
    setShouldPlayConfetti: (value: boolean) =>
        set({ shouldPlayConfetti: value }),
    setIsOnboarding: (value: boolean) => set({ isOnboarding: value }),
    reset: () => set(initialState),
}))

// Explicit return types for decoupled access

type UseShouldPlayConfettiResult = {
    shouldPlayConfetti: boolean
    setShouldPlayConfetti: (value: boolean) => void
}

export const useShouldPlayConfetti = (): UseShouldPlayConfettiResult => {
    const shouldPlayConfetti = useOnboardingStore(
        state => state.shouldPlayConfetti,
    )
    const setShouldPlayConfetti = useOnboardingStore(
        state => state.setShouldPlayConfetti,
    )
    return { shouldPlayConfetti, setShouldPlayConfetti }
}

type UseIsOnboardingResult = {
    isOnboarding: boolean
    setIsOnboarding: (value: boolean) => void
}

export const useIsOnboarding = (): UseIsOnboardingResult => {
    const isOnboarding = useOnboardingStore(state => state.isOnboarding)
    const setIsOnboarding = useOnboardingStore(state => state.setIsOnboarding)
    return { isOnboarding, setIsOnboarding }
}
