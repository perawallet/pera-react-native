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

import { useCallback } from 'react'
import { getSurface } from '@perawallet/wallet-extension-platform-chrome'
import { openExpandedTab } from '@perawallet/wallet-core-browser-runtime'
import type { ScanTabFlow, UseScanTabHandoffResult } from './useScanTabHandoff'

// The popup can only scan once camera permission is already granted: the
// permission prompt takes focus and Chrome closes the popup. Scanners whose
// result feeds the current flow can't use the scanner's own tab hand-off
// either, since the value can't round-trip back into the closed popup. So the
// whole scan step moves to the expanded tab, like the ASB file pick.
export const useScanTabHandoff = (
    flow: ScanTabFlow,
): UseScanTabHandoffResult => {
    const openScanTab = useCallback(() => openExpandedTab(flow), [flow])

    return { shouldHandOff: getSurface() === 'popup', openScanTab }
}
