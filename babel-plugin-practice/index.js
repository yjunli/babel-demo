// import { moduleExpression } from "@babel/types";

const optionalChainPlugin = () => {
  return {
    name: "proposal-optional-chaining",
    // inherits: syntaxOptionalChaining,

    visitor: {
      OptionalMemberExpression(path) {
        console.log("path", path);
        const nullishCheck = noDocumentAll
          ? ast`${t.cloneNode(check)} == null`
          : ast`
            ${t.cloneNode(check)} === null || ${t.cloneNode(ref)} === void 0`;

        const returnValue = isDeleteOperation ? ast`true` : ast`void 0`;
        replacementPath.replaceWith(
          t.conditionalExpression(nullishCheck, returnValue, replacement)
        );
        replacementPath = skipTransparentExprWrappers(
          replacementPath.get("alternate")
        );
      },
    },
  };
};

module.exports = optionalChainPlugin;
