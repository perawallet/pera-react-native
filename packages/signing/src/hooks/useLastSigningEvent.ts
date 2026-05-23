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

import { useEffect, useState } from 'react'
import { signingEventBus } from '../pipeline/signingEventBus'
import type { SigningLifecycleEvent } from '../pipeline/signingEvents'

export const useLastSigningEvent = <E extends SigningLifecycleEvent>(
    predicate: (event: SigningLifecycleEvent) => event is E,
    requestId?: string,
): E | null => {
    const [last, setLast] = useState<E | null>(() => {
        if (!requestId) return null
        const history = signingEventBus.replay(requestId)
        for (let i = history.length - 1; i >= 0; i--) {
            const e = history[i]
            if (predicate(e)) return e
        }
        return null
    })

    useEffect(() => {
        const unsubscribe = signingEventBus.subscribe(event => {
            if (requestId && event.request.id !== requestId) return
            if (predicate(event)) setLast(event)
        })
        return unsubscribe
    }, [requestId])

    return last
}
