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

import { Fragment, useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'

import { PWScreen, PWText } from '@components/core'

import { useGalleryCategoryScreen } from './useGalleryCategoryScreen'
import { GalleryItemRow } from './GalleryItemRow'
import { useStyles } from './styles'

import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ParamListBase } from '@react-navigation/native'

export const GalleryCategoryScreen = () => {
    const styles = useStyles()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { title, sections, onItemPress } = useGalleryCategoryScreen()

    useEffect(() => {
        navigation.setOptions({ title })
    }, [navigation, title])

    return (
        <PWScreen testID='gallery_category_screen'>
            {sections.map(section => (
                <Fragment key={section.title}>
                    <PWText
                        variant='bodySemibold'
                        style={styles.sectionHeader}
                    >
                        {section.title}
                    </PWText>
                    {section.items.map(item => (
                        <GalleryItemRow
                            key={item.id}
                            item={item}
                            onPress={onItemPress}
                        />
                    ))}
                </Fragment>
            ))}
        </PWScreen>
    )
}
