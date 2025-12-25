import PWIcon from "@components/icons/PWIcon";
import PWTouchableOpacity from "@components/touchable-opacity/PWTouchableOpacity";
import React, { PropsWithChildren, useState } from "react";
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle, LayoutChangeEvent, GestureResponderEvent } from "react-native";
import Animated, {
    Layout,
    FadeIn,
    FadeOut,
    useSharedValue,
    useDerivedValue,
    withTiming,
    useAnimatedStyle,
} from "react-native-reanimated";
import { useStyles } from "./styles";
import PWView from "@components/view/PWView";

type ExpandablePanelProps = {
    title: React.ReactNode
    iconPressed?: () => void
    containerStyle?: StyleProp<ViewStyle>
} & PropsWithChildren

export const CollapsableContainer = ({
    children,
    expanded,
}: {
    children: React.ReactNode;
    expanded: boolean;
}) => {
    const [height, setHeight] = useState(0);
    const animatedHeight = useSharedValue(0);

    const onLayout = (event: LayoutChangeEvent) => {
        const onLayoutHeight = event.nativeEvent.layout.height;

        if (onLayoutHeight > 0 && height !== onLayoutHeight) {
            setHeight(onLayoutHeight);
        }
    };

    const collapsableStyle = useAnimatedStyle(() => {
        animatedHeight.value = expanded ? withTiming(height) : withTiming(0);

        return {
            height: animatedHeight.value,
        };
    }, [expanded, height]);

    return (
        <Animated.View style={[collapsableStyle, { overflow: "hidden" }]}>
            <View style={{ position: "absolute" }} onLayout={onLayout}>
                {children}
            </View>
        </Animated.View>
    );
};

export const ExpandablePanel = ({
    title,
    containerStyle,
    children,
    iconPressed,
}: ExpandablePanelProps) => {
    const [expanded, setExpanded] = useState(false);
    const styles = useStyles();
    const onPress = () => {
        setExpanded(!expanded);
    };

    const iconStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: withTiming(expanded ? '90deg' : '0deg') }],
        };
    }, [expanded]);

    const handleIconPress = (event: GestureResponderEvent) => {
        if (iconPressed) {
            iconPressed();
            event.stopPropagation();
        }
    };

    return (
        <PWView
            style={containerStyle}>
            <PWTouchableOpacity onPress={onPress} style={styles.header}>
                {title}
                <Animated.View style={iconStyle}>
                    <PWIcon name='chevron-right' size='sm' onPress={handleIconPress} />
                </Animated.View>
            </PWTouchableOpacity>
            <CollapsableContainer expanded={expanded}>
                {children}
            </CollapsableContainer>
        </PWView>
    );
};