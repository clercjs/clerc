const { so1ve } = require("@so1ve/eslint-config");

module.exports = so1ve(
	{},
	{
		files: ["examples/**"],
		rules: {
			"no-console": "off",
		},
	},
);
