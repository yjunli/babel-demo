const babelParser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const types = require("@babel/types");
const template = require("@babel/template").default;

const code = `function mirror(something) {
  return something
}`;

const parserRes = babelParser.parse(code, { sourceType: "module" });

console.log(parserRes.errors, parserRes.program.body);

/** ------------------------- traverse --------------------------------- */
// traverse(parserRes, {
//   // 访问者模式
//   Identifier(path) {
//     console.log(path.node.name);
//   },
// });

/** ------------------------- generate --------------------------------- */
// const transformedCode = generate(parserRes).code;
// // code -> ast
// console.log(transformedCode);

/** ------------------------- types --------------------------------- */
// 修改节点

// // 节点判断
// const visitor = {
//   // 进入节点回调函数
//   enter(path) {
//     if (types.isIdentifier(path.node)) {
//       console.log("Identifier!");
//     }
//   },
// };
// traverse(parserRes, visitor);

// 生成新的节点
// const strNode = types.stringLiteral("mirror");
// const visitor = {
//   ReturnStatement(path) {
//     path.traverse({
//       Identifier(cpath) {
//         cpath.replaceWith(strNode);
//       },
//     });
//   },
// };
// traverse(parserRes, visitor);
// const transformedCode = generate(parserRes).code;
// console.log(transformedCode);

/** ------------------------- template --------------------------------- */
const visitor = {
  FunctionDeclaration(path) {
    // 模版
    const temp = template(`
      if(something) {
        NORMAL_RETURN
      } else {
        return 'nothing'
      }
    `);
    const returnNode = path.node.body.body[0];
    const tempAst = temp({
      NORMAL_RETURN: returnNode,
    });
    path.node.body.body[0] = tempAst;
  },
};
traverse(parserRes, visitor);
const transformedCode = generate(parserRes).code;
console.log(transformedCode);
