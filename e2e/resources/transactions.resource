*** Settings ***
Documentation       Account Overview / NFTs / History tabs, the notifications center, and on the funded
...                 testnet account real history rows and transaction detail.
Resource            send_receive.resource


*** Variables ***
${OVERVIEW_TAB}             xpath=//*[@resource-id='tab_overview' or @name='tab_overview' or @content-desc='tab_overview']
${NFTS_TAB}                 xpath=//*[@resource-id='tab_nfts' or @name='tab_nfts' or @content-desc='tab_nfts']
${HISTORY_TAB}              xpath=//*[@resource-id='tab_history' or @name='tab_history' or @content-desc='tab_history']
${HISTORY_EMPTY_TEXT}       No transactions found
${NFTS_EMPTY_TEXT}          Welcome to your NFT Gallery
${NOTIFICATIONS_ICON}       xpath=//*[@resource-id='notifications_icon' or @name='notifications_icon' or @content-desc='notifications_icon']
${INBOX_TAB}                xpath=//*[@resource-id='tab_inbox' or @name='tab_inbox' or @content-desc='tab_inbox']
${NOTIFICATIONS_TAB}        xpath=//*[@resource-id='tab_notifications' or @name='tab_notifications' or @content-desc='tab_notifications']
${TX_ROW_ANY}               xpath=//*[starts-with(@content-desc, 'transaction_row_') or starts-with(@resource-id, 'transaction_row_') or starts-with(@name,'transaction_row_')]
${NOTIFICATION_ROW_ANY}     xpath=//*[starts-with(@content-desc, 'notification_row_') or starts-with(@resource-id, 'notification_row_') or starts-with(@name,'notification_row_')]
${ASA_INBOX_ITEM}           xpath=//*[@resource-id='asa_inbox_item' or @name='asa_inbox_item' or @content-desc='asa_inbox_item']
# Bare container testIDs: resource-id on Android, name on iOS.
${TX_DETAILS_SCREEN}        xpath=//*[@resource-id='transaction_details_screen' or @name='transaction_details_screen']
${TX_DETAIL_FEE}            xpath=//*[@resource-id='transaction_detail_fee' or @name='transaction_detail_fee']
${TX_DETAIL_EXPLORER}       xpath=//*[@resource-id='transaction_detail_explorer' or @name='transaction_detail_explorer' or @content-desc='transaction_detail_explorer']


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
