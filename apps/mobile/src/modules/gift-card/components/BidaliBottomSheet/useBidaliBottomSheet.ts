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

import { useCallback, useLayoutEffect } from 'react'
import { useBidali } from '../../hooks/useBidali'

export const useBidaliBottomSheet = (
    isVisible: boolean,
    onClose: () => void,
): void => {
    const { setOnClose, reset } = useBidali()

    const handleClose = useCallback(() => {
        reset()
        onClose()
    }, [reset, onClose])

    useLayoutEffect(() => {
        if (isVisible) {
            setOnClose(handleClose)
        }
    }, [isVisible, handleClose, setOnClose])
}
