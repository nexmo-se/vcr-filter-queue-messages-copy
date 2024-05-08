import { neru } from "neru-alpha";
import { 
  simpleCheckCronExpression, 
  // getEndofInterval, 
} from "./utils.js";

export const DB_TABLENAME_WHITELIST =
  process.env.DB_TABLENAME_WHITELIST || "DB_TABLENAME_WHITELIST";
const FORBIDDEN_WORDS = process.env.FORBIDDEN_WORDS
  ? process.env.FORBIDDEN_WORDS.split(
    process.env.FORBIDDEN_WORDS_DELIMITER || ","
  )
  : [];
const GSM_REGEX =
  process.env.GSM_REGEX ||
  "^[@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!\"#¤%&'()*+,-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà{}^\\[\\]~\\€|\\s\\r\\n\\t]+$";
const GSM_EXTENDED_REGEX = new RegExp(process.env.GSM_EXTENDED_REGEX || "€|\^|\{|\}|\[|\]|~|\|", "g");
const ALLOWED_SMS_LENGTH = process.env.ALLOWED_SMS_LENGTH || 160;

const TIME_WINDOW_ALLOWED =
  process.env.TIME_WINDOW_ALLOWED || "* 10-20 * * 1-5";
// minute(0-59) hour(0-23) date(month 1-31) month(0-11) day(week 0-6)

const MAX_MESSAGES_ALLOWED = process.env.MAX_MESSAGES_ALLOWED || 1;
const MAX_MESSAGES_ALLOWED_PERIOD =
  Number(process.env.MAX_MESSAGES_ALLOWED_PERIOD) || 86400;

// this checks if a phone number is part of the whitelist table
export const isWhitelisted = async (phone) => {
  try {
    const db = neru.getInstanceState();
    const whitelist = await db.hget(DB_TABLENAME_WHITELIST, phone);
    return whitelist !== null && whitelist === "true";
  } catch (e) {
    console.log(
      "Whitelist check error:",
      e.response?.status,
      e.response?.data?.error,
      e.message
    );
    return false;
  }
};

// this checks if a message body contains any unwated words or characters
export const isPassingContentFilter = (messageBody) => {
  try {
    const isContainingBlockedWord = FORBIDDEN_WORDS.some(
      (e) => messageBody.toLowerCase().indexOf(e) !== -1
    );
    return !isContainingBlockedWord;
  } catch (e) {
    console.log(
      "Content filter error:",
      e.response?.status,
      e.response?.data?.error,
      e.message
    );
    return false;
  }
};

// this checks if the message body onyl coantians GSM7 characters
export function isGSMAlphabet(text) {
  var regexp = new RegExp(GSM_REGEX);
  return regexp.test(text);
}

// this checks is the messge is maximum 160 characters lonf, taking into account that special characters of the GSM7 set will take up 2 characters
export const isPassingLengthCheck = (messageBody) => {
  let msgLength = messageBody.length;
  let specialCharDoubleLength = (messageBody.match(GSM_EXTENDED_REGEX) || [])
    .length;
  let totalLength = msgLength + specialCharDoubleLength;
  //console.info("total length: ", totalLength);
  if (totalLength <= ALLOWED_SMS_LENGTH) {
    return true;
  } else {
    return false;
  }
};

export const isPassingTimeWindowCheck = () => {
  const now = new Date();
  const parsed = TIME_WINDOW_ALLOWED.split(" ");
  return (
    simpleCheckCronExpression(parsed[0], now.getUTCMinutes()) &&
    simpleCheckCronExpression(parsed[1], now.getUTCHours()) &&
    simpleCheckCronExpression(parsed[2], now.getUTCDate()) &&
    simpleCheckCronExpression(parsed[3], now.getUTCMonth()) &&
    simpleCheckCronExpression(parsed[4], now.getUTCDay())
  );
};

export const isPassingFrequencyCheck = async (to) => {
  if (!to) throw "empty to number";
  const state = neru.getInstanceState();
  const count = await state.incrby(`messagese_count_v2_${to}`, 1);
  if (count <= MAX_MESSAGES_ALLOWED) {
    // await state.expire(`messagese_count_${to}`, MAX_MESSAGES_ALLOWED_PERIOD);

    // const parsed = TIME_WINDOW_ALLOWED.split(" "); // when using getEndofInterval()
    const now = new Date();
    const endOfToday = new Date(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 
      23, // 23, OR, getEndofInterval(parsed[1], now.getUTCHours(), 23), 
      59, 59, 999
    );

    const ttl = Math.floor((endOfToday.getTime() - now.getTime()) / 1000);
    if (ttl > 0) await state.expire(`messagese_count_v2_${to}`, ttl);
    return true;
  }
  return false;
};
