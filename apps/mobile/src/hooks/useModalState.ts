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

import { useState, useCallback } from 'react'

/**
 * A simple hook for managing the open/closed state of a modal.
 *
 * @param initialOpen Initial visibility state of the modal
 * @returns Modal visibility state and control methods
 *
 * @example
 * const { isOpen, open, close, toggle } = useModalState()
 */
export function useModalState(initialOpen = false): {
    isOpen: boolean
    open: () => void
    close: () => void
    toggle: () => void
} {
    const [isOpen, setIsOpen] = useState(initialOpen)

    const open = useCallback(() => {
        setIsOpen(true)
    }, [])

    const close = useCallback(() => {
        setIsOpen(false)
    }, [])

    const toggle = useCallback(() => {
        setIsOpen(prev => !prev)
    }, [])

    return {
        isOpen,
        open,
        close,
        toggle,
    }
}
