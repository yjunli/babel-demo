var babel = require("@babel/core");
const fs = require("fs");

babel.transformFile(
  "main.js",
  {
    ast: true,
    auxiliaryCommentAfter: true,
    sourceMaps: true,
    code: true,
    caller: {
      name: "my-custom-tool",
      supportsStaticESM: true,
    },
  },
  function (err, result) {
    console.log(result, "result.code, result.map, result.ast");
  }
);

// // // 文件转码（同步）
// babel.transformFileSync("./main.js", {});
// // => { code, map, ast }

// // Babel AST转码
// const sourceCode = "if (true) return;";
// const parsedAst = babel.parseSync(sourceCode, {
//   parserOpts: { allowReturnOutsideFunction: true },
// });
// babel.transformFromAst(parsedAst, sourceCode, {}, function (err, result) {
//   const { code, map, ast } = result;
//   console.log("code, map, ast", code, map, ast);
// });
