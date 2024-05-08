import { v4 as uuidv4 } from "uuid";

export function addRequestId(req, res, next) {
  try {
    req.requestId = uuidv4();
  } catch (e) {
    console.error("Could not add a requestId.");
  }
  next();
}
