import EmptyView from '../../common/empty-view/EmptyView';
import { WalletAccount } from '@perawallet/core';

type AccountNftsProps = {
  account: WalletAccount;
};

//TODO implement
const AccountNfts = (_: AccountNftsProps) => {
  return (
    <EmptyView
      title="Not Implemented"
      body="This part of the app hasn't been implemented yet"
    />
  );
};

export default AccountNfts;
