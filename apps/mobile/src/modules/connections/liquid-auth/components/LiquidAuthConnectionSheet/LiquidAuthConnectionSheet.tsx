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

import type { LiquidAuthConnectRequest } from '@perawallet/wallet-core-liquid-auth'
import { useLiquidAuthConnectionFlow } from '@modules/connections/liquid-auth/hooks'
import { SelectAccountContent } from '@modules/connections/liquid-auth/components/SelectAccountContent'
import { LiquidAuthConnectingContent } from '@modules/connections/liquid-auth/components/LiquidAuthConnectingContent'
import { ConfirmConnectionContent } from '@modules/connections/liquid-auth/components/ConfirmConnectionContent'

export type LiquidAuthConnectionSheetProps = {
    request: LiquidAuthConnectRequest
    /** Invoked with the dApp name when the connection is confirmed + persisted. */
    onConnected: (name: string) => void
}

/**
 * The morphing connection sheet body. It owns the flow phase machine and
 * renders the current phase, so the sheet re-renders across
 * select-account → connecting → confirm even though `useConnectionRequestSheet`
 * captures the contents element only once at open time (the captured element is
 * this component; it re-renders internally as the phase changes).
 */
export const LiquidAuthConnectionSheet = ({
    request,
    onConnected,
}: LiquidAuthConnectionSheetProps) => {
    const flow = useLiquidAuthConnectionFlow(request, onConnected)

    if (flow.phase === 'select-account') {
        return (
            <SelectAccountContent
                host={request.host}
                onSelect={flow.onSelectAccount}
                onReject={flow.onReject}
            />
        )
    }

    if (flow.phase === 'connecting') {
        return (
            <LiquidAuthConnectingContent
                host={request.host}
                onCancel={flow.onCancel}
            />
        )
    }

    // Post-confirm: the session is being persisted. Show the same spinner but
    // without a cancel affordance (the flow settles into success/error itself).
    if (flow.phase === 'finalizing') {
        return <LiquidAuthConnectingContent host={request.host} />
    }

    return (
        <ConfirmConnectionContent
            identity={flow.identity!}
            address={flow.selectedAddress!}
            onConfirm={flow.onConfirm}
            onReject={flow.onReject}
        />
    )
}
