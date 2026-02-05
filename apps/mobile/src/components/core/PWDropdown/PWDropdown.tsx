import { IconName, PWIcon } from '@components/core/PWIcon'
import { PWText } from '@components/core/PWText'
import { PWTouchableOpacity } from '@components/core/PWTouchableOpacity'
import { useRef, useState } from 'react'
import { Modal, Pressable, View, Dimensions } from 'react-native'
import { useStyles } from './styles'

export type PWDropdownItem = {
    label: string
    icon?: IconName
    onPress: () => void
    variant?: 'default' | 'destructive'
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
    const styles = useStyles()
    const [visible, setVisible] = useState(false)
    const [position, setPosition] = useState<{
        top: number
        left?: number
        right?: number
    }>({ top: 0 })
    const triggerContainerRef = useRef<View>(null)

    const handleOpen = () => {
        const view = triggerContainerRef.current
        if (!view) return

        if (view.measure) {
            view.measure((_x, _y, width, height, pageX, pageY) => {
                const windowWidth = Dimensions.get('window').width
                const top = pageY + height

                if (align === 'right') {
                    setPosition({
                        top,
                        right: windowWidth - (pageX + width),
                    })
                } else {
                    setPosition({
                        top,
                        left: pageX,
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
                visible={visible}
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
                                <PWText
                                    variant='h4'
                                    style={
                                        item.variant === 'destructive'
                                            ? styles.labelDestructive
                                            : styles.label
                                    }
                                >
                                    {item.label}
                                </PWText>
                            </PWTouchableOpacity>
                        ))}
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    )
}
