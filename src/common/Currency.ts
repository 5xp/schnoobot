import numeral from "numeral";
numeral.defaultFormat("$0,0.00");

export default class Currency {
  input: string;
  allIn: boolean;
  balance = 0;

  constructor(input: string | number, balance: number | undefined) {
    this.input = input.toString();
    this.allIn = String(this.input).toLowerCase() === "all";

    if (balance) this.balance = balance;
  }

  get value(): number {
    const input = this.allIn ? this.balance : this.input;
    return numeral(input).value() || 0;
  }

  get formatted(): string {
    const input = this.allIn ? this.balance : this.input;
    return Currency.format(input);
  }

  get validity(): CurrencyValidity {
    if (numeral(this.input).value() === null) {
      return { code: "invalid", message: "Invalid amount!" };
    }

    if (this.value <= 0) {
      return { code: "negative_or_zero", message: "Amount must be greater than $0.00!" };
    }

    if (this.value > this.balance) {
      return {
        code: "insufficient_balance",
        message: `Insufficient balance! Your balance is ${Currency.format(this.balance)}.`,
      };
    }

    return { code: "valid", message: "" };
  }

  isEqual(inputValue: Currency | string | number): boolean {
    const value = inputValue instanceof Currency ? inputValue.value : inputValue;
    return this.value === value;
  }

  static format(inputValue: string | number): string {
    return numeral(inputValue).format();
  }
}

export type CurrencyValidity = {
  code: "negative_or_zero" | "insufficient_balance" | "valid" | "invalid";
  message: string;
};
