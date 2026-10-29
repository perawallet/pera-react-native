*** Settings ***
Documentation       Account Overview / NFTs / History tabs, the notifications center, and on the funded
...                 testnet account real history rows and transaction detail.
Resource            send_receive.resource


*** Variables ***
${OVERVIEW_TAB}             tid=tab_overview
${NFTS_TAB}                 tid=tab_nfts
${HISTORY_TAB}              tid=tab_history
${HISTORY_EMPTY_TEXT}       No transactions found
${NFTS_EMPTY_TEXT}          Welcome to your NFT Gallery
${NOTIFICATIONS_ICON}       tid=notifications_icon
${INBOX_TAB}                tid=tab_inbox
${NOTIFICATIONS_TAB}        tid=tab_notifications
${TX_ROW_ANY}               xpath=//*[starts-with(@content-desc, 'transaction_row_') or starts-with(@resource-id, 'transaction_row_') or starts-with(@name,'transaction_row_')]
${NOTIFICATION_ROW_ANY}     xpath=//*[starts-with(@content-desc, 'notification_row_') or starts-with(@resource-id, 'notification_row_') or starts-with(@name,'notification_row_')]
${ASA_INBOX_ITEM}           tid=asa_inbox_item
${INBOX_EMPTY_STATE}        tid=inbox_empty_state
# Bare container testIDs: resource-id on Android, name on iOS.
${TX_DETAILS_SCREEN}        tid=transaction_details_screen
${TX_DETAIL_FEE}            tid=transaction_detail_fee
${TX_DETAIL_EXPLORER}       tid=transaction_detail_explorer


*** Keywords ***
Open History
    Wait Until Settled    ${HISTORY_TAB}
    Tap    ${HISTORY_TAB}

Open Notifications Center
    Wait Until Settled    ${NOTIFICATIONS_ICON}
    Tap    ${NOTIFICATIONS_ICON}
    Wait Until Page Contains Element    ${INBOX_TAB}    timeout=20s
    Page Should Contain Element    ${NOTIFICATIONS_TAB}

Open First Transaction
    Open History
    Wait Until Page Contains Element    ${TX_ROW_ANY}    timeout=45s
    Tap    ${TX_ROW_ANY}
    Wait Until Page Contains Element    ${TX_DETAILS_SCREEN}    timeout=20s
