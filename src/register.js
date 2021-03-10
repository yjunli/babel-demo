require("@babel/register");
require("./index.js");

const arrSet = [...new Set([1, 2, 2, 1, 3, 4, 5, 3, 2, 1, 4])];

const mySymbol = Symbol("myDescription");
console.log(mySymbol); // Symbol(myDescription)
console.log(mySymbol.toString()); // Symbol(myDescription)
console.log(mySymbol.description); // myDescription

const testObj = {
  a: arrSet,
  b: { c: arrSet },
  d: mySymbol,
};
console.log(testObj.b.c || arrSet);
