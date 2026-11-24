import type { PropType, VNodeChild } from "vue";
import { defineComponent, h } from "vue";

type SocialKind = "github" | "x" | "web" | "bluesky" | "sponsor";

interface SocialLink {
  readonly kind: SocialKind;
  readonly label: string;
  readonly href: string;
}

interface TeamMember {
  readonly name: string;
  readonly handle: string;
  readonly github: string;
  readonly avatar: string;
  readonly role: { readonly en: string; readonly zh: string };
  readonly bio: string;
  readonly links: readonly SocialLink[];
}

const MEMBERS: readonly TeamMember[] = [
  {
    name: "Ray",
    handle: "@so1ve",
    github: "https://github.com/so1ve",
    avatar: "https://avatars.githubusercontent.com/u/58381667?v=4",
    role: {
      en: "Creator and Maintainer",
      zh: "作者、核心维护",
    },
    bio: "Never say never.",
    links: [
      { kind: "github", label: "GitHub", href: "https://github.com/so1ve" },
      { kind: "x", label: "X", href: "https://twitter.com/so1v3" },
      {
        kind: "bluesky",
        label: "Bluesky",
        href: "https://bsky.app/profile/so1ve.dev",
      },
      { kind: "web", label: "mk1.io", href: "https://mk1.io" },
    ],
  },
  {
    name: "Yu",
    handle: "@caelyreth",
    github: "https://github.com/caelyreth",
    avatar: "https://avatars.githubusercontent.com/u/73536163?v=4",
    role: {
      en: "Documentation and Translation",
      zh: "文档维护与翻译",
    },
    bio: "Let all your past drift safe to shore",
    links: [
      { kind: "github", label: "GitHub", href: "https://github.com/caelyreth" },
      { kind: "x", label: "X", href: "https://x.com/caelyreth" },
      { kind: "sponsor", label: "Ko-fi", href: "https://ko-fi.com/caelyreth" },
    ],
  },
];

function renderSocialIcon(kind: SocialKind): VNodeChild {
  const base = {
    "class": "clerc-team-icon",
    "viewBox": "0 0 16 16",
    "width": 14,
    "height": 14,
    "aria-hidden": "true",
  };

  switch (kind) {
    case "github": {
      return h("svg", { ...base, fill: "currentColor" }, [
        h("path", {
          d: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z",
        }),
      ]);
    }
    case "x": {
      return h("svg", { ...base, fill: "currentColor" }, [
        h("path", {
          d: "M12.6 1.5h2.25L9.93 7.12 15.7 14.5h-4.53l-3.55-4.64L3.56 14.5H1.3l5.26-6.02L1 1.5h4.65l3.2 4.24L12.6 1.5Zm-.79 11.66h1.25L4.97 2.77H3.63l8.18 10.39Z",
        }),
      ]);
    }
    case "bluesky": {
      return h("svg", { ...base, fill: "currentColor" }, [
        h("path", {
          d: "M3.55 2.04C5.34 3.38 7.26 6.1 8 7.62c.74-1.52 2.66-4.24 4.45-5.58 1.3-.97 3.4-1.72 3.4.68 0 .48-.28 4.02-.44 4.6-.56 2-2.62 2.51-4.46 2.2 3.2.54 4.02 2.34 2.26 4.14-3.34 3.42-4.8-.86-5.17-1.95-.07-.2-.1-.3-.04-.3.06 0 .03.1-.04.3-.37 1.09-1.83 5.37-5.17 1.95-1.76-1.8-.94-3.6 2.26-4.14-1.84.31-3.9-.2-4.46-2.2-.16-.58-.44-4.12-.44-4.6 0-2.4 2.1-1.65 3.4-.68Z",
        }),
      ]);
    }
    case "web": {
      return h(
        "svg",
        {
          ...base,
          "fill": "none",
          "stroke": "currentColor",
          "stroke-width": "1.4",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
        [
          h("circle", { cx: "8", cy: "8", r: "6.2" }),
          h("path", {
            d: "M1.8 8h12.4M8 1.8a9.5 9.5 0 0 1 0 12.4M8 1.8a9.5 9.5 0 0 0 0 12.4",
          }),
        ],
      );
    }
    default: {
      return h(
        "svg",
        {
          ...base,
          "fill": "none",
          "stroke": "currentColor",
          "stroke-width": "1.4",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
        [
          h("path", {
            d: "M8 13.7S2.2 9.9 2.2 5.7A3.2 3.2 0 0 1 8 3.9a3.2 3.2 0 0 1 5.8 1.8c0 4.2-5.8 8-5.8 8Z",
          }),
        ],
      );
    }
  }
}

export const TeamPage = defineComponent({
  name: "TeamPage",
  props: {
    lang: {
      type: String as PropType<"en" | "zh">,
      default: "en",
    },
  },
  setup(props) {
    return () => {
      const isZh = props.lang === "zh";

      return h("div", { class: "clerc-team" }, [
        h("header", { class: "clerc-team-header" }, [
          h("h1", { class: "clerc-team-title" }, isZh ? "团队成员" : "Team"),
          h(
            "p",
            { class: "clerc-team-lead" },
            isZh
              ? "参与 Clerc 开发与文档维护的成员。"
              : "Maintainers and contributors behind Clerc.",
          ),
        ]),

        h(
          "section",
          {
            "class": "clerc-team-grid",
            "aria-label": isZh ? "核心成员" : "Core team",
          },
          MEMBERS.map((member) =>
            h("article", { key: member.handle, class: "clerc-member" }, [
              h("div", { class: "clerc-member-head" }, [
                h("img", {
                  src: member.avatar,
                  alt: member.name,
                  width: 56,
                  height: 56,
                  class: "clerc-member-avatar",
                }),
                h("div", { class: "clerc-member-id" }, [
                  h("div", { class: "clerc-member-name-row" }, [
                    h("h2", { class: "clerc-member-name" }, member.name),
                    h(
                      "a",
                      {
                        href: member.github,
                        target: "_blank",
                        rel: "noreferrer",
                        class: "clerc-member-handle",
                      },
                      member.handle,
                    ),
                  ]),
                  h(
                    "p",
                    { class: "clerc-member-role" },
                    isZh ? member.role.zh : member.role.en,
                  ),
                ]),
              ]),
              h("p", { class: "clerc-member-bio" }, member.bio),
              h(
                "div",
                { class: "clerc-member-links" },
                member.links.map((link) =>
                  h(
                    "a",
                    {
                      key: link.href,
                      href: link.href,
                      target: "_blank",
                      rel: "noreferrer",
                      class: "clerc-member-link",
                    },
                    [renderSocialIcon(link.kind), h("span", link.label)],
                  ),
                ),
              ),
            ]),
          ),
        ),

        h("footer", { class: "clerc-team-footer" }, [
          h(
            "span",
            { class: "clerc-team-footer-text" },
            isZh
              ? "欢迎在 GitHub 参与贡献。"
              : "Contributions are welcome on GitHub.",
          ),
          h("div", { class: "clerc-team-footer-links" }, [
            h(
              "a",
              {
                href: "https://github.com/clercjs/clerc",
                target: "_blank",
                rel: "noreferrer",
                class: "clerc-link-secondary",
              },
              isZh ? "仓库主页 →" : "Repository →",
            ),
            h(
              "a",
              {
                href: "https://github.com/clercjs/clerc/graphs/contributors",
                target: "_blank",
                rel: "noreferrer",
                class: "clerc-link-secondary",
              },
              isZh ? "所有贡献者 →" : "All Contributors →",
            ),
          ]),
        ]),
      ]);
    };
  },
});
