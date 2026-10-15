*** Settings ***
Resource            onboarding.resource


*** Variables ***
${SWAP_TAB}                         accessibility_id=Swap
${SWAP_INTRO_START_BUTTON}          accessibility_id=swap-intro-start-button
# The age declaration's buttons carry no testID.
${AGE_GATE_CONFIRM}                 xpath=//*[@text='I am 18 or older' or @label='I am 18 or older']
${SWAP_INFO_BUTTON}                 xpath=//*[@content-desc='swap_info_button' or @resource-id='swap_info_button' or @name='swap_info_button']
${WEBVIEW_CLOSE_BUTTON}             accessibility_id=webview_close_button
${ACCOUNT_DRAWER}                   xpath=//*[@content-desc='pw_drawer_gesture_surface' or @resource-id='pw_drawer_gesture_surface' or @name='pw_drawer_gesture_surface']
${ACCOUNT_ROW_ANY}                  xpath=//*[starts-with(@content-desc,'account_switcher_row_') or starts-with(@resource-id,'account_switcher_row_') or starts-with(@name,'account_switcher_row_')]

${SWAP_PAY_INPUT}                   accessibility_id=swap-pay-input
${SWAP_RECEIVE_AMOUNT}              accessibility_id=swap-receive-amount
${SWAP_BUTTON}                      accessibility_id=swap-button
${SWAP_MAX_BUTTON}                  accessibility_id=swap-max-button
${SWAP_FLIP_BUTTON}                 accessibility_id=swap-flip-button
${SWAP_CONFIGURE_BUTTON}            accessibility_id=swap-configure-button
${SWAP_PROVIDER_ROW}                accessibility_id=swap-provider-row
${SWAP_PAY_ASSET_SELECTOR}          accessibility_id=swap-pay-asset-selector
${SWAP_RECEIVE_ASSET_SELECTOR}      accessibility_id=swap-receive-asset-selector
# PWView containers expose their testID as resource-id on Android, not as an accessibility id.
${SWAP_QUOTE_ERROR}                 xpath=//*[@resource-id='swap_quote_error' or @name='swap_quote_error']
${SWAP_INSUFFICIENT_BALANCE}        xpath=//*[@resource-id='swap_insufficient_balance' or @name='swap_insufficient_balance']
${SWAP_BALANCE_VALUE}               xpath=(//*[@text='Balance: ' or @label='Balance: ']/following-sibling::*)[1]
${SWAP_SELECT_ASSET_LABEL}          xpath=//*[@text='Select' or @label='Select']
${NOTHING_TO_SWAP_TOAST}            xpath=//*[@text='Nothing to swap' or @label='Nothing to swap']

${ASSET_SEARCH_INPUT}               accessibility_id=searchable-list-search-input
${PAY_ASSET_ROW_ANY}                xpath=//*[starts-with(@content-desc,'asset-list-item-') or starts-with(@resource-id,'asset-list-item-') or starts-with(@name,'asset-list-item-')]
${RECEIVE_ASSET_ROW_ANY}            xpath=//*[starts-with(@content-desc,'swap-asset-item-') or starts-with(@resource-id,'swap-asset-item-') or starts-with(@name,'swap-asset-item-')]
${NO_MATCHING_ASSETS}               xpath=//*[@text='No Matching Assets' or @label='No Matching Assets']
${NO_MATCH_SEARCH}                  ZZQXNOMATCH9999
# Mainnet USDC: verified and pooled against ALGO, so a stable probe for the receive list.
${USDC_ASSET_ID}                    31566704
${USDC_RECEIVE_ROW}                 xpath=//*[@content-desc='swap-asset-item-31566704' or @resource-id='swap-asset-item-31566704' or @name='swap-asset-item-31566704']
${USDC_LABEL}                       xpath=//*[contains(@text,'USDC') or contains(@label,'USDC')]

${CONFIG_APPLY}                     accessibility_id=swap-config-apply
${CONFIG_SLIPPAGE_INPUT}            accessibility_id=swap-config-slippage-input
${CONFIG_SLIPPAGE_CUSTOM}           accessibility_id=swap-config-slippage-chip-custom
${CONFIG_SLIPPAGE_CHIP_1}           accessibility_id=swap-config-slippage-chip-1
${CONFIG_BALANCE_INPUT}             accessibility_id=swap-config-balance-input
${CONFIG_BALANCE_CHIP_50}           accessibility_id=swap-config-balance-chip-50
${CONFIG_LOCAL_CURRENCY_TOGGLE}     accessibility_id=swap_local_currency_toggle
${CONFIG_SLIPPAGE_ERROR}            xpath=//*[starts-with(@text,'Slippage must be between') or starts-with(@label,'Slippage must be between')]
${CONFIG_BALANCE_ERROR}             xpath=//*[starts-with(@text,'Balance percentage must be between') or starts-with(@label,'Balance percentage must be between')]

${PROVIDER_APPLY}                   accessibility_id=swap-provider-apply
${PROVIDER_OPTION_AUTO}             accessibility_id=swap-provider-option-auto
${PROVIDER_OPTION_OTHER}            xpath=(//*[(starts-with(@content-desc,'swap-provider-option-') and @content-desc!='swap-provider-option-auto') or (starts-with(@name,'swap-provider-option-') and @name!='swap-provider-option-auto')])[1]
${PROVIDER_TITLE_AUTO}              xpath=//*[@text='Provider (Best price available)' or @label='Provider (Best price available)']
${PROVIDER_TITLE_MANUAL}            xpath=//*[@text='Provider' or @label='Provider']

${TOP_PAIRS}                        xpath=//*[@resource-id='swap-top-pairs' or @name='swap-top-pairs']
${TOP_PAIRS_TITLE}                  xpath=//*[@text='Top 5 Swaps' or @label='Top 5 Swaps']
# The trailing hyphen keeps the swap-top-pairs-skeleton-N placeholders out.
${TOP_PAIR_FIRST}                   xpath=(//*[starts-with(@content-desc,'swap-top-pair-') or starts-with(@name,'swap-top-pair-')])[1]
${HISTORY_WIDGET}                   xpath=//*[@resource-id='swap-pair-history-widget' or @name='swap-pair-history-widget']
${HISTORY_SEE_ALL}                  accessibility_id=swap-pair-history-see-all
${HISTORY_LIST}                     xpath=//*[@resource-id='swap-history-list' or @name='swap-history-list']
${HISTORY_EMPTY}                    xpath=//*[@text='No swaps yet' or @label='No swaps yet']
${HISTORY_ROW_FIRST}                xpath=(//*[starts-with(@content-desc,'swap-history-item-') or starts-with(@name,'swap-history-item-')])[1]

${CONFIRM_SLIDE}                    accessibility_id=swap-confirm-slide
${CONFIRM_WARNING}                  accessibility_id=swap-confirm-warning
${CONFIRM_CLOSE}                    xpath=//*[@content-desc='swap-confirm-close' or @resource-id='swap-confirm-close' or @name='swap-confirm-close']
${CONFIRM_TITLE}                    xpath=//*[@text='Confirm Swap' or @label='Confirm Swap']
@{CONFIRM_LABELS}                   Rate    Minimum Received    Pera Fee    Price Impact    Slippage Tolerance
@{CONFIRM_VALUE_IDS}                swap-confirm-rate    swap-confirm-provider    swap-confirm-slippage
...                                 swap-confirm-price-impact    swap-confirm-min-received    swap-confirm-pera-fee

${QUOTE_TIMEOUT}                    45
# Quote fetches are debounced, so an absent CTA only proves something once this has passed.
${QUOTE_SETTLE}                     3s
${FUNDED_PAY_AMOUNT}                0.1
${FUNDED_WALLET_IMPORTED}           ${False}


*** Keywords ***
Open Swap
    [Documentation]    Home first, so a WebView or sheet left by an earlier case cannot cover the form.
    Go Home
    Tap    ${SWAP_TAB}
    # First visits raise the age declaration and then the introduction sheet, a moment apart.
    FOR    ${i}    IN RANGE    60
        ${ready}=    Run Keyword And Return Status    Page Should Contain Element    ${SWAP_PAY_INPUT}
        IF    ${ready}    RETURN
        Tap If Present    ${AGE_GATE_CONFIRM}
        Tap If Present    ${SWAP_INTRO_START_BUTTON}
        Sleep    0.5s
    END
    Fail    The swap form never appeared.

Open Swap With Funded Account
    [Documentation]    Skips unless PERA_E2E_SWAP_MNEMONIC holds a funded mainnet universal wallet.
    ...                Replaces the device wallet with it once per session; the phrase is passed
    ...                straight through and never assigned or logged.
    Skip If    not os.environ.get('PERA_E2E_SWAP_MNEMONIC')
    ...    PERA_E2E_SWAP_MNEMONIC is not set; this case needs a funded mainnet wallet.
    IF    not ${FUNDED_WALLET_IMPORTED}
        Import From Welcome    ${RECOVER_UNIVERSAL_WALLET}    PERA_E2E_SWAP_MNEMONIC
        VAR    ${FUNDED_WALLET_IMPORTED}    ${True}    scope=SUITE
    END
    Open Swap

Enter Pay Amount
    [Arguments]    ${amount}
    Clear Text    ${SWAP_PAY_INPUT}
    Input Text    ${SWAP_PAY_INPUT}    ${amount}
    Dismiss Keyboard

Wait For Quote
    [Documentation]    The provider row renders only with a selected quote; the receive amount shows
    ...                0.00 without one, so it proves nothing. No quote is a backend or liquidity
    ...                condition on this network, so it skips.
    FOR    ${i}    IN RANGE    ${QUOTE_TIMEOUT}
        ${quoted}=    Run Keyword And Return Status    Page Should Contain Element    ${SWAP_PROVIDER_ROW}
        IF    ${quoted}    RETURN
        ${failed}=    Run Keyword And Return Status    Page Should Contain Element    ${SWAP_QUOTE_ERROR}
        Skip If    ${failed}    The quote service answered with an error on this run.
        Sleep    1s
    END
    Skip    No quote within ${QUOTE_TIMEOUT}s; this network or pair has no swap liquidity.

Enter Amount And Wait For Quote
    [Arguments]    ${amount}=1
    Enter Pay Amount    ${amount}
    Wait For Quote

Form Should Offer No Swap
    Sleep    ${QUOTE_SETTLE}
    Page Should Not Contain Element    ${SWAP_BUTTON}
    Page Should Not Contain Element    ${SWAP_PROVIDER_ROW}

Extract Number
    [Documentation]    First number in a display string, tolerating grouping commas and a currency
    ...                prefix; None when there is none. [.] because a backslash does not survive Evaluate.
    [Arguments]    ${raw}
    ${num}=    Evaluate
    ...    (lambda m: float(m.group(0).replace(',', '')) if m else None)(re.search(r'[0-9][0-9,]*(?:[.][0-9]+)?', $raw))
    RETURN    ${num}

Displayed Value
    [Documentation]    Text of an element whose testID came from getTestProps. On iOS that helper sets
    ...                the accessibility label to the testID, which hides the rendered value; fail on
    ...                that rather than assert against the id.
    [Arguments]    ${test_id}
    ${text}=    Get Text    accessibility_id=${test_id}
    Should Not Be Equal    ${text.strip()}    ${test_id}
    ...    ${test_id} exposes only its testID, not the value it renders.
    RETURN    ${text}

Text Inside
    [Documentation]    Joined text of an element's descendants, for rows whose own node carries no text.
    [Arguments]    ${xpath}
    ${found}    ${nodes}=    Run Keyword And Ignore Error    Get Webelements
    ...    xpath=(${xpath})//*[string-length(@text) > 0 or string-length(@label) > 0]
    IF    '${found}' != 'PASS'    RETURN    ${EMPTY}
    VAR    @{parts}
    FOR    ${node}    IN    @{nodes}
        ${text}=    Get Text    ${node}
        VAR    @{parts}    @{parts}    ${text}
    END
    RETURN    ${{ ' '.join($parts) }}

Switch Is On
    [Documentation]    Android reports a switch through `checked`, iOS through `value`.
    [Arguments]    ${locator}
    ${ok}    ${checked}=    Run Keyword And Ignore Error    Get Element Attribute    ${locator}    checked
    IF    '${ok}' == 'PASS' and $checked is not None
        RETURN    ${{ str($checked).lower() == 'true' }}
    END
    ${value}=    Get Element Attribute    ${locator}    value
    RETURN    ${{ str($value).lower() in ('1', 'true') }}

Open Pay Asset Picker
    Tap    ${SWAP_PAY_ASSET_SELECTOR}
    Wait Until Page Contains Element    ${ASSET_SEARCH_INPUT}    timeout=15s

Open Receive Asset Picker
    Tap    ${SWAP_RECEIVE_ASSET_SELECTOR}
    Wait Until Page Contains Element    ${ASSET_SEARCH_INPUT}    timeout=15s

Search Assets
    [Arguments]    ${term}
    Input Text    ${ASSET_SEARCH_INPUT}    ${term}
    Dismiss Keyboard

Receive Rows Or Skip
    [Documentation]    The receive list comes from the DEX backend and can be empty on a network
    ...                without swap liquidity.
    ${rows}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${RECEIVE_ASSET_ROW_ANY}    timeout=30s
    Skip If    not ${rows}    The receive (DEX) asset list is empty on this run.

Close Picker Back To Form
    Dismiss Keyboard
    Close Sheet
    Wait Until Page Does Not Contain Element    ${ASSET_SEARCH_INPUT}    timeout=10s
    Wait Until Page Contains Element    ${SWAP_PAY_INPUT}    timeout=10s

Choose USDC To Receive
    ${already}=    Run Keyword And Return Status    Page Should Contain Element    ${USDC_LABEL}
    IF    ${already}    RETURN
    Open Receive Asset Picker
    Search Assets    ${USDC_ASSET_ID}
    Wait Until Page Contains Element    ${USDC_RECEIVE_ROW}    timeout=30s
    Tap    ${USDC_RECEIVE_ROW}
    Wait Until Page Contains Element    ${SWAP_PAY_INPUT}    timeout=15s

Open Configuration
    Tap    ${SWAP_CONFIGURE_BUTTON}
    Wait Until Settled    ${CONFIG_APPLY}

Apply Configuration
    Tap    ${CONFIG_APPLY}
    Wait Until Page Does Not Contain Element    ${CONFIG_APPLY}    timeout=10s

Reveal Local Currency Toggle
    [Documentation]    The toggle sits below the presets and can start under the fold.
    FOR    ${i}    IN RANGE    5
        ${seen}=    Run Keyword And Return Status    Page Should Contain Element    ${CONFIG_LOCAL_CURRENCY_TOGGLE}
        IF    ${seen}    RETURN
        Swipe By Percent    50    70    50    40
    END
    Wait Until Page Contains Element    ${CONFIG_LOCAL_CURRENCY_TOGGLE}    timeout=5s

Set Local Currency
    [Arguments]    ${on}
    Open Configuration
    Reveal Local Currency Toggle
    ${current}=    Switch Is On    ${CONFIG_LOCAL_CURRENCY_TOGGLE}
    IF    $current != $on    Tap    ${CONFIG_LOCAL_CURRENCY_TOGGLE}
    Apply Configuration

Local Currency Should Be
    [Arguments]    ${on}
    Open Configuration
    Reveal Local Currency Toggle
    ${current}=    Switch Is On    ${CONFIG_LOCAL_CURRENCY_TOGGLE}
    Should Be Equal    ${current}    ${on}    Use local currency did not keep the applied value.
    Close Sheet
    Wait Until Page Does Not Contain Element    ${CONFIG_APPLY}    timeout=10s

Open Provider Sheet
    Tap    ${SWAP_PROVIDER_ROW}
    Wait Until Settled    ${PROVIDER_APPLY}

Other Provider Or Skip
    ${offered}=    Run Keyword And Return Status    Page Should Contain Element    ${PROVIDER_OPTION_OTHER}
    Skip If    not ${offered}    Only Auto was offered for this quote; there is no provider to pick.

Close Provider Sheet
    Close Sheet
    Wait Until Page Does Not Contain Element    ${PROVIDER_APPLY}    timeout=10s

Restore Auto Provider
    Open Provider Sheet
    Tap    ${PROVIDER_OPTION_AUTO}
    Tap    ${PROVIDER_APPLY}
    Wait Until Page Contains Element    ${PROVIDER_TITLE_AUTO}    timeout=15s

Open Swap History
    ${has_history}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${HISTORY_SEE_ALL}    timeout=15s
    Skip If    not ${has_history}    This account has no swap history, so See all is not offered.
    Tap    ${HISTORY_SEE_ALL}
    Wait Until Page Contains Element    ${HISTORY_LIST}    timeout=15s

Open Confirmation
    [Arguments]    ${amount}=${FUNDED_PAY_AMOUNT}
    Choose USDC To Receive
    Enter Amount And Wait For Quote    ${amount}
    Expect Element    ${SWAP_BUTTON}    enabled    timeout=30s
    Tap    ${SWAP_BUTTON}
    Wait Until Settled    ${CONFIRM_SLIDE}

Slide To Confirm
    [Documentation]    The slider is a gesture-handler pan, so a tap does nothing. One drag only: a
    ...                retry could submit a second real swap.
    ${loc}=    Get Element Location    ${CONFIRM_SLIDE}
    ${size}=    Get Element Size    ${CONFIRM_SLIDE}
    ${y}=    Evaluate    int($loc['y'] + $size['height'] / 2)
    ${x1}=    Evaluate    int($loc['x'] + $size['width'] * 0.1)
    ${x2}=    Evaluate    int($loc['x'] + $size['width'] * 0.95)
    Swipe    start_x=${x1}    start_y=${y}    end_x=${x2}    end_y=${y}    duration=1500ms
