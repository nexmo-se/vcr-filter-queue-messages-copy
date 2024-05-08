import express from "express";
import { neru, Messages, Queue } from "neru-alpha";
import createError from "http-errors";
import { handleAuth } from "../handlers/handleAuth.js";
import {
  isWhitelisted,
  isPassingContentFilter,
  isGSMAlphabet,
  isPassingLengthCheck,
  isPassingTimeWindowCheck,
  isPassingFrequencyCheck,
} from "../handlers/handleFilters.js";
import { sendSMS } from "../handlers/apiSMS.js";
import { addRequestId } from "../handlers/requestId.js";

const DEFAULT_MPS = process.env.DEFAULT_MSG_PER_SECOND || 30;
const DEFAULT_MAX_INFLIGHT = process.env.DEFAULT_MAX_INFLIGHT || 30;
const DEFAULT_SENDER_ID = process.env.DEFAULT_SENDER_ID || "Vonage";
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

const ENABLE_WHITELIST_CHECK =
  process.env.ENABLE_WHITELIST_CHECK === "true" || false;
const ENABLE_CONTENT_FILTER =
  process.env.ENABLE_CONTENT_FILTER === "true" || false;
const ENABLE_GSM_CHECK = process.env.ENABLE_GSM_CHECK === "true" || false;
const ENABLE_LENGTH_CHECK = process.env.ENABLE_LENGTH_CHECK === "true" || false;
const ALLOWED_SMS_LENGTH = process.env.ALLOWED_SMS_LENGTH || 160;

const ENABLE_TIME_WINDOW_CHECK =
  process.env.ENABLE_TIME_WINDOW_CHECK === "true" || false;

const ENABLE_FRENQUENCY_CHECK =
  process.env.ENABLE_FRENQUENCY_CHECK === "true" || false;
const MAX_MESSAGES_ALLOWED = process.env.MAX_MESSAGES_ALLOWED || 1;

//
const router = express.Router();

// api to create a queue
router.post("/create", handleAuth, async (req, res, next) => {
  const { name, maxInflight, msgPerSecond } = req.body;

  // check if queue name was provided
  if (!name) return res.status(500).send("No name found.");

  try {
    const session = neru.createSession();
    const queueApi = new Queue(session);

    // create a new queue item with neru queue provider
    await queueApi
      .createQueue(name, `/queues/callback/${name}`, {
        maxInflight: maxInflight || DEFAULT_MAX_INFLIGHT,
        msgPerSecond: msgPerSecond || DEFAULT_MPS,
        active: true,
      })
      .execute();

    // send http response
    return res.status(201).json({
      success: true,
      name,
      maxInflight: maxInflight || DEFAULT_MAX_INFLIGHT,
      msgPerSecond: msgPerSecond || DEFAULT_MPS,
    });
  } catch (e) {
    console.log(`[${req.url}] Error`, e.response?.status, e.response?.data?.error, e.message);
    return next(
      new createError(500, `Creating a new queue. ${e.message}`)
    );
  }
});

// api to add an item to a queue
// call this instead of messages api with the same payload but without required headers
router.post(
  "/additem/:name",
  [handleAuth, addRequestId],
  async (req, res, next) => {
    const { requestId } = req;
    console.info(
      `Received new queue item. Checking for validity... (requestId: ${requestId})`
    );
    const { name } = req.params;

    try {
      req.body.to = `${Number(req.body.to)}`;
      req.body.from = Number.isInteger(Number(req.body.from))
        ? `${Number(req.body.from)}`
        : req.body.from;
      //
      let { to: receiverNumber, text: messageText } = req.body;

      // check if queue name was provided
      if (!name) return res.status(500).json({ detail: "No name found." });

      if (!receiverNumber || isNaN(receiverNumber) || receiverNumber == 0) {
        let detail = "No valid to-number provided.";
        console.log(`[${req.url}] ${requestId}`, { detail });
        return res.status(422).json({ detail });
      }

      let isWhitelistedF = false;
      if (ENABLE_WHITELIST_CHECK === true && receiverNumber) {
        isWhitelistedF = await isWhitelisted(receiverNumber);
      }

      if (isWhitelistedF !== true) {
        if (ENABLE_GSM_CHECK === true) {
          const isGSMAlphabetF = isGSMAlphabet(messageText);
          if (isGSMAlphabetF !== true) {
            let detail = "Message contains non-GSM7 characters. Please check message text.";
            console.log(`[${req.url}] ${requestId}`, { detail });
            return res.status(422).json({ detail });
          }
        }

        if (ENABLE_CONTENT_FILTER === true) {
          const isPassingContentFilterF = isPassingContentFilter(messageText);
          if (isPassingContentFilterF !== true) {
            let detail = "Message contains not allowed words. Please check message text.";
            console.log(`[${req.url}] ${requestId}`, { detail });
            return res.status(422).json({ detail });
          }
        }

        if (ENABLE_LENGTH_CHECK === true) {
          const isPassingLengthCheckF = isPassingLengthCheck(messageText);
          if (isPassingLengthCheckF !== true) {
            let detail = `Message is too long. Please check message length. (max. ${ALLOWED_SMS_LENGTH})`;
            console.log(`[${req.url}] ${requestId}`, { detail });
            return res.status(422).json({ detail });
          }
        }

        if (ENABLE_TIME_WINDOW_CHECK) {
          const isPassingTimeWindowCheckF = isPassingTimeWindowCheck();
          if (isPassingTimeWindowCheckF !== true) {
            let detail = "Outside of the allowed window.";
            console.log(`[${req.url}] ${requestId}`, { detail });
            return res.status(429).json({ detail });
          }
        }

        if (ENABLE_FRENQUENCY_CHECK === true) {
          const isPassingFrequencyCheckF = await isPassingFrequencyCheck(
            receiverNumber
          );
          if (isPassingFrequencyCheckF !== true) {
            let detail = `Message limit exceeded - You have sent ${MAX_MESSAGES_ALLOWED} messages.`;
            console.log(`[${req.url}] ${requestId}`, { detail });
            return res.status(429).json({ detail });
          }
        }
      } else {
        console.log(
          "Message is going to a whitelisted number, any filters are deactivated."
        );
      }
    } catch (e) {
      console.log(`[${req.url}] ${requestId} Error item failed filter checks.`, e.message);
      return next(new createError(500, `item failed filter checks ${e.message}`));
    }

    console.info(
      `All item checks passed for item. Adding to queue... (requestId: ${requestId})`
    );

    try {
      // const session = neru.createSession(600);
      const session = neru.getSessionById(process.env.INSTANCE_ID);
      const queueApi = new Queue(session);

      req.body.client_ref = requestId;

      // create a new queue item with neru queue provider
      await queueApi
        .enqueueSingle(name, {
          originalBody: req.body,
          internalApiSecret: INTERNAL_API_SECRET,
        })
        .execute();

      console.info(`Queue ${name} Enqueued ${req.body.client_ref}`);

      // building response json based on what has been sent (messages api or sms api)
      const json =
        !req.body?.message_type || !req.body?.channel
          ? {
            "message-count": "1",
            messages: [
              {
                to: req.body.to,
                "message-id": req.body.client_ref,
                status: "0",
                "client-ref": req.body.client_ref,
              },
            ],
          }
          : { message_uuid: req.body.client_ref };

      // send http response
      return res.status(200).json(json);
    } catch (e) {
      console.log(`[${req.url}] ${requestId} Error Adding queue item.`, e.response?.status, e.response?.data?.error, e.message);
      return next(
        new createError(500, `Adding queue item. ${e.message}`)
      );
    }
  }
);

// this will be internally called when a queue item is executed
router.post("/callback/:name", async (req, res, next) => {
  const { name } = req.params;

  const { originalBody, internalApiSecret } = req.body;
  let { from } = originalBody;

  console.log("Webhook called by Queue with Name: ", name, `${originalBody.client_ref}`);

  // internal authentication, so no one can call the internal endpoint from outside world
  if (!INTERNAL_API_SECRET || internalApiSecret !== INTERNAL_API_SECRET)
    return res.status(401).json({ detail: "Unauthorized." });

  // replace sender with default sender ID if non provided
  if (!from || isNaN(from) || from == 0) from = `${DEFAULT_SENDER_ID}`;

  try {
    // const session = neru.createSession(600);
    // const session = neru.getSessionFromRequest(req);
    const session = neru.getSessionById(process.env.INSTANCE_ID);

    if (originalBody.action && "drop" === originalBody.action.toLowerCase()) {
      console.info(`Queue ${name} Dropped ${originalBody.client_ref}`);
      return res.sendStatus(200);
    }

    // send via SMS API
    if (!originalBody.message_type || !originalBody.channel) {
      await sendSMS(originalBody, originalBody.auth_type || "basic");
      
      console.info(`Queue ${name} Sent ${originalBody.client_ref}`);

      return res.sendStatus(200);
    }

    // send original message through neru messages provider
    const messaging = new Messages(session);
    await messaging.send(originalBody).execute();

    console.info(`Queue ${name} Sent ${originalBody.client_ref}`);

    return res.sendStatus(200);
  } catch (e) {
    console.log(`[${req.url}] Error`, e.response?.status, e.response?.data?.error, e.message);
    return next(new createError(500, "Executing Queue Item."));
  }
});

// api to delete a queue
router.delete("/:name", handleAuth, async (req, res, next) => {
  const { name } = req.params;

  // check if queue name was provided
  if (!name) return res.sendStatus(500);

  try {
    const session = neru.createSession();
    const queueApi = new Queue(session);

    // delete queue
    await queueApi.deleteQueue(name).execute();

    // send http response
    return res.status(200).json({ success: true });
  } catch (e) {
    console.log(`[${req.url}] Error`, e.response?.status, e.response?.data?.error, e.message);
    return next(new createError(500, "Nothing to delete."));
  }
});

// resume or pause
router.post("/resume/:name", handleAuth, async (req, res, next) => {
  const { name } = req.params;
  if (!name) return res.sendStatus(500);
  try {
    const session = neru.createSession();
    const queueApi = new Queue(session);
    await queueApi.resumeQueue(name).execute();
    return res.status(200).json({ success: true });
  } catch (e) {
    console.log(`[${req.url}] Error`, e.response?.status, e.response?.data?.error, e.message);
    return next(new createError(500));
  }
});

router.post("/pause/:name", handleAuth, async (req, res, next) => {
  const { name } = req.params;
  if (!name) return res.sendStatus(500);
  try {
    const session = neru.createSession();
    const queueApi = new Queue(session);
    await queueApi.pauseQueue(name).execute();
    return res.status(200).json({ success: true });
  } catch (e) {
    console.log(`[${req.url}] Error`, e.response?.status, e.response?.data?.error, e.message);
    return next(new createError(500));
  }
});

//
router.get("/:name", handleAuth, async (req, res, next) => {
  const { name } = req.params;

  // check if queue name was provided
  if (!name) return res.sendStatus(500);

  try {
    const session = neru.createSession();
    const queueApi = new Queue(session);

    const data = await queueApi.getQueueDetails(name).execute();

    // send http response
    return res.status(200).json(data);
  } catch (e) {
    console.log(`[${req.url}] Error`, e.response?.status, e.response?.data?.error, e.message);
    return next(new createError(500, "Nothing to get."));
  }
});

// update
router.put("/update/:name", handleAuth, async (req, res, next) => {
  const { name } = req.params;
  if (!name) return res.sendStatus(500);

  const { maxInflight, msgPerSecond } = req.body;

  try {
    const session = neru.createSession();
    const queueApi = new Queue(session);

    await queueApi
      .updateQueue(name, {
        maxInflight: maxInflight || DEFAULT_MAX_INFLIGHT,
        msgPerSecond: msgPerSecond || DEFAULT_MPS,
      })
      .execute();

    const data = await queueApi.getQueueDetails(name).execute();

    return res.status(201).json({ success: true, data });
  } catch (e) {
    console.log(`[${req.url}] Error`, e.response?.status, e.response?.data?.error, e.message);
    return next(
      new createError(
        500,
        `Failed to update the queue. ${e.message}`
      )
    );
  }
});

//
router.get("/deadletter/:name", handleAuth, async (req, res, next) => {
  const { name } = req.params;
  if (!name) return res.sendStatus(500);
  try {
    const session = neru.createSession();
    const queueApi = new Queue(session);
    const data = await queueApi.deadLetterList(name).execute();
    return res.status(200).json(data);
  } catch (e) {
    console.log(`[${req.url}] Error`, e.response?.status, e.response?.data?.error, e.message);
    return next(new createError(500, "Nothing to get."));
  }
});

export default router;
