import { NativeStackNavigationOptions } from "@react-navigation/native-stack"

export const CHART_FOCUS_DEBOUNCE_TIME = 200
export const CHART_HEIGHT = 140
export const CHART_ANIMATION_DURATION = 200

export const TAB_ANIMATION_DURATION = 200
export const TAB_ANIMATION_CONFIG = {
    duration: TAB_ANIMATION_DURATION,
    useNativeDriver: true,
}

export const SCREEN_ANIMATION_TYPE = 'default'
export const SCREEN_ANIMATION_DURATION = 150
export const SCREEN_ANIMATION_CONFIG: NativeStackNavigationOptions = {
    animation: SCREEN_ANIMATION_TYPE,
    animationDuration: SCREEN_ANIMATION_DURATION,
    statusBarAnimation: 'slide',
}