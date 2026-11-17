*** Settings ***
Documentation       Pera Card: the intro offered from Add Account, the sign-in form, the first sign-up
...                 step, and the dashboard of a card already connected on the device. The suite has no
...                 card account of its own, since one needs KYC and a card backend session.
Resource            accounts.resource


*** Variables ***
${E2E_EXPECT_CARD}                  ${False}
${ADD_ACCOUNT_PERA_CARD_BUTTON}     tid=add_account_pera_card_button
${CARD_INTRO_CREATE_BUTTON}         tid=pera_card_intro_create_button
${CARD_INTRO_LOGIN_BUTTON}          tid=pera_card_intro_login_button
${CARD_INTRO_LEARN_MORE}            tid=pera_card_intro_learn_more
# Screen containers carry a bare testID: resource-id on Android, name on iOS.
${CARD_SIGN_IN_SCREEN}              tid=card-sign-in
${CARD_SIGN_IN_EMAIL_INPUT}         tid=card-sign-in-email-input
${CARD_SIGN_IN_PASSWORD_INPUT}      tid=card-sign-in-password-input
${CARD_SIGN_IN_SUBMIT}              tid=card-sign-in-submit
${CARD_SIGN_IN_FORGOT_PASSWORD}     tid=card-sign-in-forgot-password
${CARD_FORGOT_PASSWORD_SCREEN}      tid=card-forgot-password
${CARD_FORGOT_PASSWORD_EMAIL}       tid=card-forgot-password-email-input
${CARD_FORGOT_PASSWORD_SUBMIT}      tid=card-forgot-password-submit
${CARD_ONBOARDING_EMAIL_INPUT}      tid=card-onboarding-email-input
${CARD_ONBOARDING_COUNTRY_FIELD}    tid=card-onboarding-country-field
${CARD_ONBOARDING_EMAIL_CONFIRM}    tid=card-onboarding-email-confirm
# A region on the card waitlist gets this button in place of Confirm.
${CARD_ONBOARDING_WAITLIST_JOIN}    tid=card-onboarding-waitlist-join
# The form settles on one of the two once the region's country is preselected.
${CARD_ONBOARDING_CONFIRM_OR_JOIN}  xpath=//*[@name='card-onboarding-email-confirm' or @resource-id='card-onboarding-email-confirm' or @content-desc='card-onboarding-email-confirm' or @name='card-onboarding-waitlist-join' or @resource-id='card-onboarding-waitlist-join' or @content-desc='card-onboarding-waitlist-join']
# The country picker is a searchable sheet with no testID of its own.
${CARD_COUNTRY_SEARCH_INPUT}        tid=searchable-list-search-input

${CARD_CONNECTED_ROW}               tid=pera_card_connected_row
${CARD_DASHBOARD_SCREEN}            tid=pera_card_account_screen
# A tab takes tab_<route name>, lower-cased.
${CARD_DETAILS_TAB}                 tid=tab_carddetails
${CARD_ADD_FUNDS_BUTTON}            tid=pera_card_add_funds_button
${CARD_WITHDRAW_BUTTON}             tid=pera_card_withdraw_button
# An auto-funding card shows this one button in place of the two above.
${CARD_FUND_LINKED_BUTTON}          tid=pera_card_fund_linked_account_button
${CARD_SHOW_ALL_TRANSACTIONS}       tid=pera_card_show_all_transactions
${CARD_TRANSACTIONS_SCREEN}         tid=card_transactions_screen
${CARD_REWARDS_ROW}                 tid=pera_card_rewards_row
${CARD_WALLET_BALANCE_AMOUNT}       tid=card-wallet-balance-amount
${CARD_FUNDING_ACCOUNT_ROW}         tid=pera_card_funding_account_row
${CARD_ACCOUNTS_DETAILS_ROW}        tid=pera_card_accounts_details_row
${CARD_REPORT_LOST_ROW}             tid=pera_card_report_lost_row
${CARD_ACCOUNT_DETAILS_SHEET}       tid=card_account_details_sheet
${CARD_REVEAL_BUTTON}               tid=pera_card_reveal_button
# Every state a card that cannot be revealed yet is in (pending, issuing, failed, rejected, under review).
${CARD_ISSUANCE_NOTICE_ANY}         xpath=//*[starts-with(@content-desc,'pera_card_issuance_') or starts-with(@resource-id,'pera_card_issuance_') or starts-with(@name,'pera_card_issuance_')]
${CARD_REVEAL_OR_NOTICE}            xpath=//*[@name='pera_card_reveal_button' or @resource-id='pera_card_reveal_button' or @content-desc='pera_card_reveal_button' or starts-with(@content-desc,'pera_card_issuance_') or starts-with(@resource-id,'pera_card_issuance_') or starts-with(@name,'pera_card_issuance_')]
${CARD_ADD_FUNDS_SCREEN}            tid=card-add-funds
${CARD_ADD_FUNDS_DEPOSIT}           tid=card_add_funds_deposit_button
${CARD_ADD_FUNDS_ASSET_CHIP}        tid=card-add-funds-asset-selector
# The asset sheet passes no testIDs.
${CARD_SELECT_ASSET_TITLE}          xpath=//*[@text='Select asset' or @label='Select asset']
${CARD_WITHDRAW_SCREEN}             tid=card-withdraw
${CARD_WITHDRAW_SUBMIT}             tid=card_withdraw_button
${CARD_WITHDRAW_STATUS_SCREEN}      tid=card-withdraw-status
${CARD_WITHDRAW_FORM_OR_STATUS}     xpath=//*[@name='card-withdraw' or @resource-id='card-withdraw' or @content-desc='card-withdraw' or @name='card-withdraw-status' or @resource-id='card-withdraw-status' or @content-desc='card-withdraw-status']


*** Keywords ***
Open Pera Card Intro
    [Documentation]    Add Account offers Pera Card only while the feature is on for the build and
    ...                no card session exists, so a build without it skips here. Pass
    ...                --variable E2E_EXPECT_CARD:True where the feature is on, so a missing entry fails.
    Open Account Switcher
    Tap    ${ACCOUNT_MENU_ADD_BUTTON}
    Wait Until Page Contains Element    ${ADD_ACCOUNT_IMPORT_BUTTON}    timeout=20s
    ${offered}=    Run Keyword And Return Status    Scroll Until Tappable    ${ADD_ACCOUNT_PERA_CARD_BUTTON}
    IF    ${E2E_EXPECT_CARD}
        Should Be True    ${offered}    Add Account offers no Pera Card entry although E2E_EXPECT_CARD is set.
    END
    Skip If    not ${offered}    Add Account offers no Pera Card entry: the feature is off for this build.
    Tap    ${ADD_ACCOUNT_PERA_CARD_BUTTON}
    Wait Until Settled    ${CARD_INTRO_CREATE_BUTTON}

Open Card Sign In
    Open Pera Card Intro
    Tap    ${CARD_INTRO_LOGIN_BUTTON}
    Wait Until Page Contains Element    ${CARD_SIGN_IN_SCREEN}    timeout=20s
    Wait Until Settled    ${CARD_SIGN_IN_SUBMIT}

Open Card Sign Up
    Open Pera Card Intro
    Tap    ${CARD_INTRO_CREATE_BUTTON}
    Wait Until Page Contains Element    ${CARD_ONBOARDING_EMAIL_INPUT}    timeout=20s

Open Pera Card Dashboard
    [Documentation]    The switcher lists a connected card only on a device signed in to a card
    ...                account, which the suite cannot create, so a device without one skips here.
    Open Account Switcher
    ${connected}=    Run Keyword And Return Status    Scroll Until Present    ${CARD_CONNECTED_ROW}
    Skip If    not ${connected}
    ...    No Pera Card is connected on this device: the dashboard needs a signed-in card account.
    Scroll Until Tappable    ${CARD_CONNECTED_ROW}
    Tap    ${CARD_CONNECTED_ROW}
    Wait Until Page Contains Element    ${CARD_DASHBOARD_SCREEN}    timeout=30s

Open Card Details Tab
    Open Pera Card Dashboard
    Wait Until Settled    ${CARD_DETAILS_TAB}
    Tap    ${CARD_DETAILS_TAB}
    Wait Until Page Contains Element    ${CARD_FUNDING_ACCOUNT_ROW}    timeout=20s

Open Card Money Screen
    [Documentation]    Opens the screen behind a dashboard money button. An auto-funding card has
    ...                neither Add Funds nor Withdraw: it is funded from its linked account.
    [Arguments]    ${button}    ${screen}
    Open Pera Card Dashboard
    ${manual}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${button}    timeout=20s
    Skip If    not ${manual}    This card is auto-funding, so its dashboard has no such button.
    Wait Until Settled    ${button}
    Tap    ${button}
    Wait Until Page Contains Element    ${screen}    timeout=30s
