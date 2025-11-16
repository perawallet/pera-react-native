import PWTouchableOpacity from '../../common/touchable-opacity/PWTouchableOpacity';
import AccountAssetItemView from '../../assets/asset-item/AccountAssetItemView';
import PWView from '../../common/view/PWView';
import { PeraAsset, useAccountBalances, WalletAccount } from '@perawallet/core';
import Decimal from 'decimal.js';
import { useMemo } from 'react';
import { useStyles } from './styles';
import { Skeleton, Text } from '@rneui/themed';

import ManageIcon from '../../../../assets/icons/sliders.svg';
import PlusIcon from '../../../../assets/icons/plus.svg';
import SearchInput from '../../common/search-input/SearchInput';

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
            <ManageIcon style={styles.manageButton} />
          </PWTouchableOpacity>
          <PWTouchableOpacity style={styles.addButtonContainer}>
            <PlusIcon style={styles.addButton} />
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
