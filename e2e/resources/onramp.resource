*** Settings ***
Documentation       The Fund tab: the age-gated onramp screen with a one-time introduction, then the
...                 buy form (mainnet only). Purchases are KYC- and payment-gated and not automated.
Resource            discover.resource


*** Variables ***
${FUND_TAB}                     xpath=//*[@resource-id='Fund' or @name='Fund' or @content-desc='Fund']
${ONRAMP_INTRO_START}           xpath=//*[@resource-id='onramp-intro-start-button' or @name='onramp-intro-start-button' or @content-desc='onramp-intro-start-button']
${ONRAMP_TAB_FUND}              xpath=//*[@resource-id='onramp-tab-fund' or @name='onramp-tab-fund' or @content-desc='onramp-tab-fund']
${ONRAMP_TAB_HISTORY}           xpath=//*[@resource-id='onramp-tab-history' or @name='onramp-tab-history' or @content-desc='onramp-tab-history']
${ONRAMP_COUNTRY_CHIP}          xpath=//*[@resource-id='onramp-country-chip' or @name='onramp-country-chip' or @content-desc='onramp-country-chip']
# Rendered on the history page only; the pager keeps both pages mounted, so visibility is the signal.
${ONRAMP_HISTORY_FILTER_ALL}    xpath=//*[@resource-id='onramp-history-filter-all' or @name='onramp-history-filter-all' or @content-desc='onramp-history-filter-all']


*** Keywords ***
Open Fund Tab
    Open Past Age Gate    ${FUND_TAB}    ${ONRAMP_TAB_FUND}    also_dismiss=${ONRAMP_INTRO_START}

Acknowledge Onramp Introduction
    [Documentation]    The one-time introduction opens once the Fund screen knows its chain, which can
    ...                be after the screen is up (iOS lists the pager behind the sheet), and then lands
    ...                over whatever the case does next. Seeing it once here keeps it out of the cases.
    Go Home
    Open Fund Tab
    Tap If Shown    ${ONRAMP_INTRO_START}    3s
    Go Home

History Page Should Be Off Screen
    [Documentation]    Off-screen pager pages leave the Android tree but stay in the iOS tree as hidden.
    ${shown}=    Run Keyword And Return Status    Element Should Be Visible    ${ONRAMP_HISTORY_FILTER_ALL}
    Should Not Be True    ${shown}    The history page is still showing.
