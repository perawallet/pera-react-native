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

import type { Nullable } from '@perawallet/wallet-core-shared'

/** Logos a folder row shows before the "+N" chip, like `ChainIconStack`. */
export const DAPP_LOGO_STACK_MAX = 3

export type DappLogoStack = {
    visible: Nullable<string>[]
    /** dApps past the visible logos, shown as "+N". */
    hiddenCount: number
}

/** The logos to stack and how many dApps are left over, out of `total`. */
export const dappLogoStack = (
    logos: readonly Nullable<string>[],
    total: number,
): DappLogoStack => {
    const visible = logos.slice(0, DAPP_LOGO_STACK_MAX)
    return { visible, hiddenCount: Math.max(0, total - visible.length) }
}
