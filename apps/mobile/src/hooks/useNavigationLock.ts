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
import { useNavigation } from '@react-navigation/native'

type UseNavigationLockResult = {
    allowProgrammaticNavigation: () => void
}

export const useNavigationLock = (
    isLocked: boolean,
): UseNavigationLockResult => {
    const navigation = useNavigation()
    const allowProgrammaticNavRef = useRef(false)

    useEffect(() => {
        if (!isLocked) return

        const unsubscribe = navigation.addListener('beforeRemove', e => {
            if (allowProgrammaticNavRef.current) return
            e.preventDefault()
        })
        navigation.setOptions({ headerLeft: () => null })

        return () => {
            unsubscribe()
            navigation.setOptions({ headerLeft: undefined })
            allowProgrammaticNavRef.current = false
        }
    }, [isLocked, navigation])

    const allowProgrammaticNavigation = useCallback(() => {
        allowProgrammaticNavRef.current = true
    }, [])

    return { allowProgrammaticNavigation }
}
