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

import { createContext, createElement, useContext } from 'react'

import type { ReactNode } from 'react'
import type { Nullable } from '@perawallet/wallet-core-shared'

const SigningRequestScopeContext = createContext<Nullable<string>>(null)

export type SigningRequestScopeProviderProps = {
    requestId: string
    children: ReactNode
}

/**
 * Scopes every signing hook rendered beneath it to one sign request. The
 * review sheet wraps its content in this provider so `useSigningRequest`
 * (and everything built on it — `useSigningPipeline`, the action buttons,
 * the signing screens) binds to the request the sheet was opened FOR, not
 * whatever currently sits at the queue head. Outside a provider the hooks
 * keep their queue-head semantics, which is what headless flows want.
 */
export const SigningRequestScopeProvider = ({
    requestId,
    children,
}: SigningRequestScopeProviderProps) =>
    createElement(
        SigningRequestScopeContext.Provider,
        { value: requestId },
        children,
    )

/** The request id this subtree is scoped to, or null outside a provider. */
export const useScopedSignRequestId = (): Nullable<string> =>
    useContext(SigningRequestScopeContext)
