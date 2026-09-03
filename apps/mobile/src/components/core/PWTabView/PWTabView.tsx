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

import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import type { ParamListBase } from '@react-navigation/native'
import { makeStyles } from '@rneui/themed'
import { PWTabBar } from './PWTabBar'

const useStyles = makeStyles(() => ({
    navigator: {
        flex: 1,
    },
    scene: {
        flex: 1,
    },
}))

export const createPWTabNavigator = <ParamList extends ParamListBase>() => {
    const Tab = createMaterialTopTabNavigator<ParamList>()

    return {
        Navigator: ({
            tabBarHidden,
            screenOptions,
            ...props
        }: React.ComponentProps<typeof Tab.Navigator> & {
            children: React.ReactNode
            tabBarHidden?: boolean
        }) => {
            const styles = useStyles()

            return (
                <Tab.Navigator
                    tabBar={tabBarProps =>
                        tabBarHidden ? null : <PWTabBar {...tabBarProps} />
                    }
                    style={styles.navigator}
                    screenOptions={{
                        sceneStyle: styles.scene,
                        ...screenOptions,
                    }}
                    {...props}
                />
            )
        },
        Screen: Tab.Screen,
    }
}

export const PWTabView = {
    createNavigator: createPWTabNavigator,
}
