// The Expressive Code theme for docs code blocks. By the colour rule (see
// DESIGN.md), code outside the terminal examples uses only the neutral text
// colours: no amber and no machine colours.
//
// Expressive Code works out contrast from these values, so they are hex
// copies of the tokens in src/styles/tokens.css. Keep the two in step.
const terminal = "#0e0f20";
const rule = "#2a2c4a";
const ink = "#eceaf4";
const text2 = "#c3c4dc";
const muted = "#a4a6c4";
const faint = "#8d8fb0";

export default {
  name: "delocal",
  type: "dark",
  colors: {
    "editor.background": terminal,
    "editor.foreground": ink,
    "editor.selectionBackground": rule,
    focusBorder: rule,
  },
  tokenColors: [
    { settings: { foreground: ink } },
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: faint } },
    { scope: ["string", "constant.other.symbol"], settings: { foreground: text2 } },
    {
      scope: [
        "keyword",
        "storage",
        "punctuation",
        "meta.brace",
        "constant.other.option",
        "variable.parameter",
        "entity.other.attribute-name",
      ],
      settings: { foreground: muted },
    },
  ],
};
