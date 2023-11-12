import { scheduleTransaction } from "./src/helper/scheduleHelper.js";

export default async function () {
 scheduleTransaction()
 console.log("Scheduled function executed at", new Date().toISOString());
};
