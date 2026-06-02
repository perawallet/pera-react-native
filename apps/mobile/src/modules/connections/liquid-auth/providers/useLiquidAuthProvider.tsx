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

import { useState } from 'react'
import {
    useLiquidAuthStore,
    type LiquidAuthConnectRequest,
} from '@perawallet/wallet-core-liquid-auth'
import { type Nullable } from '@perawallet/wallet-core-shared'
import {
    useConnectionRequestSheet,
    useConnectionResultSheet,
} from '@modules/connections/hooks'
import { ConnectionSuccessSheet } from '@modules/connections/components/ConnectionSuccessSheet'
import { ConnectionErrorSheet } from '@modules/connections/components/ConnectionErrorSheet'
import { LiquidAuthConnectionSheet } from '@modules/connections/liquid-auth/components/LiquidAuthConnectionSheet'

export type UseLiquidAuthProviderResult = {
    connectRequest: Nullable<LiquidAuthConnectRequest>
    successHost: Nullable<string>
    connectionError: Nullable<Error>
}

/**
 * Effect-driven sheet management for Liquid Auth. A single bottom sheet renders
 * `LiquidAuthConnectionSheet`, which owns the phase machine and morphs through
 * select-account → connecting → confirm internally (the request sheet captures
 * its contents element only once at open time, so the morphing must happen
 * inside that captured component, not by swapping contents here). On success
 * the component calls back with the dApp name → success sheet; the flow clears
 * `connectRequest` → the request sheet dismisses. Errors surface the error
 * sheet. Gated by `isEnabled` (the remote-config flag).
 */
export const useLiquidAuthProvider = (
    isEnabled: boolean,
): UseLiquidAuthProviderResult => {
    const connectRequest = useLiquidAuthStore(state => state.connectRequest)
    const connectionError = useLiquidAuthStore(state => state.connectionError)
    const [successHost, setSuccessHost] = useState<Nullable<string>>(null)

    const shouldShow =
        isEnabled && !!connectRequest && !connectionError && !successHost

    useConnectionRequestSheet({
        shouldShow,
        renderContents: () => (
            <LiquidAuthConnectionSheet
                request={connectRequest!}
                onConnected={setSuccessHost}
            />
        ),
        // `lg` + `autoCreateContainer: false` matches the WalletConnect approval
        // sheet: ConnectionApprovalSheet supplies its own in-sheet FlatList, so
        // the account list scrolls internally and the action buttons stay
        // visible. `size: 'auto'` would grow to the content and push the buttons
        // off-screen. Pan-down AND backdrop dismissal stay disabled so the sheet
        // isn't dismissed mid-connect — Cancel/Reject must resolve the flow, or
        // a stray tap would strand the pending connectRequest until restart.
        options: {
            size: 'lg',
            autoCreateContainer: false,
            enablePanDownToClose: false,
            enableCloseOnBackdropPress: false,
        },
    })

    useConnectionResultSheet({
        isActive: isEnabled && !!successHost,
        renderContents: () => <ConnectionSuccessSheet name={successHost!} />,
        onClose: () => setSuccessHost(null),
    })

    useConnectionResultSheet({
        isActive: isEnabled && !!connectionError,
        renderContents: () => <ConnectionErrorSheet error={connectionError} />,
        onClose: () => useLiquidAuthStore.getState().setConnectionError(null),
    })

    return { connectRequest, successHost, connectionError }
}
