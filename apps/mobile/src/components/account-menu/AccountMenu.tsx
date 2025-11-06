import { Tab, TabView, useTheme } from '@rneui/themed';
import {
  AccountWealthHistoryItem,
  WalletAccount,
} from '@perawallet/core';

import { useStyles } from './styles';
import PortfolioView from '../portfolio/portfolio-view/PortfolioView';
import PeraView from '../common/view/PeraView';
import { useEffect, useState } from 'react';
import InboxTab from './InboxTab';
import AccountsTab from './AccountsTab';

type AccountMenuProps = {
  onSelected: (account: WalletAccount) => void,
  showInbox?: boolean
}
const AccountMenu = (props: AccountMenuProps) => {
  const [index, setIndex] = useState(0);
  const styles = useStyles();
  const [scrollingEnabled, setScrollingEnabled] = useState(true);

  const updateDataSelection = (data: AccountWealthHistoryItem | null) => {
    setScrollingEnabled(data === null);
  }

  useEffect(() => {
    if (!props.showInbox) {
      setIndex(0)
    }
  }, [props.showInbox])

  return (
    <PeraView
        style={styles.container}>
      <PortfolioView onDataSelected={updateDataSelection} style={styles.portfolioContainer} />
      <Tab
        value={index}
        onChange={(e) => setIndex(e)}
        disableIndicator
        containerStyle={styles.tabs}
        dense>
      {!!props.showInbox && <Tab.Item
        title="Accounts"
        titleStyle={() => index === 0 ? styles.activeTitle : styles.inactiveTitle}
      />}
      {!!props.showInbox && <Tab.Item
        title="Inbox"
        titleStyle={() => index === 1 ? styles.activeTitle : styles.inactiveTitle}
      />}
      </Tab>
      <TabView value={index} onChange={setIndex} animationType="spring">
      <TabView.Item style={styles.fullWidth}>
        <AccountsTab onSelected={props.onSelected} />
      </TabView.Item>
      <TabView.Item style={{ backgroundColor: 'blue', width: '100%' }}>
        <InboxTab />
      </TabView.Item>
      </TabView>
      
    </PeraView>
  );
};

export default AccountMenu;
