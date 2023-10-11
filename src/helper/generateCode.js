export function generateRandomNumber() {
 const min = 10 ** (6 - 1);
 const max = 10 ** 6 - 1;
 return Math.floor(Math.random() * (max - min + 1)) + min;
}