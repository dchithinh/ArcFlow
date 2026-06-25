import type { FeatureWorkspace } from "../schema/workspace";

const headingAliases = {
  summary: new Set(["summary", "feature summary"]),
  requirement: new Set([
    "requirement",
    "requirements",
    "feature requirement",
    "feature requirements",
    "overview",
    "description",
  ]),
  constraints: new Set(["constraints", "constraint"]),
  responsibilities: new Set([
    "responsibilities",
    "responsibility",
    "feature responsibilities",
    "feature responsibility",
  ]),
  goals: new Set(["goals", "goal"]),
  assumptions: new Set(["assumptions", "assumption"]),
  openQuestions: new Set(["open questions", "questions", "question"]),
};

const requirementsToText = (requirements: string[]): string =>
  requirements
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");

const stripRequirementPrefix = (value: string): string =>
  value.replace(/^REQ-\d+\s*:\s*/i, "").trim();

const normalizeHeading = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[*_`:#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseMarkdownSections = (
  markdown: string,
): {
  title: string;
  sections: Map<string, string[]>;
} => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections = new Map<string, string[]>();
  let title = "";
  let currentHeading = "requirement";

  for (const line of lines) {
    const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const heading = normalizeHeading(headingMatch[2]);
      if (level === 1 && !title && heading) {
        title = headingMatch[2].trim();
      }

      currentHeading = heading || currentHeading;
      if (!sections.has(currentHeading)) {
        sections.set(currentHeading, []);
      }
      continue;
    }

    const bucket = sections.get(currentHeading) ?? [];
    bucket.push(line);
    sections.set(currentHeading, bucket);
  }

  return { title, sections };
};

const resolveSectionBlock = (
  sections: Map<string, string[]>,
  aliases: Set<string>,
): string[] => {
  for (const [heading, lines] of sections.entries()) {
    if (aliases.has(heading)) {
      return lines;
    }
  }

  return [];
};

const toBulletList = (lines: string[]): string[] => {
  const bullets = lines
    .map((line) => line.trim())
    .filter((line) => /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^([-*+]|\d+\.)\s+/, "").trim())
    .filter(Boolean);

  if (bullets.length > 0) {
    return bullets;
  }

  return lines
    .join("\n")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const toParagraph = (lines: string[]): string =>
  lines
    .join("\n")
    .trim()
    .replace(/\n{3,}/g, "\n\n");

const inferTitleFromFileName = (fileName: string): string =>
  fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();

export const applyImportedMarkdownToWorkspace = (
  workspace: FeatureWorkspace,
  markdown: string,
  fileName = "imported.md",
): FeatureWorkspace => {
  const { title, sections } = parseMarkdownSections(markdown);
  const summaryBlock = resolveSectionBlock(sections, headingAliases.summary);
  const requirementBlock = resolveSectionBlock(sections, headingAliases.requirement);
  const constraintsBlock = resolveSectionBlock(sections, headingAliases.constraints);
  const responsibilitiesBlock = resolveSectionBlock(sections, headingAliases.responsibilities);
  const goalsBlock = resolveSectionBlock(sections, headingAliases.goals);
  const assumptionsBlock = resolveSectionBlock(sections, headingAliases.assumptions);
  const openQuestionsBlock = resolveSectionBlock(sections, headingAliases.openQuestions);

  const nextTitle = title || inferTitleFromFileName(fileName) || workspace.title;
  const nextSummary = toParagraph(summaryBlock);
  const nextRequirements = toBulletList(requirementBlock);
  const nextRequirement =
    (nextRequirements.length > 0
      ? requirementsToText(nextRequirements.map(stripRequirementPrefix))
      : "") ||
    toParagraph(requirementBlock) ||
    (sections.size === 1 ? markdown.trim() : workspace.requirement);
  const nextConstraints = toBulletList(constraintsBlock);
  const nextResponsibilities = toBulletList(responsibilitiesBlock);
  const nextGoals = toBulletList(goalsBlock);
  const nextAssumptions = toBulletList(assumptionsBlock);
  const nextOpenQuestions = toBulletList(openQuestionsBlock);

  return {
    ...workspace,
    title: nextTitle,
    requirement: nextRequirement,
    featureSummary: {
      ...workspace.featureSummary,
      summary: nextSummary || workspace.featureSummary.summary,
      goals:
        nextRequirements.length > 0
          ? nextRequirements.map(stripRequirementPrefix)
          : nextGoals.length > 0
            ? nextGoals
            : workspace.featureSummary.goals,
      constraints:
        nextConstraints.length > 0 ? nextConstraints : workspace.featureSummary.constraints,
      assumptions:
        nextAssumptions.length > 0 ? nextAssumptions : workspace.featureSummary.assumptions,
      openQuestions:
        nextOpenQuestions.length > 0
          ? nextOpenQuestions
          : workspace.featureSummary.openQuestions,
    },
    discovery: {
      ...workspace.discovery,
      responsibilities:
        nextResponsibilities.length > 0
          ? nextResponsibilities
          : workspace.discovery.responsibilities,
    },
  };
};
