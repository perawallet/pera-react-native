*** Settings ***
Documentation       Pera Card on Android and iOS from one suite: the entry from Add Account, the intro,
...                 the sign-in form, the first sign-up step and the dashboard. The entry cases are
...                 fund-free and account-free and skip on a build where the card is not offered. The
...                 dashboard cases skip on a device with no connected card; they only read and open
...                 screens, and never enter an amount, reveal, freeze or report the card.
Resource            ../resources/card.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Close Pera
Test Setup          Go Home
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           card


*** Test Cases ***
Add Account Offers The Pera Card Intro
    [Tags]    id:card.intro.from-add-account    p1
    Open Pera Card Intro
    Page Should Contain Element    ${CARD_INTRO_LOGIN_BUTTON}
    Page Should Contain Element    ${CARD_INTRO_LEARN_MORE}

Login Opens The Sign In Form
    [Tags]    id:card.sign-in.form    p1
    Open Card Sign In
    Page Should Contain Element    ${CARD_SIGN_IN_EMAIL_INPUT}
    Page Should Contain Element    ${CARD_SIGN_IN_PASSWORD_INPUT}
    Page Should Contain Element    ${CARD_SIGN_IN_FORGOT_PASSWORD}

Forgot Password Opens The Reset Form
    [Tags]    id:card.sign-in.forgot-password    p2
    Open Card Sign In
    Tap    ${CARD_SIGN_IN_FORGOT_PASSWORD}
    Wait Until Page Contains Element    ${CARD_FORGOT_PASSWORD_SCREEN}    timeout=20s
    Page Should Contain Element    ${CARD_FORGOT_PASSWORD_EMAIL}
    Page Should Contain Element    ${CARD_FORGOT_PASSWORD_SUBMIT}

Create Account Starts At The Email Step
    [Tags]    id:card.sign-up.email-step    p1
    Open Card Sign Up
    Page Should Contain Element    ${CARD_ONBOARDING_COUNTRY_FIELD}

Sign Up Confirm Stays Disabled Without A Valid Email
    [Documentation]    Stops at an invalid email: Confirm sends a real sign-up request.
    [Tags]    id:card.sign-up.validation    p2
    Open Card Sign Up
    ${waitlisted}=    Run Keyword And Return Status    Page Should Contain Element    ${CARD_ONBOARDING_WAITLIST_JOIN}
    Skip If    ${waitlisted}    This device's region is on the card waitlist, where the form offers Join in place of Confirm.
    Expect Element    ${CARD_ONBOARDING_EMAIL_CONFIRM}    disabled    timeout=5s
    Input Text    ${CARD_ONBOARDING_EMAIL_INPUT}    invalid-email
    Expect Element    ${CARD_ONBOARDING_EMAIL_CONFIRM}    disabled    timeout=5s

Country Field Opens The Country Picker
    [Tags]    id:card.sign-up.country-picker    p2
    Open Card Sign Up
    Wait Until Settled    ${CARD_ONBOARDING_COUNTRY_FIELD}
    Tap    ${CARD_ONBOARDING_COUNTRY_FIELD}
    Wait Until Page Contains Element    ${CARD_COUNTRY_SEARCH_INPUT}    timeout=15s

Sign In Requires A Valid Email And A Password
    [Tags]    id:card.sign-in.validation    p1
    Open Card Sign In
    Expect Element    ${CARD_SIGN_IN_SUBMIT}    disabled    timeout=5s
    Input Text    ${CARD_SIGN_IN_EMAIL_INPUT}    invalid-email
    Input Text    ${CARD_SIGN_IN_PASSWORD_INPUT}    e2e-validation-only
    Expect Element    ${CARD_SIGN_IN_SUBMIT}    disabled    timeout=5s
    Clear Text    ${CARD_SIGN_IN_EMAIL_INPUT}
    Input Text    ${CARD_SIGN_IN_EMAIL_INPUT}    e2e@example.invalid
    Expect Element    ${CARD_SIGN_IN_SUBMIT}    enabled    timeout=5s
    Clear Text    ${CARD_SIGN_IN_PASSWORD_INPUT}
    Expect Element    ${CARD_SIGN_IN_SUBMIT}    disabled    timeout=5s

Password Reset Requires A Valid Email
    [Tags]    id:card.forgot-password.validation    p1
    Open Card Sign In
    Tap    ${CARD_SIGN_IN_FORGOT_PASSWORD}
    Wait Until Settled    ${CARD_FORGOT_PASSWORD_EMAIL}
    Expect Element    ${CARD_FORGOT_PASSWORD_SUBMIT}    disabled    timeout=5s
    Input Text    ${CARD_FORGOT_PASSWORD_EMAIL}    invalid-email
    Expect Element    ${CARD_FORGOT_PASSWORD_SUBMIT}    disabled    timeout=5s
    Clear Text    ${CARD_FORGOT_PASSWORD_EMAIL}
    Input Text    ${CARD_FORGOT_PASSWORD_EMAIL}    e2e@example.invalid
    Expect Element    ${CARD_FORGOT_PASSWORD_SUBMIT}    enabled    timeout=5s
    Clear Text    ${CARD_FORGOT_PASSWORD_EMAIL}
    Expect Element    ${CARD_FORGOT_PASSWORD_SUBMIT}    disabled    timeout=5s

Card Overview Offers A Way To Fund The Card
    [Tags]    id:card.dashboard.overview-actions    p1
    Open Pera Card Dashboard
    ${manual}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${CARD_ADD_FUNDS_BUTTON}    timeout=20s
    IF    ${manual}
        Page Should Contain Element    ${CARD_WITHDRAW_BUTTON}
    ELSE
        Page Should Contain Element    ${CARD_FUND_LINKED_BUTTON}
        ...    message=The overview offers neither Add Funds nor funding from the linked account.
    END

Card Details Lists The Card's State And Its Management Rows
    [Tags]    id:card.dashboard.details    p1
    Open Card Details Tab
    ${reveal}=    Run Keyword And Return Status    Page Should Contain Element    ${CARD_REVEAL_BUTTON}
    ${notice}=    Run Keyword And Return Status    Page Should Contain Element    ${CARD_ISSUANCE_NOTICE_ANY}
    Should Be True    ${reveal} or ${notice}    Card Details offers neither Reveal nor an issuance notice.
    Scroll Until Present    ${CARD_ACCOUNTS_DETAILS_ROW}
    Scroll Until Present    ${CARD_REPORT_LOST_ROW}

Accounts Details Row Opens Its Sheet
    [Tags]    id:card.dashboard.account-details    p2
    Open Card Details Tab
    Scroll Until Tappable    ${CARD_ACCOUNTS_DETAILS_ROW}
    Tap    ${CARD_ACCOUNTS_DETAILS_ROW}
    Wait Until Page Contains Element    ${CARD_ACCOUNT_DETAILS_SHEET}    timeout=20s

Show All Opens The Card Transactions
    [Tags]    id:card.dashboard.transactions    p2
    Open Pera Card Dashboard
    Scroll Until Tappable    ${CARD_SHOW_ALL_TRANSACTIONS}
    Tap    ${CARD_SHOW_ALL_TRANSACTIONS}
    Wait Until Page Contains Element    ${CARD_TRANSACTIONS_SCREEN}    timeout=30s

Rewards Row Opens The Rewards Balance
    [Tags]    id:card.dashboard.rewards    p2
    Open Pera Card Dashboard
    Scroll Until Tappable    ${CARD_REWARDS_ROW}
    Tap    ${CARD_REWARDS_ROW}
    Wait Until Page Contains Element    ${CARD_WALLET_BALANCE_AMOUNT}    timeout=30s

Add Funds Opens With Deposit Disabled At Zero
    [Tags]    id:card.add-funds.zero-disabled    p1
    Open Card Money Screen    ${CARD_ADD_FUNDS_BUTTON}    ${CARD_ADD_FUNDS_SCREEN}
    Expect Element    ${CARD_ADD_FUNDS_DEPOSIT}    disabled    timeout=10s

Add Funds Asset Chip Opens The Asset Picker
    [Tags]    id:card.add-funds.asset-picker    p2
    Open Card Money Screen    ${CARD_ADD_FUNDS_BUTTON}    ${CARD_ADD_FUNDS_SCREEN}
    Wait Until Settled    ${CARD_ADD_FUNDS_ASSET_CHIP}
    Tap    ${CARD_ADD_FUNDS_ASSET_CHIP}
    Wait Until Page Contains Element    ${CARD_SELECT_ASSET_TITLE}    timeout=15s

Withdraw Opens Its Form Disabled At Zero Or The Pending Status
    [Documentation]    A card with a withdrawal already pending opens that withdrawal's status in
    ...                place of the form, and there is then no zero amount to check.
    [Tags]    id:card.withdraw.open    p1
    Open Card Money Screen    ${CARD_WITHDRAW_BUTTON}    ${CARD_WITHDRAW_FORM_OR_STATUS}
    ${form}=    Run Keyword And Return Status    Page Should Contain Element    ${CARD_WITHDRAW_SCREEN}
    IF    ${form}    Expect Element    ${CARD_WITHDRAW_SUBMIT}    disabled    timeout=10s
