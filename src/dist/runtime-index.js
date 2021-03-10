"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");

var _set = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/set"));

var _symbol = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/symbol"));

var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/toConsumableArray"));

// import "core-js";
// import "regenerator-runtime/runtime.js";
var arrSet = (0, _toConsumableArray2["default"])(new _set["default"]([1, 2, 2, 1, 3, 4, 5, 3, 2, 1, 4]));
var mySymbol = (0, _symbol["default"])("myDescription");
console.log(mySymbol); // Symbol(myDescription)

console.log(mySymbol.toString()); // Symbol(myDescription)

console.log(mySymbol.description); // myDescription

var testObj = {
  a: arrSet,
  b: {
    c: arrSet
  },
  d: mySymbol
};
console.log(testObj.b.c || arrSet);
