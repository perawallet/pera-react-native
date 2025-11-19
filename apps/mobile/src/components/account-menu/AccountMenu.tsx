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

import { Tab, TabView } from '@rneui/themed'
import { WalletAccount } from '@perawallet/core'

import { useStyles } from './styles'
import PortfolioView from '../portfolio/portfolio-view/PortfolioView'
import PWView from '../common/view/PWView'
import { useEffect, useState } from 'react'
import InboxTab from './InboxTab'
import AccountsTab from './AccountsTab'

type AccountMenuProps = {
    onSelected: (account: WalletAccount) => void
    showInbox?: boolean
}
const AccountMenu = (props: AccountMenuProps) => {
    const [index, setIndex] = useState(0)
    const styles = useStyles()

    useEffect(() => {
        if (!props.showInbox) {
            setIndex(0)
        }
    }, [props.showInbox])

    return (
        <PWView style={styles.container}>
            <PortfolioView style={styles.portfolioContainer} />
            <Tab
                value={index}
                onChange={e => setIndex(e)}
                disableIndicator
                containerStyle={styles.tabs}
                dense
            >
                {!!props.showInbox && (
                    <Tab.Item
                        title='Accounts'
                        titleStyle={() =>
                            index === 0
                                ? styles.activeTitle
                                : styles.inactiveTitle
                        }
                    />
                )}
                {!!props.showInbox && (
                    <Tab.Item
                        title='Inbox'
                        titleStyle={() =>
                            index === 1
                                ? styles.activeTitle
                                : styles.inactiveTitle
                        }
                    />
                )}
            </Tab>
            <TabView
                value={index}
                onChange={setIndex}
                animationType='spring'
            >
                <TabView.Item style={styles.fullWidth}>
                    <AccountsTab onSelected={props.onSelected} />
                </TabView.Item>
                <TabView.Item style={styles.fullWidth}>
                    <InboxTab />
                </TabView.Item>
            </TabView>
        </PWView>
    )
}

export default AccountMenu
