import CryptoJS from "crypto-js";

export function comparePasswords(encryptedPassword, plainTextPassword, hashingKey) {
 const decryptedPassword = CryptoJS.AES.decrypt(encryptedPassword, hashingKey).toString(CryptoJS.enc.Utf8);
 return decryptedPassword === plainTextPassword;
}