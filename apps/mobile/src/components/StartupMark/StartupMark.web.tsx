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

import React, { useEffect, useState } from 'react'

const MARK_DELAY_MS = 300

// Timed from page load rather than mount, so the pre-hydration screen and the
// shell's loader hand over without the mark blinking or restarting its delay.
const getRemainingDelay = (): number =>
    Math.max(0, MARK_DELAY_MS - performance.now())

// Renders before hydration, so it must not import `@components/core` (a
// store-bearing graph); `.pera-bootstrap` comes from the extension's global CSS.
export const StartupMark = () => {
    const [isVisible, setIsVisible] = useState(() => getRemainingDelay() === 0)

    useEffect(() => {
        if (isVisible) return
        const timer = setTimeout(() => setIsVisible(true), getRemainingDelay())
        return () => clearTimeout(timer)
    }, [isVisible])

    if (!isVisible) return null
    return (
        <div
            className='pera-bootstrap'
            role='status'
        >
            <img
                src='./icons/icon-128.png'
                alt='Pera Wallet'
            />
        </div>
    )
}
