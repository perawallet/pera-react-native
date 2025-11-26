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

import { StyleSheet } from 'react-native'
import { useTheme } from '@rneui/themed'

export const useStyles = () => {
    const { theme } = useTheme()
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        contentContainer: {
            paddingTop: theme.spacing.md,
            paddingHorizontal: theme.spacing.xl,
            paddingBottom: theme.spacing.xl,
        },
        header: {
            paddingVertical: theme.spacing.md,
        },
        assetRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.sm,
        },
        headerIcons: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
        },

        chartContainer: {
            marginTop: theme.spacing.xl,
            marginBottom: theme.spacing.xl,
        },
        discoverButton: {
            backgroundColor: theme.colors.layerGrayLighter,
            borderRadius: theme.spacing.sm,
            padding: theme.spacing.md,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.xl,
        },
        discoverText: {
            color: theme.colors.textGray,
        },
        discoverLink: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        discoverLinkText: {
            marginRight: theme.spacing.xs,
        },
        sectionTitle: {
            color: theme.colors.textGray,
            marginTop: theme.spacing.xl,
            marginBottom: theme.spacing.md,
            textTransform: 'uppercase',
        },
        tagsContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.xl,
        },
        tag: {
            backgroundColor: theme.colors.layerGrayLighter,
            borderRadius: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
            flexDirection: 'row',
            alignItems: 'center',
        },
        tagText: {
            fontSize: 12,
            fontWeight: '500',
            color: theme.colors.textMain,
            marginLeft: theme.spacing.xs,
        },
        loadingContainer: {
            padding: theme.spacing.xl,
            gap: theme.spacing.md,
        },
        skeleton: {
            height: theme.spacing.xl * 6,
            width: '100%',
        },
        trendContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
    })
}
