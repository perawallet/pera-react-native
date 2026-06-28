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

import { type PropsWithChildren, useEffect } from 'react'
import { useIsFocused } from '@react-navigation/native'

import { useAgeGate } from '@modules/age-gate/hooks/useAgeGate'
import { AgeRestrictedFallback } from '@modules/age-gate/components/AgeRestrictedFallback'
import { AgeGateLoading } from '@modules/age-gate/components/AgeGateLoading'

// Must be rendered within a navigation context — the check (which can open the
// global declaration sheet) only runs while the gated screen is focused, so a
// backgrounded-but-mounted gate (e.g. an unfocused tab) never pops the sheet over
// whatever the user is actually looking at.
export const AgeGated = ({ children }: PropsWithChildren) => {
    const { isAdult, isChecking, ensureChecked, retry } = useAgeGate()
    const isFocused = useIsFocused()

    useEffect(() => {
        if (isFocused) ensureChecked()
    }, [isFocused, ensureChecked])

    if (isAdult) return <>{children}</>

    // While the (potentially slow) platform check / declaration is in flight,
    // show a loading screen rather than the restricted fallback so it doesn't
    // look like access was denied before a decision was reached.
    if (isChecking) return <AgeGateLoading />

    // Resolved to non-adult: show the restricted view. The self-declaration
    // sheet, when offered, floats over the loading screen via the bottom-sheet host.
    return <AgeRestrictedFallback onRetry={retry} />
}
