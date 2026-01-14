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

import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => {
    return {
        container: {
            flex: 1,
            margin: 0,
            padding: 0,
        },
        camera: {
            flex: 1,
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
        },
        overlay: {
            alignItems: 'center',
            zIndex: 1,
            position: 'absolute',
            top: -100,
            bottom: 0,
            left: 0,
            right: 0,
        },
        title: {
            color: theme.colors.textWhite,
            textAlign: 'center',
            marginTop: theme.spacing.xxl,
            marginBottom: theme.spacing.xl,
            zIndex: 2,
        },
        icon: {
            color: theme.colors.textWhite,
            marginTop: theme.spacing.xxl,
            marginLeft: theme.spacing.xl,
            zIndex: 2,
        },
        emptyView: {
            flex: 1,
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: theme.colors.backdrop,
        },
    }
})
