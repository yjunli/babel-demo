require("@babel/register");
require("./index.js");

const arrSet = [...new Set([1, 2, 2, 1, 3, 4, 5, 3, 2, 1, 4])];
const testObj = {
  a: arrSet,
  b: { c: arrSet },
};
console.log(testObj.b.c || arrSet);
// console.log(testObj?.b?.c ?? arrSet);
