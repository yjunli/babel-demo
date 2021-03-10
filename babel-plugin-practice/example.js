const babelParser = require("@babel/parser");
// const chainPlugin = require("./index");
// const chainPlugin = require("../plugin-proposal-optional-chaining");
const { declare } = require("@babel/helper-plugin-utils");
const { types, template, transform } = require("@babel/core");

const code = `const obj = { a: { b: 1 }, c: 4, d: [3, 4, 5, 6] };
const res = obj?.a?.b?.c;`;
// "OptionalMemberExpression"

// 动态节点
// const code = `const obj = { a: { b: 1 }, c: 4, d: [3, 4, 5, 6] };
// const res = obj?.['a'];`;
// // "OptionalMemberExpression"

// const code = `const obj = { a: { b: 1 }, c: 4, d: [3, 4, 5, 6] };
// const b= obj?.a()`;
// OptionalCallExpression

const parserRes = babelParser.parse(code, { sourceType: "module" });
console.log(parserRes.program.body[1].declarations[0].init);

const chainPlugin = declare((api, options) => {
  const { ast } = template.expression;
  return {
    visitor: {
      OptionalMemberExpression(path) {
        let optionalPath = path;
        const optionals = [];

        while (optionalPath.isOptionalMemberExpression()) {
          const { node } = optionalPath;
          if (node.optional) {
            optionals.push(node);
          }

          optionalPath.node.type = "MemberExpression";
          // Path.get 访问内部属性
          // 获取当前子节点的path 注意不是子node 是子path
          optionalPath = optionalPath.get("object");
        }

        let replacementPath = path;
        for (let i = optionals.length - 1; i >= 0; i--) {
          // 取节点
          const check = optionals[i].object;

          // 生成逻辑表达式 LogicalExpression
          const nullishCheck = ast`${check} === null || ${check} === void 0`;
          const returnValue = ast`void 0`;
          // 替换成三元表达式
          replacementPath.replaceWith(
            // 生成三元表达式 nullishCheck? returnValue: replacementPath.node;
            types.conditionalExpression(
              nullishCheck,
              returnValue,
              replacementPath.node
            )
          );
          replacementPath = replacementPath.get("alternate");
        }
      },
    },
  };
});

const { code: result } = transform(code, {
  plugins: [chainPlugin],
});

console.log("result", result);
