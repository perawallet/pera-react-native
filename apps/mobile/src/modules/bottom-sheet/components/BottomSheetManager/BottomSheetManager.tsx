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

import { useEffect } from 'react'
import { useBlockHardwareBackWhileSheetOpen } from '../../hooks/useBlockHardwareBackWhileSheetOpen'
import { useBottomSheetStore } from '../../store/bottomSheetStore'
import { BottomSheetHost } from '../BottomSheetHost'
import { usePresentableRequests } from './usePresentableRequests'

export const BottomSheetManager = () => {
    const requests = usePresentableRequests()
    const registerBottomSheetHost = useBottomSheetStore(
        s => s.registerBottomSheetHost,
    )
    const unregisterBottomSheetHost = useBottomSheetStore(
        s => s.unregisterBottomSheetHost,
    )
    useBlockHardwareBackWhileSheetOpen()

    useEffect(() => {
        registerBottomSheetHost()
        return unregisterBottomSheetHost
    }, [registerBottomSheetHost, unregisterBottomSheetHost])

    return (
        <>
            {requests.map(req => (
                <BottomSheetHost
                    key={req.id}
                    request={req}
                />
            ))}
        </>
    )
}
