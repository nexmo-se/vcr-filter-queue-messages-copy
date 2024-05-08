import createError from "http-errors";
import axios from "axios";
import { neru } from "neru-alpha";

async function verifyAuthorization(authorization) {
  try {
    // for a simple way of authenticating, we are checking the application ID of this
    // deployed neru application and are checking if that app exists in the account
    // that is used for authentication. This means only the api key that deployed this
    // app can be used for auth.
    const API_APPLICATION_ID = process.env.API_APPLICATION_ID;
    const response = await axios.get(
      `https://api.nexmo.com/v2/applications/${API_APPLICATION_ID}`,
      { headers: { Authorization: `${authorization}` } }
    );
    if (API_APPLICATION_ID && response?.data?.id === API_APPLICATION_ID) {
      return true;
    } else throw new Error("Unauthorized");
  } catch (e) {
    console.log("axios response:", e.message);
    return false;
  }
}

export async function handleAuth(req, res, next) {
  if (
    req.headers["authorization"] &&
    req.headers["authorization"].toLowerCase().startsWith("bearer")
  ) {
    try {
      let result = await verifyAuthorization(req.headers["authorization"]);
      if (result) return next();
      else throw new Error("Invalid JWT");
    } catch (e) {
      console.log(e.message, req.headers["authorization"]);
      return next(new createError(401, "Unauthorized"));
    }
  } else if (
    (req.headers["authorization"] &&
    req.headers["authorization"].toLowerCase().startsWith("basic")) 
    || (req.body?.api_key && req.body?.api_secret)
  ) {
    const token = req.headers["authorization"] || `Basic ${Buffer.from(`${req.body.api_key}:${req.body.api_secret}`).toString("base64")}`;

    // if the cached exists
    const state = neru.getInstanceState();
    try {
      const cached = process.env.cached_basic_authorization || await state.get("cached_basic_authorization");
      if (cached && cached === token) return next();
      else if (cached) {
        throw new Error("Check your api key and secret");
      }
    } catch (e) {
      console.log(e.message);
    }

    // this is an alternative check for basic auth, based on .neru-cli api key and secret in the neru instance
    try {
      let result = await verifyAuthorization(token);
      if (result) {
        try {
          await state.set("cached_basic_authorization", token);
          await state.expire("cached_basic_authorization", 86400);
          process.env.cached_basic_authorization = token;
        } catch (e) {
          console.log(e.message);
        }
         
        return next();
      }
      else throw new Error("Invalid api key and secret");
    } catch (e) {
      console.log(e.message, token);
      return next(new createError(401, "Unauthorized"));
    }

  } else {
    console.log(JSON.stringify(req.headers), JSON.stringify(req.body), JSON.stringify(req.query));
    return next(new createError(401, "Unauthorized"));
  }
}

