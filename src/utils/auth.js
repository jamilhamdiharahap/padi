import jwt from "jsonwebtoken";
import CryptoJS from "crypto-js";

export function createToken(data) {
 const token = jwt.sign(data, process.env.SECRET_KEY);
 const hasingToken = CryptoJS.AES.encrypt(token, process.env.HASING_KEY).toString();
 return hasingToken;
}