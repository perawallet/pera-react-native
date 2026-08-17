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

import { type IconName, PWIcon } from '@components/core/PWIcon'
import { PWText } from '@components/core/PWText'
import { PWTouchableOpacity } from '@components/core/PWTouchableOpacity'
import { PWView } from '@components/core/PWView'
import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, View, useWindowDimensions } from 'react-native'
import { useTheme } from '@rneui/themed'
import { useIsLockOverlayVisible } from '@hooks/useIsLockOverlayVisible'
import { DROPDOWN_MIN_WIDTH, useStyles } from './styles'

export type PWDropdownItem = {
    label: string
    icon?: IconName
    onPress: () => void
    variant?: 'default' | 'destructive'
    isSelected?: boolean
}

export type PWDropdownProps = {
    children: React.ReactNode
    items: PWDropdownItem[]
    align?: 'left' | 'right'
}

export const PWDropdown = ({
    children,
    items,
    align = 'right',
}: PWDropdownProps) => {
    const { width: windowWidth } = useWindowDimensions()
    const { theme } = useTheme()
    const styles = useStyles({ windowWidth })
    const [visible, setVisible] = useState(false)
    const [position, setPosition] = useState<{
        top: number
        left?: number
        right?: number
    }>({ top: 0 })
    const triggerContainerRef = useRef<View>(null)
    const isLockOverlayVisible = useIsLockOverlayVisible()

    // A native Modal is its own OS window, so it keeps painting above the lock
    // screen: AutoLockGuard only hides its children with `display: none`, which
    // never reaches here. Drop the menu rather than restoring it after the PIN —
    // `position` was measured before the app went away and can be stale.
    useEffect(() => {
        if (isLockOverlayVisible) {
            setVisible(false)
        }
    }, [isLockOverlayVisible])

    const handleOpen = () => {
        const view = triggerContainerRef.current
        if (!view) return

        if (view.measure) {
            view.measure((_x, _y, _width, height, pageX, pageY) => {
                const horizontalInset = theme.spacing.xl
                const top = pageY + height

                if (align === 'right') {
                    setPosition({
                        top,
                        right: horizontalInset,
                    })
                } else {
                    const left = Math.max(
                        horizontalInset,
                        Math.min(
                            pageX,
                            windowWidth - horizontalInset - DROPDOWN_MIN_WIDTH,
                        ),
                    )
                    setPosition({
                        top,
                        left,
                    })
                }
                setVisible(true)
            })
        } else {
            // Fallback for environments where measure is not available (e.g. tests)
            setVisible(true)
        }
    }

    const handleClose = () => {
        setVisible(false)
    }

    const handleSelect = (item: PWDropdownItem) => {
        setVisible(false)
        item.onPress()
    }

    return (
        <>
            <View
                ref={triggerContainerRef}
                collapsable={false}
            >
                <PWTouchableOpacity onPress={handleOpen}>
                    {children}
                </PWTouchableOpacity>
            </View>

            <Modal
                transparent
                // Not just the effect above: `measure` resolves a frame after
                // the tap, so a guard that goes up in between would land a
                // `setVisible(true)` the effect has already run past.
                visible={visible && !isLockOverlayVisible}
                onRequestClose={handleClose}
                animationType='fade'
            >
                <Pressable
                    onPress={handleClose}
                    style={styles.modalOverlay}
                >
                    <Pressable
                        style={[styles.dropdown, position]}
                        onPress={e => e.stopPropagation()}
                    >
                        {items.map((item, index) => (
                            <PWTouchableOpacity
                                key={index}
                                style={styles.item}
                                onPress={() => handleSelect(item)}
                            >
                                {item.icon && (
                                    <PWIcon
                                        name={item.icon}
                                        size='sm'
                                        variant={
                                            item.variant === 'destructive'
                                                ? 'error'
                                                : 'primary'
                                        }
                                    />
                                )}
                                <PWView style={styles.labelContainer}>
                                    <PWText
                                        variant='h4'
                                        truncate
                                        style={
                                            item.variant === 'destructive'
                                                ? styles.labelDestructive
                                                : styles.label
                                        }
                                    >
                                        {item.label}
                                    </PWText>
                                </PWView>
                                {item.isSelected && (
                                    <PWIcon
                                        name='check'
                                        size='sm'
                                        variant='primary'
                                    />
                                )}
                            </PWTouchableOpacity>
                        ))}
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    )
}
