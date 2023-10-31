import jwt from "jsonwebtoken";
import CryptoJS from "crypto-js";


export function createToken(data) {
 const token = jwt.sign(data, process.env.SECRET_KEY);
 const hasingToken = CryptoJS.AES.encrypt(token, process.env.HASING_KEY).toString();
 return hasingToken;
}

function authProtocol(token, duration, KEY) {
 const result = { status: 401, message: "", user: {} };
 if (!token) {
  result.message = "UNAUTHORIZED";
 } else {
  try {
   result.user = jwt.verify(token, KEY);
   if (result.user.iat !== undefined && (Date.now() / 1000) - result.user.iat > duration) {
    result.status = 403;
    result.message = "TOKEN EXPIRED";
   } else {
    result.status = 200;
   }
  } catch (error) {
   result.message = "INVALID TOKEN";
   result.error = error;
  }
 }
 return result;
}


function getDaysInMonth(year, month) {
 return new Date(year, month + 1, 0).getDate();
}

export function authToken(token) {

 const secretKey = process.env.SECRET_KEY;

 // const today = new Date();
 // const year = today.getFullYear();
 // const month = today.getMonth();
 // const daysInMonth = getDaysInMonth(year, month);
 // const currentDate = today.getDate();
 // const remainingDays = daysInMonth - currentDate;
 const expiresIn = 3600 * 24 * 30;
 const compareToken =  CryptoJS.AES.decrypt(token, process.env.HASING_KEY).toString(CryptoJS.enc.Utf8)

 return authProtocol(compareToken, expiresIn, secretKey);
}