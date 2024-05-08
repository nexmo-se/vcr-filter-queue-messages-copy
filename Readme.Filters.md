# Setup

This addon has several features:

## Whitelisting

Whitelisting of phone numbers that should always receive messages.

Can be enabled by setting the neru.yml environment variable `ENABLE_WHITELIST_CHECK` to `true`. 

After enabling the flag, the whitelisting itself is done via the new whitelist API that is enabled by this. [see below](#APIEndpoints)

## Content Filter

Checks if messages contain any character from a list and blocks sending if they contain it. 

Can be enabled by setting the neru.yml environment variable `ENABLE_CONTENT_FILTER` to `true`. 

The list of characters that are blacklisted can be set with neru.yml environment variable `FORBIDDEN_WORDS` where multiple words can be separated by `,`. 

If you want to use another delimiter than the default `,`, set the neru.yml environment variable `FORBIDDEN_WORDS_DELIMITER` to the delimiter value. (e.g. to `;`).

## GSM Alphabet Check

Checks if all the characters in the message body are only GSM7 characters. If not, block the message.

Can be enabled by setting the neru.yml environment variable `ENABLE_GSM_CHECK` to `true`.

The GSM characters are defined by two neru.yml enviroment variables called 

## Length Check

Checks the maximum length of an SMS, accounting for GSM extended characterset that will take up 2 instead of 1 character of the message. 

Can be enabled by setting the neru.yml environment variable `ENABLE_LENGTH_CHECK` to `true`.

The default length is `160`.

# <a name="APIEndpoints"></a>API Endpoints

If the neru.yml environment variable `ENABLE_WHITELIST_CHECK` is set to `true`, the following new API endpoints are mounted to the app root.

## Allowed Time Window Check

Checks if the requests are submitted in the allowed time window. If not, drop.

Can be enabled by setting the neru.yml environment variable `ENABLE_TIME_WINDOW_CHECK` to `true`, and `TIME_WINDOW_ALLOWED` accordingly.

Eg. `TIME_WINDOW_ALLOWED="* 10-20 * * 1-5"` set the allowed time window is between 10:00 UTC+0 and 20:00 UTC+0, from Monday to Friday.

## (Daily) Message Limit

Checks the messages per user in a given period of time has reached the limit set. If yes, drop.

Can be enabled by setting the neru.yml environment variable `ENABLE_FRENQUENCY_CHECK` to `true`, `MAX_MESSAGES_ALLOWED` to a number as the message limit, and set `MAX_MESSAGES_ALLOWED_PERIOD` in seconds as the period of time. 


## POST /whitelist

Usage: Create a new entry in the whitelist.

Payload:

```
{
    "number": "4915112345678"
}
```

Response:

```
{
    "success": true
}
```

## DELETE /whitelist

Usage: Delete an existing entry in the whitelist.

Payload:

```
{
    "number": "4915112345678"
}
```

Response:

```
{
    "success": true
}
```

## 