---
layout: home

hero:
  name: 成员
  tagline: Clerc 开源团队
---

<script setup lang="ts">
import { VPTeamMembers } from "vitepress/theme";

const members = [
	{
		avatar: "https://avatars.githubusercontent.com/u/58381667?v=4",
		name: "Ray",
		title: "源码作者，文档撰写",
		links: [
			{ icon: "github", link: "https://github.com/so1ve" },
			{ icon: "twitter", link: "https://twitter.com/so1v3" },
		],
	},
	{
		avatar: "https://avatars.githubusercontent.com/u/73536163?v=4",
		name: "Shizuku",
		title: "文档维护、翻译",
		links: [
			{ icon: "github", link: "https://github.com/ifshizuku" },
			{ icon: "twitter", link: "https://twitter.com/ifszk" },
		],
	},
];
</script>

<VPTeamMembers :members="members" />
