import express from "express";
import { neru, Messages, State } from "neru-alpha";
import createError from "http-errors";
import { handleAuth } from "../handlers/handleAuth.js";

const router = express.Router();

router.post("/register", handleAuth, async (req, res, next) => {
  try {
    const type = req.body.type || "sms";
    const session = neru.createSession();
    const messaging = new Messages(session);
    const state = new State(session);

    try {
      const _id = await state.get("Events_Handler_Id");
      if (_id) {
        await messaging.unsubscribeEvents(_id).execute();
      }
    } catch (error) {}
  
    const to = { type: type, number: null };
    const from = { type: type, number: null }; 
  
    const id = await messaging.onMessageEvents("/events/onEvent", from, to).execute();
    console.log("messaging.onMessageEvents", { id });

    await state.set("Events_Handler_Id", id);

    return res.json({ id });
  } catch (error) {
    return next(new createError(500, error.message));
  }
});

router.all("/onEvent", async (req, res, next) => {
  return res.sendStatus(200);
});

export default router;
