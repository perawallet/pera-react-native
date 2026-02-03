import {
    MaterialTopTabBar,
    MaterialTopTabBarProps,
} from '@react-navigation/material-top-tabs'
import { useStyles } from './tabBarStyles'

export type PWTabBarProps = MaterialTopTabBarProps

export const PWTabBar = (props: PWTabBarProps) => {
    const styles = useStyles()
    const focusedRouteKey = props.state.routes[props.state.index].key
    const focusedOptions = props.descriptors[focusedRouteKey].options

    return (
        <MaterialTopTabBar
            {...(props as any)}
            style={[styles.container, focusedOptions.tabBarStyle]}
            indicatorStyle={[styles.indicator, focusedOptions.tabBarIndicatorStyle]}
            activeTintColor={styles.activeTitle.color}
            inactiveTintColor={styles.inactiveTitle.color}
            labelStyle={[styles.title, focusedOptions.tabBarLabelStyle]}
        />
    )
}
