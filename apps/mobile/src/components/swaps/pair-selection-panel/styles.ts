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

export const useStyles = makeStyles(theme => ({
  container: {
    paddingHorizontal: theme.spacing.sm,
    marginTop: theme.spacing.xl
  },
  fromContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md
  },
  toContainer: {
    backgroundColor: theme.colors.layerGrayLighter,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    borderRadius: theme.spacing.md,
    gap: theme.spacing.md
  },
  floatButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  floatButton: {
    position: 'absolute',
    top: -16,
    height: 32,
    width: 40,
    left: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.layerGrayLighter,
    boxShadow: '0px 0px 0px 1px #0000000D',
    zIndex: 1,
    textAlign: 'center',
    verticalAlign: 'middle',
    color: theme.colors.helperPositive,
    alignItems: 'center',
    justifyContent: 'center'
  },
  floatSplitButton: {
    position: 'absolute',
    top: -16,
    height: 32,
    width: 90,
    right: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.layerGrayLighter,
    boxShadow: '0px 0px 0px 1px #0000000D',
    zIndex: 1,
    textAlign: 'center',
    verticalAlign: 'middle',
    color: theme.colors.helperPositive,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs
  },
  floatSplitButtonItem: {},
  floatSplitDivider: {
    margin: theme.spacing.xs
  },
  floatButtonText: {
    color: theme.colors.helperPositive,
    fontWeight: '700',
    fontSize: 11
  },
  inputAmountsContainer: {
    flexGrow: 1
  },
  inputContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between'
  },
  titleBalanceContainer: {
    flexDirection: 'row',
    gap: theme.spacing.xs
  },
  titleText: {
    color: theme.colors.textGray
  },
  titleCurrency: {
    color: theme.colors.textGray,
    flexShrink: 1
  },
  primaryInput: {
    color: theme.colors.textGray,
    backgroundColor: theme.colors.background,
    fontFamily: 'DMSans-Medium',
    fontWeight: '500',
    fontSize: 25,
    padding: 0,
    margin: 0,
    top: 0,
    height: 48
  },
  primaryAmountText: {
    color: theme.colors.textGray
  },
  secondaryAmountText: {
    color: theme.colors.textGray
  }
}));
