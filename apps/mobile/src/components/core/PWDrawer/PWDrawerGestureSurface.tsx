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

import { GestureDetector } from 'react-native-gesture-handler'
import type { SharedValue } from 'react-native-reanimated'
import { PWView } from '../PWView'

import { PWDRAWER_EDGE_WIDTH } from './constants'
import { useStyles } from './styles'
import { usePWDrawerDrag } from './usePWDrawerDrag'

export type PWDrawerGestureSurfaceProps = {
    progress: SharedValue<number>
    panelWidth: number
    isOpen: boolean
    onOpen: () => void
    onClose: () => void
    edgeWidth?: number
}

/**
 * The surface that opens the drawer, rendered last so it draws above the
 * content. That z-order is the whole point: `react-native-pager-view`'s root
 * calls `requestDisallowInterceptTouchEvent(true)` on ACTION_DOWN, so any pan in
 * an ancestor of a pager silently never receives the touch stream. Sitting on
 * top means ACTION_DOWN never reaches the pager and the lockout never fires.
 *
 * Closed it is a narrow edge strip; open it covers only the sliver of content
 * still on screen, never the panel — blanketing the panel would swallow the
 * account list's scrolling and turn every tap into a dismiss.
 */
export const PWDrawerGestureSurface = ({
    progress,
    panelWidth,
    isOpen,
    onOpen,
    onClose,
    edgeWidth = PWDRAWER_EDGE_WIDTH,
}: PWDrawerGestureSurfaceProps) => {
    const styles = useStyles({ panelWidth, edgeWidth })
    const gesture = usePWDrawerDrag({
        progress,
        panelWidth,
        onOpen,
        onClose,
        // Tapping the exposed content is the conventional dismiss, and it can't
        // reach the panel from out here.
        hasTapToClose: isOpen,
    })

    return (
        <GestureDetector gesture={gesture}>
            <PWView
                style={isOpen ? styles.contentSliver : styles.edgeStrip}
                testID='pw_drawer_gesture_surface'
            />
        </GestureDetector>
    )
}
