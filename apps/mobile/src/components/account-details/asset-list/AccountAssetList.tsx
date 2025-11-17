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

import PWTouchableOpacity from '../../common/touchable-opacity/PWTouchableOpacity';
import AccountAssetItemView from '../../assets/asset-item/AccountAssetItemView';
import PWView from '../../common/view/PWView';
import { PeraAsset, useAccountBalances, WalletAccount } from '@perawallet/core';
import Decimal from 'decimal.js';
import { useMemo } from 'react';
import { useStyles } from './styles';
import { Skeleton, Text } from '@rneui/themed';

import SearchInput from '../../common/search-input/SearchInput';
import PWIcon from '../../common/icons/PWIcon';

type AccountAssetListProps = {
  account: WalletAccount;
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

const AccountAssetList = ({ account }: AccountAssetListProps) => {
  const styles = useStyles();
  const { data, loading } = useAccountBalances([account]);
  const balanceData = useMemo(() => data.at(0)?.accountInfo?.results, [data]);

  const renderItem = (item: PeraAsset) => {
    return (
      <PWTouchableOpacity onPress={() => {}} key={`asset-key-${item.asset_id}`}>
        <AccountAssetItemView
          asset={item}
          amount={item.amount ? Decimal(item.amount) : undefined}
          usdAmount={
            item.balance_usd_value ? Decimal(item.balance_usd_value) : undefined
          }
        />
      </PWTouchableOpacity>
    );
  };

  return (
    <PWView style={styles.container}>
      <PWView style={styles.titleBar}>
        <Text style={styles.title}>Assets</Text>
        <PWView style={styles.titleBarButtonContainer}>
          <PWTouchableOpacity style={styles.manageButtonContainer}>
            <PWIcon variant="helper" name="sliders" />
          </PWTouchableOpacity>
          <PWTouchableOpacity style={styles.addButtonContainer}>
            <PWIcon variant="helper" name="plus" />
            <Text style={styles.addButtonTitle}>Add Asset</Text>
          </PWTouchableOpacity>
        </PWView>
      </PWView>
      {loading && <LoadingView />}
      {!loading && (
        <>
          <SearchInput placeholder="Search assets" />
          <PWView style={styles.listContainer}>
            {balanceData?.map(item => renderItem(item))}
          </PWView>
        </>
      )}
    </PWView>
  );
};

export default AccountAssetList;
