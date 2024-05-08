import axios from "axios";
import { neru } from "neru-alpha";

const SMS_API_URL = process.env.SMS_API_URL || "https://rest-eu.nexmo.com/sms/json";

export const sendSMS = async (payload, authType = "basic") => {
  try {
    var auth;

    if (authType.toLocaleLowerCase() === "basic") {
      const state = neru.getInstanceState();
      auth = process.env.cached_basic_authorization || await state.get("cached_basic_authorization");
    } else {
      let exp = Math.floor((new Date()).getTime() / 1000) + 900;
      let token = neru.createVonageToken({ exp });
      auth = `Bearer ${token}`;
    }

    const headers = { 
      "Content-Type": "application/json",
      "Authorization": auth
    };

    if (payload.client_ref) payload["client-ref"] = payload.client_ref;

    const { data } = await axios.post(SMS_API_URL, payload, { headers });
    const { messages } = data;
    
    if (messages[0]["status"] != "0" || messages[0]["error-text"]) {
      throw new Error(`${messages[0]["status"]}#${messages[0]["error-text"]}`);
    }

    return data;
  } catch (e) {
    console.log(e.message);
    throw new Error(`Failed to sendSMS: ${e.message}`);
  }
};