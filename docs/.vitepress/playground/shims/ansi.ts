const ESC = String.fromCodePoint(27);

export function stripAnsi(str: string): string {
  let out = "";
  let i = 0;
  while (i < str.length) {
    const esc = str.indexOf(`${ESC}[`, i);
    if (esc === -1) {
      out += str.slice(i);

      break;
    }
    out += str.slice(i, esc);
    const end = str.indexOf("m", esc + 2);
    i = end === -1 ? str.length : end + 1;
  }

  return out;
}
