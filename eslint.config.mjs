import { so1ve } from "@so1ve/eslint-config";

export default so1ve(
	{
		rules: {
			"ts/no-empty-object-type": "off",
		},
	},
	{
		files: ["examples/**"],
		rules: {
			"no-console": "off",
		},
	},
);
