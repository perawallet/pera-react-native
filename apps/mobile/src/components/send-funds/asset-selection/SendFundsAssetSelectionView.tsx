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

import { Skeleton } from '@rneui/themed';
import PWView from '../../common/view/PWView';
import {
  AccountDetailAssetSerializerResponse,
  PeraAsset,
  useAccountBalances,
  useSelectedAccount,
} from '@perawallet/core';
import { useCallback, useContext, useMemo } from 'react';
import AccountAssetItemView from '../../assets/asset-item/AccountAssetItemView';
import PWTouchableOpacity from '../../common/touchable-opacity/PWTouchableOpacity';
import { useStyles } from './styles';
import Decimal from 'decimal.js';
import { SendFundsContext } from '../../../providers/SendFundsProvider';
import SendFundsTitlePanel from '../title-panel/SendFundsTitlePanel';

type SendFundsAssetSelectionViewProps = {
  onSelected: () => void;
  onBack: () => void;
};

const LoadingView = () => {
  const styles = useStyles();
  return (
    <PWView style={styles.loadingContainer}>
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </PWView>
  );
};

const SendFundsAssetSelectionView = ({
  onSelected,
  onBack,
}: SendFundsAssetSelectionViewProps) => {
  const styles = useStyles();
  const selectedAccount = useSelectedAccount();
  const { setSelectedAsset } = useContext(SendFundsContext);
  const { data, loading } = useAccountBalances(
    selectedAccount ? [selectedAccount] : [],
  );

  const handleSelected = useCallback(
    (item: PeraAsset) => {
      setSelectedAsset(item);
      onSelected();
    },
    [onSelected, setSelectedAsset],
  );

  const balanceData = useMemo(() => data.at(0)?.accountInfo?.results, [data]);
  const renderItem = useCallback(
    (item: AccountDetailAssetSerializerResponse) => {
      return (
        <PWTouchableOpacity
          onPress={() => handleSelected(item)}
          key={`asset-${item.asset_id}`}
          style={styles.item}
        >
          <AccountAssetItemView
            asset={item}
            amount={item.amount ? Decimal(item.amount) : undefined}
            localAmount={
              item.balance_usd_value
                ? Decimal(item.balance_usd_value)
                : undefined
            }
          />
        </PWTouchableOpacity>
      );
    },
    [handleSelected, styles],
  );

  return (
    <PWView style={styles.container}>
      <SendFundsTitlePanel handleBack={onBack} screenState="select-asset" />
      {loading && <LoadingView />}
      {!loading && balanceData?.map(b => renderItem(b))}
    </PWView>
  );
};

export default SendFundsAssetSelectionView;
