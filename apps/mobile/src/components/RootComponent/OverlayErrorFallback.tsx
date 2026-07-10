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

import { useEffect } from 'react'

const RESET_DELAY_MS = 3000

type OverlayErrorFallbackProps = {
    resetError: () => void
}

// After a caught overlay crash the boundary parks on its fallback and only
// remounts children via `resetError` — without calling it, the signing/
// multisig/swap overlays would stay dead (and silent) until app restart.
// Render nothing, then retry shortly: if the crashing state has cleared the
// overlays self-heal; if it persists the boundary just catches again, with
// the delay damping the log/retry loop.
export const OverlayErrorFallback = ({
    resetError,
}: OverlayErrorFallbackProps) => {
    useEffect(() => {
        const timer = setTimeout(resetError, RESET_DELAY_MS)
        return () => clearTimeout(timer)
    }, [resetError])

    return null
}
