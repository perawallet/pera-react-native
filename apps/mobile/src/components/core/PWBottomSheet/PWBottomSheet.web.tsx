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

// Web replacement for the @gorhom/bottom-sheet-based PWBottomSheet: worklets
// are metro web stubs, so the animated native sheet cannot run under
// react-native-web. Same PWBottomSheetProps contract, rendered as a
// bottom-anchored RN Modal, animated with RN `Animated` (reanimated is web-
// stubbed) — slide-up sheet + backdrop fade, both directions. Scroll
// cooperation is unnecessary here, so PWInBottomSheetContext deliberately
// stays at its default (false) — PWScrollView et al. then render plain
// primitives instead of gorhom internals.
import React, {
    createRef,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react'
import {
    Animated,
    Easing,
    Modal,
    Pressable,
    useWindowDimensions,
} from 'react-native'
import type { NotifierRoot } from 'react-native-notifier'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { PWView } from '@components/core/PWView'
import { useStyles } from './styles.web'
import type { PWBottomSheetProps, PWBottomSheetSize } from './sheet-types'

// Same-shaped export as the native module (index.ts re-exports it); nothing
// on web renders through the notifier.
export const bottomSheetNotifier = createRef<Nullable<NotifierRoot>>()
export type { PWBottomSheetProps, PWBottomSheetSize }

// Mirrors SHEET_MAX_RATIO in the native PWBottomSheet.tsx.
const SHEET_MAX_RATIO = 0.96
const ANIMATION_MS = 250

// jsdom doesn't implement matchMedia; guard so tests don't crash.
const prefersReducedMotion = (): boolean =>
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches

export const PWBottomSheet = ({
    isVisible,
    onBackdropPress,
    onDismiss,
    innerContainerStyle,
    containerStyle,
    size = 'auto',
    testID,
    children,
    enableCloseOnBackdropPress = true,
    // snapPoints/enablePanDownToClose/enableContentPanningGesture/
    // autoCreateContainer are part of the shared props contract but
    // intentionally unused here: pan gestures don't exist on web and the
    // modal adapter always creates its own container.
}: PWBottomSheetProps): React.JSX.Element | null => {
    const { height } = useWindowDimensions()
    const maxHeight = Math.round(height * SHEET_MAX_RATIO)
    const styles = useStyles({ maxHeight, isFixed: size !== 'auto' })

    // Stays mounted while the exit animation plays; onDismiss (which the
    // store uses to remove the request) fires only once it completes.
    const [isRendered, setIsRendered] = useState(isVisible)
    const backdropOpacity = useRef(new Animated.Value(0)).current
    // Starts fully offscreen so a true-on-mount sheet still slides up.
    const translateY = useRef(new Animated.Value(maxHeight)).current

    const animate = useCallback(
        (toVisible: boolean, onDone?: () => void) => {
            const duration = prefersReducedMotion() ? 0 : ANIMATION_MS
            Animated.parallel([
                Animated.timing(backdropOpacity, {
                    toValue: toVisible ? 1 : 0,
                    duration,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: false,
                }),
                Animated.timing(translateY, {
                    toValue: toVisible ? 0 : maxHeight,
                    duration,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: false,
                }),
            ]).start(result => {
                // A rapid re-open interrupts this same call with
                // finished:false — skip onDone so it doesn't strand the
                // sheet mid-reopen by firing a stale onDismiss.
                if (result?.finished !== false) onDone?.()
            })
        },
        [backdropOpacity, translateY, maxHeight],
    )

    // Drives true→false and false→true transitions after mount. Mounting
    // directly with isVisible={false} must not fire onDismiss, so this only
    // reacts to an actual flip (guarded by the wasVisible ref).
    const wasVisible = useRef(isVisible)
    useEffect(() => {
        if (!wasVisible.current && isVisible) {
            setIsRendered(true)
            animate(true)
        } else if (wasVisible.current && !isVisible) {
            animate(false, () => {
                onDismiss?.()
                setIsRendered(false)
            })
        }
        wasVisible.current = isVisible
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVisible])

    // Initial mount with isVisible=true still needs the enter animation —
    // the effect above skips it because wasVisible already matches isVisible.
    useEffect(() => {
        if (isVisible) animate(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (!isRendered) return null

    const handleBackdropPress = (): void => {
        if (onBackdropPress) {
            onBackdropPress()
            return
        }
        if (enableCloseOnBackdropPress) onDismiss?.()
    }

    return (
        <Modal
            transparent
            visible
            animationType='none'
            onRequestClose={handleBackdropPress}
        >
            {/* Caps the sheet to the same width as AppShell's card on the
                expanded surface — see the `stage` style comment for why this
                wrapper is required. */}
            <PWView
                testID='pw-bottom-sheet-stage'
                style={styles.stage}
            >
                <Animated.View
                    style={[styles.backdrop, { opacity: backdropOpacity }]}
                >
                    <Pressable
                        style={styles.backdropPressable}
                        onPress={handleBackdropPress}
                        testID='pw-bottom-sheet-backdrop'
                    />
                </Animated.View>
                <Animated.View
                    style={[
                        styles.sheet,
                        containerStyle,
                        { transform: [{ translateY }] },
                    ]}
                >
                    <PWView
                        testID={testID}
                        style={[styles.inner, innerContainerStyle]}
                    >
                        {children}
                    </PWView>
                </Animated.View>
            </PWView>
        </Modal>
    )
}
