import { type ScrollView } from 'react-native'
import type { FlatList } from 'react-native'
import { Pressable, StyleSheet } from 'react-native'
import { PWText, PWView } from '@components/core'

export type Refs = { s: ScrollView; f: FlatList }
export const Good = () => (
    <PWView>
        <PWText>hi</PWText>
        <Pressable style={StyleSheet.absoluteFill} />
    </PWView>
)
