import EmptyView from '../../common/empty-view/EmptyView';
import { WalletAccount } from '@perawallet/core';

type AccountHistoryProps = {
  account: WalletAccount;
};

//TODO implement
const AccountHistory = ({ account }: AccountHistoryProps) => {
  return (
    <EmptyView
      title="Not Implemented"
      body="This part of the app hasn't been implemented yet"
    />
  );
};

export default AccountHistory;
