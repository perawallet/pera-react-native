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

import AssetIcon from '../../common/asset-icon/AssetIcon';
import CurrencyDisplay from '../../common/currency-display/CurrencyDisplay';
import PWView, { PWViewProps } from '../../common/view/PWView';
import {
  ALGO_ASSET_ID,
  PeraAsset,
  useCurrencyConverter,
} from '@perawallet/core';
import { Text, useTheme } from '@rneui/themed';
import Decimal from 'decimal.js';
import { useStyles } from './styles';
import { useMemo } from 'react';

import TrustedIcon from '../../../../assets/icons/assets/trusted.svg';
import VerifiedIcon from '../../../../assets/icons/assets/verified.svg';
import SuspiciousIcon from '../../../../assets/icons/assets/suspicious.svg';

type AccountAssetItemViewProps = {
  asset: PeraAsset;
  amount?: Decimal;
  usdAmount?: Decimal;
  iconSize?: number;
} & PWViewProps;

const AccountAssetItemView = ({
  asset,
  amount,
  usdAmount,
  iconSize,
  ...rest
}: AccountAssetItemViewProps) => {
  const { theme } = useTheme();
  const styles = useStyles();

  const { preferredCurrency, convertUSDToPreferredCurrency } =
    useCurrencyConverter();

  const verificationIcon = useMemo(() => {
    if (asset.asset_id === ALGO_ASSET_ID) {
      return <TrustedIcon width={theme.spacing.md} height={theme.spacing.md} />;
    }
    if (asset.verification_tier === 'verified') {
      return (
        <VerifiedIcon width={theme.spacing.md} height={theme.spacing.md} />
      );
    }
    if (asset.verification_tier === 'suspicious') {
      return (
        <SuspiciousIcon width={theme.spacing.md} height={theme.spacing.md} />
      );
    }
    return undefined;
  }, [asset, theme.spacing.md]);

  return (
    <PWView {...rest} style={[styles.container, rest.style]}>
      <AssetIcon asset={asset} size={iconSize ?? theme.spacing.xl * 1.5} />
      <PWView style={styles.dataContainer}>
        <PWView style={styles.unitContainer}>
          <PWView style={styles.row}>
            <Text style={styles.primaryUnit}>{asset.name}</Text>
            {verificationIcon}
          </PWView>
          <Text style={styles.secondaryUnit}>
            {asset.unit_name}
            {asset.asset_id !== ALGO_ASSET_ID && ` - ${asset.asset_id}`}
          </Text>
        </PWView>
        <PWView style={styles.amountContainer}>
          <CurrencyDisplay
            currency={asset.unit_name}
            value={amount ?? Decimal(0)}
            precision={6}
            showSymbol
            style={styles.primaryAmount}
          />
          <CurrencyDisplay
            currency={preferredCurrency}
            value={convertUSDToPreferredCurrency(usdAmount ?? Decimal(0))}
            precision={6}
            showSymbol
            style={styles.secondaryAmount}
          />
        </PWView>
      </PWView>
    </PWView>
  );
};

export default AccountAssetItemView;
