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

import { makeStyles } from '@rneui/themed';
import { MainScreenLayoutPropsWithInsets } from './MainScreenLayout';

export const useStyles = makeStyles(
  (theme, props: MainScreenLayoutPropsWithInsets) => {
    const { insets, fullScreen } = props;
    return {
      mainContainer: {
        flex: 1,
        backgroundColor: theme.colors.background,
        padding: 0,
      },
      testnetContainer: {
        backgroundColor: theme.colors.primary,
        height: theme.spacing.lg * 2,
      },
      backContainer: {
        paddingVertical: theme.spacing.sm,
      },
      title: {
        marginVertical: theme.spacing.lg,
      },
      contentContainer: {
        flex: 1,
        paddingLeft: fullScreen ? 0 : insets.left + theme.spacing.xl,
        paddingRight: fullScreen ? 0 : insets.right + theme.spacing.xl,
        paddingTop: theme.spacing.xl,
        paddingBottom: fullScreen ? 0 : insets.bottom + theme.spacing.xl,
      },
    };
  },
);
