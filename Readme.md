# Prerequisites

This Vonage Cloud Runtime based app allows you queue your requests to SMS and/or Messages API and have them sent at a configurable rate. It also contains a few filters:
  - Content: 
    - GSM7 characters only (GSM character sets)
    - Keywords Blacklisting, configured in neru.yml
    - Length limit
  - Allowed time window for sending
  - Frequency: limit sms per number in the allowed time window
  - Whitelist
    - Bypass all filters for whitelisted numbers


This is built based on [klapperkopp/vcr-simple-queue-demo commit 8d28cb9](https://github.com/klapperkopp/vcr-simple-queue-demo/tree/add-optional-filters-and-checks)

- Install and configure the vonage cloud runtime CLI (neru CLI) from https://vonage-neru.herokuapp.com/neru/guides/cli

# Initial Setup

0. Run `neru configure ` set set your `$API_KEY` and `$API_SECRET`
1. Run `neru app create --name "vcr-filter-queue-messages"` and copy application id (only if you don't have an app yet)
2. Run `cp neru.yml.example neru.yml` and copy application id and any missing env variables into neru.yml
3. Run `neru app configure --app-id [YOUR_APP_ID] --rtc=false` (this is only needed if you want to process inbound requests)
4. Run `neru secrets add --name INTERNAL_API_SECRET --value "$(openssl rand -hex 12)"` (this will be only internally used at the moment, should be a secure random hash or equal)

# Optional Addons

You can install optional addons by setting certain envrionment variables in neru.yml to true. Please see the respective plugin readme files to find out more. Some plugins might come with additional API endpoints that are described in their readme files.

## Current Plugin List
- [Filters](./Readme.Filters.md)

# Debug it

- Run `source .env.local && neru debug -f neru.yml`

# Deploy it

- Run `neru deploy -f neru.yml `
The VCR instance address $VCR_HOST is returned after successfully deployed.

# Example API requests

## POST /queues/create

Usage: Create a new queue into which you can add items to be processed.

```sh
  curl -X POST $VCR_HOST/queues/create \
  -u "$API_KEY:$API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sms_queue",
    "maxInflight": 30, 
    "msgPerSecond": 30
  }'
```

## POST /queues/additem/:queue_name

Usage: Add a request to be processed to a queue that you created. 
This queue sends to Messages API when the request payload includes `message_type` and `channel` :

```sh
curl -X POST https://$VCR_HOST/queues/additem/sms_queue \
-u "$API_KEY:$API_SECRET" \
-H "Content-Type: application/json" \
-d '{
  "message_type": "text",
  "text": "This is a test SMS.",
  "to": "4915112345678",
  "from": "Vonage",
  "channel": "sms",
  "action": "drop" // optional - drop the message 
}'
```

## POST /queues/additem/:queue_name 
The queue sends to SMS API when `message_type` and `channel` are not set:

```sh
curl -X POST https://$VCR_HOST/queues/additem/sms_queue \
-u "$API_KEY:$API_SECRET" \
-H "Content-Type: application/json" \
-d '{
  "text": "This is a test SMS.",
  "to": "4915112345678",
  "from": "Vonage",
  "action": "drop" // optional - drop the message 
}'
```

## Pause the queue /queues/:queue_name

Usage: eg. stop the campaign 

```sh
curl -X POST $VCR_HOST/queues/pause/sms_queue \
-u "$API_KEY:$API_SECRET" \
-H "Content-Type: application/json" 
```

## add a number to the whitelist

```sh
curl -X POST $VCR_HOST/whitelist \
-u "$API_KEY:$API_SECRET" \
-H "Content-Type: application/json" \
-d '{
    "number": '${number}'
}'
```

