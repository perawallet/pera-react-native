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

import { useCallback, useEffect, useRef } from 'react'

type UseIsMountedResult = () => boolean

/**
 * Returns a stable getter that reports whether the component is still
 * mounted. Use to guard post-await side effects (navigation.push,
 * setState, showToast) that could otherwise fire on a screen the user
 * has already left.
 */
export const useIsMounted = (): UseIsMountedResult => {
    const isMountedRef = useRef(true)
    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
        }
    }, [])
    return useCallback(() => isMountedRef.current, [])
}
