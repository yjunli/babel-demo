import { declare } from "@babel/helper-plugin-utils";
// 透明表达式包装器是一个AST节点，大多数插件都希望跳过它，因为它的存在不会影响代码的行为。这包括用于类型的表达式和额外的括号。例如，在(a as any)()中，可以使用此助手在确定被调用者时跳过TSAsExpression。
import {
  isTransparentExprWrapper,
  skipTransparentExprWrappers,
} from "@babel/helper-skip-transparent-expression-wrappers";
import syntaxOptionalChaining from "@babel/plugin-syntax-optional-chaining";
import { types as t, template } from "@babel/core";
import {
  willPathCastToBoolean,
  findOutermostTransparentParent,
} from "./util.js";

const { ast } = template.expression;

// const obj = {
//   foo: {
//     bar: {}
//   },
// };

// const ret = delete obj?.foo?.bar?.baz; // true

export default declare((api, options) => {
  api.assertVersion(7);

  const { loose = false } = options;
  /**
   * @loose true的时候会当作document.all不存在，将null 和 undefined当作一样的项目来检查
   * in => foo?.bar;
   * loose 为true
   * out => foo == null ? void 0 : foo.bar;
   * loose 为false
   * foo === null || foo === void 0 ? void 0 : foo.bar;
   */
  // 参数 loose 为true的时候 会加入null的判断
  const noDocumentAll = api.assumption("noDocumentAll") ?? loose;
  const pureGetters = api.assumption("pureGetters") ?? loose;

  function isSimpleMemberExpression(expression) {
    expression = skipTransparentExprWrappers(expression);
    return (
      t.isIdentifier(expression) ||
      t.isSuper(expression) ||
      (t.isMemberExpression(expression) &&
        !expression.computed &&
        isSimpleMemberExpression(expression.object))
    );
  }

  /**
   * Test if a given optional chain `path` needs to be memoized
   * @param {NodePath} path
   * @returns {boolean}
   */
  function needsMemoize(path) {
    let optionalPath = path;
    const { scope } = path;
    while (
      optionalPath.isOptionalMemberExpression() ||
      optionalPath.isOptionalCallExpression()
    ) {
      const { node } = optionalPath;
      const childKey = optionalPath.isOptionalMemberExpression()
        ? "object"
        : "callee";
      const childPath = skipTransparentExprWrappers(optionalPath.get(childKey));
      if (node.optional) {
        return !scope.isStatic(childPath.node);
      }

      optionalPath = childPath;
    }
  }

  return {
    name: "proposal-optional-chaining",
    inherits: syntaxOptionalChaining,

    visitor: {
      "OptionalCallExpression|OptionalMemberExpression"(path) {
        const { scope } = path;
        // maybeWrapped points to the outermost transparent expression wrapper
        // or the path itself
        // 关注命名---maybeWrapper 含义精确
        const maybeWrapped = findOutermostTransparentParent(path);
        // 找到最外层的node path 可以理解为根节点
        const { parentPath } = maybeWrapped;
        // `if (a?.b) {}` transformed to `if (a != null && a.b) {}`
        // 是否能转换成布尔值 如果可以 简单判断
        const willReplacementCastToBoolean = willPathCastToBoolean(
          maybeWrapped
        );
        let isDeleteOperation = false;
        // 判断父级元素是否为调用表达式
        const parentIsCall =
          parentPath.isCallExpression({ callee: maybeWrapped.node }) &&
          // note that the first condition must implies that `path.optional` is `true`,
          // otherwise the parentPath should be an OptionalCallExpressioin
          path.isOptionalMemberExpression();

        const optionals = [];

        let optionalPath = path;
        // Replace `function (a, x = a.b?.c) {}` to `function (a, x = (() => a.b?.c)() ){}`
        // so the temporary variable can be injected in correct scope
        if (scope.path.isPattern() && needsMemoize(optionalPath)) {
          path.replaceWith(template.ast`(() => ${path.node})()`);
          // The injected optional chain will be queued and eventually transformed when visited
          return;
        }
        while (
          optionalPath.isOptionalMemberExpression() ||
          optionalPath.isOptionalCallExpression()
        ) {
          const { node } = optionalPath;
          if (node.optional) {
            // 将所有"OptionalCallExpression|OptionalMemberExpression"的节点都推入optionals中记录
            optionals.push(node);
          }
          if (optionalPath.isOptionalMemberExpression()) {
            // 修改当前的节点类型 为MemberExpression
            optionalPath.node.type = "MemberExpression";
            // 替换成子节点 继续查找下一个"OptionalCallExpression|OptionalMemberExpression" 节点
            optionalPath = skipTransparentExprWrappers(
              optionalPath.get("object")
            );
          } else if (optionalPath.isOptionalCallExpression()) {
            optionalPath.node.type = "CallExpression";
            optionalPath = skipTransparentExprWrappers(
              optionalPath.get("callee")
            );
          }
        }

        let replacementPath = path;
        // 删除一元表达式  e.g. delete a?.b?.c
        if (parentPath.isUnaryExpression({ operator: "delete" })) {
          replacementPath = parentPath;
          isDeleteOperation = true;
        }

        for (let i = optionals.length - 1; i >= 0; i--) {
          const node = optionals[i];

          // 是否是调用表达式
          const isCall = t.isCallExpression(node);
          const replaceKey = isCall ? "callee" : "object";

          const chainWithTypes = node[replaceKey];
          let chain = chainWithTypes;

          // 判断是否有透明的、无用的wrapper e.g. (a?.b)?.c
          while (isTransparentExprWrapper(chain)) {
            chain = chain.expression;
          }

          let ref;
          let check;
          // 处理eval
          if (isCall && t.isIdentifier(chain, { name: "eval" })) {
            check = ref = chain;
            // `eval?.()` is an indirect eval call transformed to `(0,eval)()`
            node[replaceKey] = t.sequenceExpression([t.numericLiteral(0), ref]);
          } else if (pureGetters && isCall && isSimpleMemberExpression(chain)) {
            // If we assume getters are pure (avoiding a Function#call) and we are at the call,
            // we can avoid a needless memoize. We only do this if the callee is a simple member
            // expression, to avoid multiple calls to nested call expressions.
            check = ref = chainWithTypes;
          } else {
            // 判断节点类型 动态节点还是静态节点 静态节点返回null
            /**
             * @静态节点 手动添加创建的 e.g. a.b
             * @动态节点 后台代码实现的数据绑定 e.g. a?.[name]
             */
            ref = scope.maybeGenerateMemoised(chain);
            // 动态节点
            if (ref) {
              // 构成赋值表达式
              check = t.assignmentExpression(
                "=",
                t.cloneNode(ref), // 克隆动态节点
                // Here `chainWithTypes` MUST NOT be cloned because it could be
                // updated when generating the memoised context of a call
                // expression
                chainWithTypes
              );

              // 原来的属性值替换成动态应用节点
              node[replaceKey] = ref;
            } else {
              // 静态节点直接赋值
              check = ref = chainWithTypes;
            }
          }

          // Ensure call expressions have the proper `this`
          // `foo.bar()` has context `foo`.
          if (isCall && t.isMemberExpression(chain)) {
            if (pureGetters && isSimpleMemberExpression(chain)) {
              // To avoid a Function#call, we can instead re-grab the property from the context object.
              // `a.?b.?()` translates roughly to `_a.b != null && _a.b()`
              node.callee = chainWithTypes;
            } else {
              // Otherwise, we need to memoize the context object, and change the call into a Function#call.
              // `a.?b.?()` translates roughly to `(_b = _a.b) != null && _b.call(_a)`
              const { object } = chain;
              let context = scope.maybeGenerateMemoised(object);
              if (context) {
                chain.object = t.assignmentExpression("=", context, object);
              } else if (t.isSuper(object)) {
                context = t.thisExpression();
              } else {
                context = object;
              }

              node.arguments.unshift(t.cloneNode(context));
              node.callee = t.memberExpression(
                node.callee,
                t.identifier("call")
              );
            }
          }
          let replacement = replacementPath.node;
          // Ensure (a?.b)() has proper `this`
          // The `parentIsCall` is constant within loop, we should check i === 0
          // to ensure that it is only applied to the first optional chain element
          // i.e. `?.b` in `(a?.b.c)()`
          if (i === 0 && parentIsCall) {
            // `(a?.b)()` to `(a == null ? undefined : a.b.bind(a))()`
            const object = skipTransparentExprWrappers(
              replacementPath.get("object")
            ).node;
            let baseRef;
            if (!pureGetters || !isSimpleMemberExpression(object)) {
              // memoize the context object when getters are not always pure
              // or the object is not a simple member expression
              // `(a?.b.c)()` to `(a == null ? undefined : (_a$b = a.b).c.bind(_a$b))()`
              baseRef = scope.maybeGenerateMemoised(object);
              if (baseRef) {
                replacement.object = t.assignmentExpression(
                  "=",
                  baseRef,
                  object
                );
              }
            }
            replacement = t.callExpression(
              t.memberExpression(replacement, t.identifier("bind")),
              [t.cloneNode(baseRef ?? object)]
            );
          }

          if (willReplacementCastToBoolean) {
            // `if (a?.b) {}` transformed to `if (a != null && a.b) {}`
            // we don't need to return `void 0` because the returned value will
            // eveutally cast to boolean.
            const nonNullishCheck = noDocumentAll
              ? ast`${t.cloneNode(check)} != null`
              : ast`
            ${t.cloneNode(check)} !== null && ${t.cloneNode(ref)} !== void 0`;
            replacementPath.replaceWith(
              t.logicalExpression("&&", nonNullishCheck, replacement)
            );
            replacementPath = skipTransparentExprWrappers(
              replacementPath.get("right")
            );
          } else {
            const nullishCheck = noDocumentAll
              ? ast`${t.cloneNode(check)} == null`
              : ast`
            ${t.cloneNode(check)} === null || ${t.cloneNode(ref)} === void 0`;

            // 如果删除表达式 可以直接返回true
            const returnValue = isDeleteOperation ? ast`true` : ast`void 0`;
            replacementPath.replaceWith(
              t.conditionalExpression(nullishCheck, returnValue, replacement)
            );
            replacementPath = skipTransparentExprWrappers(
              replacementPath.get("alternate")
            );
          }
        }
      },
    },
  };
});
