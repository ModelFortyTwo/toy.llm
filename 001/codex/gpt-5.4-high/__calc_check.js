
    const keyLayout = [
      [
        { label: "SHIFT", secondary: "", action: "toggle-shift", theme: "accent" },
        { label: "HYP", secondary: "", action: "toggle-hyp", theme: "dark" },
        { label: "MODE", secondary: "", action: "mode", theme: "dark" },
        { label: "DEL", secondary: "", action: "delete", theme: "dark" },
        { label: "AC", secondary: "", action: "clear", theme: "danger" }
      ],
      [
        { label: "MC", secondary: "", action: "memory-clear", theme: "dark" },
        { label: "MR", secondary: "M", action: "memory-recall", theme: "dark" },
        { label: "M+", secondary: "", action: "memory-add", theme: "dark" },
        { label: "M-", secondary: "", action: "memory-subtract", theme: "dark" },
        { label: "Ans", secondary: "", action: "insert", value: "Ans", theme: "dark" }
      ],
      [
        { label: "sin", secondary: "sin⁻¹", action: "function", value: "sin", shiftValue: "asin" },
        { label: "cos", secondary: "cos⁻¹", action: "function", value: "cos", shiftValue: "acos" },
        { label: "tan", secondary: "tan⁻¹", action: "function", value: "tan", shiftValue: "atan" },
        { label: "(", secondary: "", action: "insert", value: "(" },
        { label: ")", secondary: "", action: "insert", value: ")" }
      ],
      [
        { label: "log", secondary: "10ˣ", action: "function", value: "log", shiftValue: "pow10" },
        { label: "ln", secondary: "eˣ", action: "function", value: "ln", shiftValue: "exp" },
        { label: "xʸ", secondary: "", action: "insert", value: "^" },
        { label: "x²", secondary: "", action: "function", value: "sq" },
        { label: "√", secondary: "", action: "function", value: "sqrt" }
      ],
      [
        { label: "7", secondary: "", action: "insert", value: "7" },
        { label: "8", secondary: "", action: "insert", value: "8" },
        { label: "9", secondary: "", action: "insert", value: "9" },
        { label: "÷", secondary: "", action: "insert", value: "/" },
        { label: "x!", secondary: "", action: "insert", value: "!" }
      ],
      [
        { label: "4", secondary: "", action: "insert", value: "4" },
        { label: "5", secondary: "", action: "insert", value: "5" },
        { label: "6", secondary: "", action: "insert", value: "6" },
        { label: "×", secondary: "", action: "insert", value: "*" },
        { label: "1/x", secondary: "", action: "function", value: "recip", primaryClass: "small" }
      ],
      [
        { label: "1", secondary: "", action: "insert", value: "1" },
        { label: "2", secondary: "", action: "insert", value: "2" },
        { label: "3", secondary: "", action: "insert", value: "3" },
        { label: "-", secondary: "", action: "insert", value: "-" },
        { label: "EXP", secondary: "", action: "insert", value: "E", theme: "dark" }
      ],
      [
        { label: "0", secondary: "π", action: "insert", value: "0", shiftValue: "pi" },
        { label: ".", secondary: "e", action: "insert", value: ".", shiftValue: "e" },
        { label: "+/-", secondary: "", action: "sign-toggle", primaryClass: "small" },
        { label: "+", secondary: "", action: "insert", value: "+" },
        { label: "=", secondary: "", action: "evaluate", theme: "accent" }
      ]
    ];

    const expressionEl = document.getElementById("expression");
    const resultEl = document.getElementById("result");
    const keypadEl = document.getElementById("keypad");
    const statusEls = {
      shift: document.querySelector('[data-status="shift"]'),
      hyp: document.querySelector('[data-status="hyp"]'),
      memory: document.querySelector('[data-status="memory"]'),
      angle: document.querySelector('[data-status="angle"]')
    };

    const state = {
      expression: "",
      answer: 0,
      memory: 0,
      shift: false,
      hyp: false,
      justEvaluated: false,
      angleIndex: 0,
      lastError: false
    };

    const angleModes = ["DEG", "RAD", "GRAD"];
    const functionsNeedingMode = new Set(["sin", "cos", "tan", "asin", "acos", "atan"]);
    const hyperbolicMap = {
      sin: "sinh",
      cos: "cosh",
      tan: "tanh",
      asin: "asinh",
      acos: "acosh",
      atan: "atanh"
    };

    function renderKeys() {
      keypadEl.innerHTML = "";
      keyLayout.flat().forEach((key) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "key";
        if (key.theme === "dark") button.classList.add("key--dark");
        if (key.theme === "accent") button.classList.add("key--accent");
        if (key.theme === "danger") button.classList.add("key--danger");
        button.dataset.action = key.action;
        if (key.value) button.dataset.value = key.value;
        if (key.shiftValue) button.dataset.shiftValue = key.shiftValue;

        const secondary = document.createElement("span");
        secondary.className = "key__secondary";
        secondary.textContent = key.secondary || "";

        const primary = document.createElement("span");
        primary.className = "key__primary";
        if (key.primaryClass) primary.classList.add(key.primaryClass);
        primary.textContent = key.label;

        button.appendChild(secondary);
        button.appendChild(primary);
        keypadEl.appendChild(button);
      });
    }

    function updateDisplay() {
      expressionEl.textContent = formatExpressionForDisplay(state.expression) || " ";
      resultEl.textContent = state.lastError ? "Math ERROR" : "0";
      if (!state.lastError) {
        resultEl.textContent = state.expression ? previewResult() : formatNumber(state.answer || 0);
        if (state.justEvaluated && state.expression) {
          resultEl.textContent = formatNumber(state.answer);
        }
      }

      statusEls.shift.classList.toggle("active", state.shift);
      statusEls.hyp.classList.toggle("active", state.hyp);
      statusEls.memory.classList.toggle("active", Math.abs(state.memory) > Number.EPSILON);
      statusEls.angle.textContent = angleModes[state.angleIndex];
      statusEls.angle.classList.add("active");
    }

    function previewResult() {
      try {
        const value = evaluateExpression(state.expression);
        return formatNumber(value);
      } catch {
        return state.justEvaluated ? formatNumber(state.answer) : "0";
      }
    }

    function formatExpressionForDisplay(expression) {
      return expression
        .replace(/\*/g, "×")
        .replace(/\//g, "÷")
        .replace(/\^/g, "^")
        .replace(/pi/g, "π");
    }

    function formatNumber(value) {
      if (!Number.isFinite(value)) {
        throw new Error("Invalid number");
      }
      if (Object.is(value, -0)) value = 0;
      if (Math.abs(value) < 1e-12) value = 0;
      const abs = Math.abs(value);
      if (abs !== 0 && (abs >= 1e12 || abs < 1e-9)) {
        return value.toExponential(10).replace("e", "E").replace(/\.?0+E/, "E");
      }
      return Number.parseFloat(value.toPrecision(12)).toString();
    }

    function cycleMode() {
      state.angleIndex = (state.angleIndex + 1) % angleModes.length;
      state.shift = false;
      state.hyp = false;
      updateDisplay();
    }

    function clearAll() {
      state.expression = "";
      state.lastError = false;
      state.justEvaluated = false;
      state.shift = false;
      state.hyp = false;
      updateDisplay();
    }

    function deleteLast() {
      if (state.justEvaluated || state.lastError) {
        state.expression = "";
        state.lastError = false;
        state.justEvaluated = false;
        updateDisplay();
        return;
      }
      state.expression = state.expression.slice(0, -1);
      updateDisplay();
    }

    function shouldInsertMultiply(nextValue) {
      if (!state.expression) return false;
      const previous = state.expression[state.expression.length - 1];
      const previousEndsOperand = /[\d.)!]/.test(previous) || /[A-Za-z]/.test(previous);
      const nextStartsOperand = /^[A-Za-z(]/.test(nextValue);
      return previousEndsOperand && nextStartsOperand;
    }

    function insertValue(rawValue) {
      state.lastError = false;

      if (state.justEvaluated) {
        if (/^[+\-*/^!]/.test(rawValue)) {
          state.expression = formatNumber(state.answer);
        } else {
          state.expression = "";
        }
        state.justEvaluated = false;
      }

      let value = rawValue;
      if (state.shift && rawValue === "0") value = "pi";
      if (state.shift && rawValue === ".") value = "e";

      if (value === "." && !canAppendDecimal()) {
        consumeOneShotModes();
        updateDisplay();
        return;
      }

      if (value === "E" && !canAppendExponent()) {
        consumeOneShotModes();
        updateDisplay();
        return;
      }

      if (shouldInsertMultiply(value)) {
        state.expression += "*";
      }

      state.expression += value;
      consumeOneShotModes();
      updateDisplay();
    }

    function canAppendDecimal() {
      const segment = getCurrentNumberSegment();
      return !segment.includes(".") && !/[A-Za-z)]$/.test(state.expression);
    }

    function canAppendExponent() {
      const segment = getCurrentNumberSegment();
      return /[0-9.]$/.test(state.expression) && !/[Ee]/.test(segment);
    }

    function getCurrentNumberSegment() {
      const match = state.expression.match(/([0-9.]+(?:E[+\-]?[0-9]*)?)$/);
      return match ? match[1] : "";
    }

    function insertFunction(name) {
      state.lastError = false;
      let fnName = state.shift ? (eventShiftValue(name) || name) : name;
      if (state.hyp && hyperbolicMap[fnName]) {
        fnName = hyperbolicMap[fnName];
      }

      if (state.justEvaluated) {
        state.expression = "";
        state.justEvaluated = false;
      }

      if (shouldInsertMultiply(fnName)) {
        state.expression += "*";
      }

      state.expression += `${fnName}(`;
      consumeOneShotModes();
      updateDisplay();
    }

    function eventShiftValue(name) {
      const button = [...keypadEl.querySelectorAll(".key")].find(
        (key) => key.dataset.value === name || key.dataset.shiftValue === name
      );
      return button?.dataset.shiftValue || null;
    }

    function consumeOneShotModes() {
      state.shift = false;
      state.hyp = false;
    }

    function toggleSign() {
      state.lastError = false;
      if (!state.expression) {
        state.expression = "-";
        state.justEvaluated = false;
        updateDisplay();
        return;
      }

      if (state.justEvaluated) {
        state.answer = -state.answer;
        state.expression = formatNumber(state.answer);
        state.justEvaluated = true;
        updateDisplay();
        return;
      }

      const bounds = findTrailingOperand(state.expression);
      if (!bounds) {
        state.expression += "-";
        updateDisplay();
        return;
      }

      const [start, end] = bounds;
      const operand = state.expression.slice(start, end);
      if (operand.startsWith("neg(") && operand.endsWith(")")) {
        state.expression = state.expression.slice(0, start) + operand.slice(4, -1) + state.expression.slice(end);
      } else {
        state.expression = state.expression.slice(0, start) + `neg(${operand})` + state.expression.slice(end);
      }
      updateDisplay();
    }

    function findTrailingOperand(expression) {
      if (!expression) return null;
      let end = expression.length;
      let index = end - 1;

      if (expression[index] === ")") {
        let depth = 1;
        index -= 1;
        while (index >= 0 && depth > 0) {
          if (expression[index] === ")") depth += 1;
          if (expression[index] === "(") depth -= 1;
          index -= 1;
        }
        while (index >= 0 && /[A-Za-z]/.test(expression[index])) {
          index -= 1;
        }
        return [index + 1, end];
      }

      if (expression[index] === "!") {
        index -= 1;
        while (index >= 0 && /[\w.)]/.test(expression[index])) {
          index -= 1;
        }
        return [index + 1, end];
      }

      while (index >= 0 && /[\w.]/.test(expression[index])) {
        index -= 1;
      }
      return index === end - 1 ? null : [index + 1, end];
    }

    function evaluateCurrentExpression() {
      if (!state.expression) return;
      try {
        const value = evaluateExpression(state.expression);
        state.answer = value;
        state.expression = formatNumber(value);
        state.justEvaluated = true;
        state.lastError = false;
      } catch {
        state.lastError = true;
        state.justEvaluated = false;
      }
      consumeOneShotModes();
      updateDisplay();
    }

    function tryResolveCurrentValue() {
      if (state.lastError) return null;
      if (!state.expression) return state.answer;
      try {
        return evaluateExpression(state.expression);
      } catch {
        return null;
      }
    }

    function memoryClear() {
      state.memory = 0;
      consumeOneShotModes();
      updateDisplay();
    }

    function memoryRecall() {
      state.lastError = false;
      if (state.justEvaluated) {
        state.expression = "";
        state.justEvaluated = false;
      }
      const memoryValue = formatNumber(state.memory);
      if (shouldInsertMultiply(memoryValue)) {
        state.expression += "*";
      }
      state.expression += memoryValue;
      consumeOneShotModes();
      updateDisplay();
    }

    function memoryAdd(direction) {
      const value = tryResolveCurrentValue();
      if (value === null) {
        state.lastError = true;
      } else {
        state.memory += direction * value;
        state.lastError = false;
      }
      consumeOneShotModes();
      updateDisplay();
    }

    function handleKeyPress(action, button) {
      switch (action) {
        case "toggle-shift":
          state.shift = !state.shift;
          state.hyp = false;
          updateDisplay();
          return;
        case "toggle-hyp":
          state.hyp = !state.hyp;
          state.shift = false;
          updateDisplay();
          return;
        case "mode":
          cycleMode();
          return;
        case "clear":
          clearAll();
          return;
        case "delete":
          deleteLast();
          return;
        case "memory-clear":
          memoryClear();
          return;
        case "memory-recall":
          memoryRecall();
          return;
        case "memory-add":
          memoryAdd(1);
          return;
        case "memory-subtract":
          memoryAdd(-1);
          return;
        case "sign-toggle":
          toggleSign();
          return;
        case "evaluate":
          evaluateCurrentExpression();
          return;
        case "function":
          insertFunction(state.shift && button.dataset.shiftValue ? button.dataset.shiftValue : button.dataset.value);
          return;
        case "insert":
          insertValue(state.shift && button.dataset.shiftValue ? button.dataset.shiftValue : button.dataset.value);
          return;
        default:
          return;
      }
    }

    function tokenize(input) {
      const tokens = [];
      let index = 0;

      while (index < input.length) {
        const char = input[index];
        if (/\s/.test(char)) {
          index += 1;
          continue;
        }

        if (/\d|\./.test(char)) {
          const match = input.slice(index).match(/^\d*\.?\d+(?:E[+\-]?\d+)?/);
          if (!match) throw new Error("Invalid number");
          tokens.push({ type: "number", value: Number(match[0]) });
          index += match[0].length;
          continue;
        }

        if (/[A-Za-z]/.test(char)) {
          const match = input.slice(index).match(/^[A-Za-z]+/);
          tokens.push({ type: "identifier", value: match[0] });
          index += match[0].length;
          continue;
        }

        if ("+-*/^()!".includes(char)) {
          tokens.push({ type: "operator", value: char });
          index += 1;
          continue;
        }

        throw new Error("Unexpected token");
      }

      return tokens;
    }

    function evaluateExpression(expression) {
      const balanced = balanceParentheses(expression);
      const tokens = tokenize(balanced);
      let position = 0;

      function peek() {
        return tokens[position];
      }

      function consume(expected) {
        const token = tokens[position];
        if (!token || (expected && token.value !== expected)) {
          throw new Error("Syntax error");
        }
        position += 1;
        return token;
      }

      function parseExpression() {
        let value = parseTerm();
        while (peek() && (peek().value === "+" || peek().value === "-")) {
          const operator = consume().value;
          const next = parseTerm();
          value = operator === "+" ? value + next : value - next;
        }
        return value;
      }

      function parseTerm() {
        let value = parsePower();
        while (peek() && (peek().value === "*" || peek().value === "/")) {
          const operator = consume().value;
          const next = parsePower();
          if (operator === "*") value *= next;
          if (operator === "/") value /= next;
        }
        return value;
      }

      function parsePower() {
        let value = parseUnary();
        if (peek() && peek().value === "^") {
          consume("^");
          value = Math.pow(value, parsePower());
        }
        return value;
      }

      function parseUnary() {
        if (peek() && (peek().value === "+" || peek().value === "-")) {
          const operator = consume().value;
          const value = parseUnary();
          return operator === "-" ? -value : value;
        }
        return parsePostfix();
      }

      function parsePostfix() {
        let value = parsePrimary();
        while (peek() && peek().value === "!") {
          consume("!");
          value = factorial(value);
        }
        return value;
      }

      function parsePrimary() {
        const token = peek();
        if (!token) throw new Error("Unexpected end");

        if (token.type === "number") {
          consume();
          return token.value;
        }

        if (token.type === "identifier") {
          consume();
          if (peek() && peek().value === "(") {
            consume("(");
            const argument = parseExpression();
            consume(")");
            return applyFunction(token.value, argument);
          }
          return resolveIdentifier(token.value);
        }

        if (token.value === "(") {
          consume("(");
          const value = parseExpression();
          consume(")");
          return value;
        }

        throw new Error("Syntax error");
      }

      const value = parseExpression();
      if (position !== tokens.length) throw new Error("Trailing tokens");
      if (!Number.isFinite(value)) throw new Error("Math error");
      return value;
    }

    function balanceParentheses(expression) {
      let balance = 0;
      let output = expression;
      for (const char of expression) {
        if (char === "(") balance += 1;
        if (char === ")" && balance > 0) balance -= 1;
      }
      while (balance > 0) {
        output += ")";
        balance -= 1;
      }
      return output;
    }

    function resolveIdentifier(name) {
      if (name === "pi") return Math.PI;
      if (name === "e") return Math.E;
      if (name === "Ans") return state.answer;
      throw new Error("Unknown identifier");
    }

    function applyFunction(name, value) {
      switch (name) {
        case "sin":
          return Math.sin(toRadians(value));
        case "cos":
          return Math.cos(toRadians(value));
        case "tan":
          return Math.tan(toRadians(value));
        case "asin":
          return fromRadians(Math.asin(value));
        case "acos":
          return fromRadians(Math.acos(value));
        case "atan":
          return fromRadians(Math.atan(value));
        case "sinh":
          return Math.sinh(value);
        case "cosh":
          return Math.cosh(value);
        case "tanh":
          return Math.tanh(value);
        case "asinh":
          return Math.asinh(value);
        case "acosh":
          return Math.acosh(value);
        case "atanh":
          return Math.atanh(value);
        case "log":
          return Math.log10(value);
        case "ln":
          return Math.log(value);
        case "pow10":
          return Math.pow(10, value);
        case "exp":
          return Math.exp(value);
        case "sqrt":
          return Math.sqrt(value);
        case "sq":
          return value * value;
        case "recip":
          return 1 / value;
        case "neg":
          return -value;
        default:
          throw new Error("Unknown function");
      }
    }

    function toRadians(value) {
      switch (angleModes[state.angleIndex]) {
        case "DEG":
          return value * Math.PI / 180;
        case "GRAD":
          return value * Math.PI / 200;
        default:
          return value;
      }
    }

    function fromRadians(value) {
      switch (angleModes[state.angleIndex]) {
        case "DEG":
          return value * 180 / Math.PI;
        case "GRAD":
          return value * 200 / Math.PI;
        default:
          return value;
      }
    }

    function factorial(value) {
      if (!Number.isInteger(value) || value < 0 || value > 170) {
        throw new Error("Factorial out of range");
      }
      let result = 1;
      for (let i = 2; i <= value; i += 1) {
        result *= i;
      }
      return result;
    }

    keypadEl.addEventListener("click", (event) => {
      const button = event.target.closest(".key");
      if (!button) return;
      handleKeyPress(button.dataset.action, button);
    });

    window.addEventListener("keydown", (event) => {
      const keyMap = {
        Enter: () => evaluateCurrentExpression(),
        "=": () => evaluateCurrentExpression(),
        Backspace: () => deleteLast(),
        Escape: () => clearAll(),
        Delete: () => clearAll(),
        "^": () => insertValue("^"),
        "*": () => insertValue("*"),
        "/": () => insertValue("/"),
        "+": () => insertValue("+"),
        "-": () => insertValue("-"),
        "(": () => insertValue("("),
        ")": () => insertValue(")"),
        ".": () => insertValue("."),
        "!": () => insertValue("!")
      };

      if (/^\d$/.test(event.key)) {
        insertValue(event.key);
        return;
      }

      if (keyMap[event.key]) {
        event.preventDefault();
        keyMap[event.key]();
      }
    });

    renderKeys();
    updateDisplay();
  
