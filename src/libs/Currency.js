const numeral = require("numeral");
numeral.defaultFormat("$0,0.00");

class Currency {
  constructor(input, balance = null) {
    if (input instanceof Currency) {
      Object.assign(this, input);
    } else {
      this.input = input;
      this.allIn = String(this.input).toLowerCase() === "all";
    }

    this.balance = balance;
  }

  get value() {
    const input = this.allIn ? this.balance : this.input;
    return numeral(input).value();
  }

  get formatted() {
    const input = this.allIn ? this.balance : this.input;
    return Currency.format(input);
  }

  get validity() {
    if (this.value <= 0) {
      return { code: "negative_or_zero", message: "Amount must be greater than $0.00!" };
    }

    if (this.value > this.balance) {
      return {
        code: "insufficient_balance",
        message: `Insufficient balance! Your balance is ${Currency.format(this.balance)}.`,
      };
    }

    return { code: "valid", message: "Valid" };
  }

  static format(inputValue) {
    if (inputValue instanceof Currency) return inputValue.formatted;
    return numeral(inputValue).format();
  }

  isEqual(inputValue) {
    if (inputValue instanceof Currency) return this.value === inputValue.value;
    return this.value === numeral(inputValue).value();
  }
}

module.exports = Currency;
