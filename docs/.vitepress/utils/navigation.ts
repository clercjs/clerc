import fs from "node:fs/promises";
import { join } from "node:path";

function extractTitleFromMarkdown(content: string): string | null {
  // eslint-disable-next-line regexp/no-super-linear-backtracking
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  const frontmatter = match[1];
  // eslint-disable-next-line regexp/no-super-linear-backtracking
  const titleRegex = /^title:\s*(.+?)\s*$/m;
  const titleMatch = frontmatter.match(titleRegex);

  return titleMatch ? titleMatch[1].trim() : null;
}

export async function getTitles(
  path: string,
): Promise<{ filename: string; title: string }[]> {
  try {
    const files = await fs.readdir(path);
    const results: { filename: string; title: string }[] = [];

    for (const file of files) {
      if (file.endsWith(".md")) {
        const filePath = join(path, file);

        try {
          const content = await fs.readFile(filePath, "utf-8");
          const title = extractTitleFromMarkdown(content);

          if (title) {
            results.push({
              filename: file,
              title,
            });
          }
        } catch (error) {
          console.warn(`读取文件 ${file} 时出错:`, error);
        }
      }
    }

    results.sort((a, b) => a.filename.localeCompare(b.filename));

    return results;
  } catch (error) {
    console.error(`扫描目录 ${path} 时出错:`, error);

    return [];
  }
}

export async function getNavigation(
  path: string,
  webRoot: string,
): Promise<{ text: string; link: string }[]> {
  const titles = await getTitles(path);

  return titles.map(({ filename, title }) => {
    const link =
      filename === "index.md"
        ? webRoot
        : join(webRoot, filename.replace(/\.md$/, "")).replace(/\\/g, "/");

    return {
      text: title,
      link,
    };
  });
}
