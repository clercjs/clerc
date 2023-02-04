import type { Section } from "./renderer";

export interface Renderers {
  renderSections?: (sections: Section[]) => Section[]
  renderFlagName?: (name: string) => string
  renderDefault?: (type: any) => string
}
