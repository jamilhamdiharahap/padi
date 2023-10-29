import jwt from "jsonwebtoken";
import CryptoJS from "crypto-js";

export function verifyToken (token, KEY) {
 const compareToken =  CryptoJS.AES.decrypt(token, process.env.HASING_KEY).toString(CryptoJS.enc.Utf8)
 const user = jwt.verify(compareToken, KEY)
 
 return user;
}