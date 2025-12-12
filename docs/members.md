---
layout: home

hero:
  name: Members
  tagline: Clerc Open Source Team
---

<script setup lang="ts">
import { VPTeamMembers } from "vitepress/theme";

const members = [
	{
		avatar: "https://avatars.githubusercontent.com/u/58381667?v=4",
		name: "Ray",
		title: "Source code author, documentation writer",
		links: [
			{ icon: "github", link: "https://github.com/so1ve" },
			{ icon: "twitter", link: "https://twitter.com/so1v3" },
		],
	},
	{
		avatar: "https://avatars.githubusercontent.com/u/73536163?v=4",
		name: "Shizuku",
		title: "Documentation maintenance, translation",
		links: [
			{ icon: "github", link: "https://github.com/ifshizuku" },
			{ icon: "twitter", link: "https://twitter.com/ifszk" },
		],
	},
];
</script>

<VPTeamMembers :members="members" />
