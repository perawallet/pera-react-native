*** Settings ***
Documentation       Account Overview / NFTs / History tabs, the notifications center, and on the funded
...                 testnet account real history rows and transaction detail.
Resource            send_receive.resource


*** Variables ***
${OVERVIEW_TAB}             accessibility_id=tab_overview
${NFTS_TAB}                 accessibility_id=tab_nfts
${HISTORY_TAB}              accessibility_id=tab_history
${HISTORY_EMPTY_TEXT}       No transactions found
${NFTS_EMPTY_TEXT}          Welcome to your NFT Gallery
${NOTIFICATIONS_ICON}       accessibility_id=notifications_icon
${INBOX_TAB}                accessibility_id=tab_inbox
${NOTIFICATIONS_TAB}        accessibility_id=tab_notifications
${TX_ROW_ANY}               xpath=//*[starts-with(@content-desc,'transaction_row_') or starts-with(@name,'transaction_row_')]
${NOTIFICATION_ROW_ANY}     xpath=//*[starts-with(@content-desc,'notification_row_') or starts-with(@name,'notification_row_')]
${ASA_INBOX_ITEM}           accessibility_id=asa_inbox_item
# Bare container testIDs: resource-id on Android, name on iOS.
${TX_DETAILS_SCREEN}        xpath=//*[@resource-id='transaction_details_screen' or @name='transaction_details_screen']
${TX_DETAIL_FEE}            xpath=//*[@resource-id='transaction_detail_fee' or @name='transaction_detail_fee']
${TX_DETAIL_EXPLORER}       accessibility_id=transaction_detail_explorer


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
