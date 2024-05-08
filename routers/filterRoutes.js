import express from "express";
import { neru } from "neru-alpha";
import createError from "http-errors";
import { handleAuth } from "../handlers/handleAuth.js";
import { DB_TABLENAME_WHITELIST } from "../handlers/handleFilters.js";

const ENABLE_WHITELIST_CHECK = process.env.ENABLE_WHITELIST_CHECK;

const filterRouter = express.Router();

if (ENABLE_WHITELIST_CHECK) {
  filterRouter.post("/", handleAuth, async (req, res, next) => {
    try {
      req.body.number = `${Number(req.body.number)}`;
      const { number } = req.body;

      if (!number || isNaN(number) || number == 0) throw new Error("No number provided.");

      const db = neru.getInstanceState();
      await db.hset(DB_TABLENAME_WHITELIST, { [number]: "true" });
      
      return res.json({ success: true });
    } catch (e) {
      console.log("Whitelist addition error: ", e.message, e.response?.data);
      return next(new createError(500, `Failed to add to Whitelist. ${e.message}`));
    }
  });

  filterRouter.delete("/", handleAuth, async (req, res, next) => {
    try {
      req.body.number = `${Number(req.body.number)}`;
      const { number } = req.body;

      if (!number || isNaN(number) || number == 0) throw new Error("No number provided.");

      const db = neru.getInstanceState();
      await db.hdel(DB_TABLENAME_WHITELIST, [number]);

      return res.json({ success: true });
    } catch (e) {
      console.log("Whitelist deletion error: ", e.message, e.response?.data);
      return next(new createError(500, `Failed to delete from Whitelist. ${e.message}`));
    }
  });

  filterRouter.get("/query(/:number)?", handleAuth, async (req, res, next) => {
    try {
      const { number } = req.params;

      const db = neru.getInstanceState();
      if (number) {
        let isWhitelisted = await db.hget(DB_TABLENAME_WHITELIST, number.toString());
        return res.json({[number]: isWhitelisted || false});
      }
      else {
        let data = await db.hgetall(DB_TABLENAME_WHITELIST); 
        return res.json(data);
      }
      
    } catch (e) {
      console.log("Whitelist query error:", e.response?.status, e.response?.data?.error, e.message);
      return next(new createError(500, `Failed to query from Whitelist. ${e.message}`));
    }
  });
}

filterRouter.delete("/reset/counter", handleAuth, async (req, res, next) => {
  try {
    req.body.number = `${Number(req.body.number)}`;
    const { number } = req.body;

    if (!number || isNaN(number) || number == 0) throw new Error("No number provided.");

    const db = neru.getInstanceState();
    await db.delete(`messagese_count_v2_${number}`);

    return res.json({ success: true });
  } catch (e) {
    console.log(e.response?.status, e.response?.data?.error, e.message);
    return next(new createError(500, `Failed to reset counter. ${e.message} ${e.response?.data?.error}`));
  }
});

export default filterRouter;
