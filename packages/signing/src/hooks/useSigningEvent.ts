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

import { useEffect, useRef } from 'react'
import { signingEventBus } from '../pipeline/signingEventBus'
import type { SigningLifecycleEvent } from '../pipeline/signingEvents'

export type UseSigningEventOptions = {
    /** When true, replay matching retained events on mount. Requires requestId. */
    replay?: boolean
    /** Required when replay is true — bounds replay to events for this request. */
    requestId?: string
}

export const useSigningEvent = (
    predicate: (event: SigningLifecycleEvent) => boolean,
    handler: (event: SigningLifecycleEvent) => void,
    options: UseSigningEventOptions = {},
): void => {
    const handlerRef = useRef(handler)
    handlerRef.current = handler
    const predicateRef = useRef(predicate)
    predicateRef.current = predicate

    useEffect(() => {
        if (options.replay && options.requestId) {
            for (const event of signingEventBus.replay(options.requestId)) {
                if (predicateRef.current(event)) handlerRef.current(event)
            }
        }
        const unsubscribe = signingEventBus.subscribe(event => {
            if (predicateRef.current(event)) handlerRef.current(event)
        })
        return unsubscribe
    }, [options.replay, options.requestId])
}
