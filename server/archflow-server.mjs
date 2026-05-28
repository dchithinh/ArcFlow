import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const port = Number(process.env.PORT || "80");
const aiProvider = process.env.AI_PROVIDER || "openai";
const openAiModel = process.env.OPENAI_MODEL || "gpt-5-mini";
const ollamaModel = process.env.OLLAMA_MODEL || process.env.AI_MODEL || "qwen2.5-coder:7b";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

const discoverySchema = {
  type: "object",
  additionalProperties: false,
  required: ["featureSummary", "discovery"],
  properties: {
    featureSummary: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "problem", "goals", "assumptions", "openQuestions"],
      properties: {
        summary: { type: "string" },
        problem: { type: "string" },
        goals: { type: "array", items: { type: "string" } },
        assumptions: { type: "array", items: { type: "string" } },
        openQuestions: { type: "array", items: { type: "string" } },
      },
    },
    discovery: {
      type: "object",
      additionalProperties: false,
      required: [
        "externalActors",
        "candidateComponents",
        "interactions",
        "candidateTasks",
        "systemRisks",
      ],
      properties: {
        externalActors: { type: "array", items: { type: "string" } },
        candidateComponents: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "responsibility", "rationale"],
            properties: {
              name: { type: "string" },
              responsibility: { type: "string" },
              rationale: { type: "string" },
            },
          },
        },
        interactions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["fromComponentName", "toComponentName", "mechanism", "data", "notes"],
            properties: {
              fromComponentName: { type: "string" },
              toComponentName: { type: "string" },
              mechanism: {
                type: "string",
                enum: [
                  "queue",
                  "event",
                  "notification",
                  "callback",
                  "shared_memory",
                  "direct_call",
                  "other",
                ],
              },
              data: { type: "string" },
              notes: { type: "string" },
            },
          },
        },
        candidateTasks: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "name",
              "responsibility",
              "priority",
              "type",
              "trigger",
              "mayBlock",
              "notes",
            ],
            properties: {
              name: { type: "string" },
              responsibility: { type: "string" },
              priority: { type: "string", enum: ["high", "medium", "low"] },
              type: {
                type: "string",
                enum: ["periodic", "event-driven", "background", "worker"],
              },
              trigger: { type: "string" },
              mayBlock: { type: "boolean" },
              notes: { type: "string" },
            },
          },
        },
        systemRisks: { type: "array", items: { type: "string" } },
      },
    },
  },
};

const componentSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "inputs",
    "outputs",
    "incomingEvents",
    "internalSignals",
    "outgoingSignals",
    "states",
    "ownership",
    "failureModes",
    "debugging",
  ],
  properties: {
    summary: { type: "string" },
    inputs: { type: "array", items: { type: "string" } },
    outputs: { type: "array", items: { type: "string" } },
    incomingEvents: { $ref: "#/$defs/eventList" },
    internalSignals: { $ref: "#/$defs/eventList" },
    outgoingSignals: { $ref: "#/$defs/eventList" },
    states: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "transitions"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          transitions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["event", "triggerKind", "targetState", "action"],
              properties: {
                event: { type: "string" },
                triggerKind: { type: "string", enum: ["incoming", "internal"] },
                targetState: { type: "string" },
                action: { type: "string" },
              },
            },
          },
        },
      },
    },
    ownership: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["resource", "owner", "accessRules"],
        properties: {
          resource: { type: "string" },
          owner: { type: "string" },
          accessRules: { type: "string" },
        },
      },
    },
    failureModes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["scenario", "impact", "recovery"],
        properties: {
          scenario: { type: "string" },
          impact: { type: "string" },
          recovery: { type: "string" },
        },
      },
    },
    debugging: {
      type: "object",
      additionalProperties: false,
      required: ["logs", "traces", "observability"],
      properties: {
        logs: { type: "array", items: { type: "string" } },
        traces: { type: "array", items: { type: "string" } },
        observability: { type: "array", items: { type: "string" } },
      },
    },
  },
  $defs: {
    eventList: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "source", "trigger", "frequency", "latencySensitive"],
        properties: {
          name: { type: "string" },
          source: { type: "string" },
          trigger: { type: "string" },
          frequency: { type: "string" },
          latencySensitive: { type: "boolean" },
        },
      },
    },
  },
};

const implementationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["milestones", "apis", "tests"],
  properties: {
    milestones: { type: "array", items: { type: "string" } },
    apis: { type: "array", items: { type: "string" } },
    tests: { type: "array", items: { type: "string" } },
  },
};

const parseBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
};

const serveFile = async (requestPath, response) => {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.join(distDir, safePath);

  try {
    const fileInfo = await stat(filePath);
    if (fileInfo.isDirectory()) {
      throw new Error("Directory");
    }

    const ext = path.extname(filePath);
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
    });
    response.end(body);
  } catch {
    const indexPath = path.join(distDir, "index.html");
    const body = await readFile(indexPath);
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(body);
  }
};

const asLines = (items = []) =>
  Array.isArray(items) && items.length > 0
    ? items.map((item) => `- ${String(item).trim()}`).join("\n")
    : "- none provided";

const summarizeComponents = (components = []) =>
  Array.isArray(components) && components.length > 0
    ? components
        .map((component) => {
          const name = String(component.name || "Unnamed component").trim();
          const summary = String(component.summary || "").trim();
          return `- ${name}${summary ? `: ${summary}` : ""}`;
        })
        .join("\n")
    : "- none yet";

const summarizeInteractions = (interactions = []) =>
  Array.isArray(interactions) && interactions.length > 0
    ? interactions
        .map((interaction) => {
          const fromName = String(interaction.fromComponentName || interaction.fromComponent || "").trim();
          const toName = String(interaction.toComponentName || interaction.toComponent || "").trim();
          const mechanism = String(interaction.mechanism || "").trim();
          const data = String(interaction.data || "").trim();
          return `- ${fromName} -> ${toName}${mechanism ? ` via ${mechanism}` : ""}${data ? ` carrying ${data}` : ""}`;
        })
        .join("\n")
    : "- none yet";

const summarizeTasks = (tasks = []) =>
  Array.isArray(tasks) && tasks.length > 0
    ? tasks
        .map((task) => {
          const name = String(task.name || "Unnamed task").trim();
          const responsibility = String(task.responsibility || "").trim();
          const priority = String(task.priority || "").trim();
          return `- ${name}${responsibility ? `: ${responsibility}` : ""}${priority ? ` [${priority}]` : ""}`;
        })
        .join("\n")
    : "- none yet";

const buildDiscoveryPrompt = ({ title, requirement, constraints, responsibilities }) => `
Create a firmware feature discovery draft.

Fixed user inputs:
- Feature name: ${title}
- Requirement: ${requirement}
- Constraints:
${asLines(constraints)}
- Responsibilities:
${asLines(responsibilities)}

Return only the discovery-level design:
- feature summary
- problem statement
- goals
- assumptions
- open questions
- external actors
- candidate components
- component interactions
- candidate RTOS tasks
- system risks

Keep it implementation-oriented and sized for an embedded firmware team. Do not generate detailed component state machines yet.
`.trim();

const buildComponentPrompt = ({
  title,
  requirement,
  constraints,
  responsibilities,
  selectedComponentName,
  selectedComponentResponsibility,
  candidateComponents,
  interactions,
  systemRisks,
}) => `
Refine one firmware component inside a larger feature workspace.

Feature:
- Name: ${title}
- Requirement: ${requirement}
- Constraints:
${asLines(constraints)}
- Feature responsibilities:
${asLines(responsibilities)}

Component to refine:
- Name: ${selectedComponentName}
- Responsibility: ${selectedComponentResponsibility}

Known components:
${summarizeComponents(candidateComponents)}

Known interactions:
${summarizeInteractions(interactions)}

Known system risks:
${asLines(systemRisks)}

Return only the detailed design for this single component:
- summary
- inputs and outputs
- incoming events
- internal signals
- outgoing signals
- states and transitions
- ownership
- failure modes
- debugging hooks

Keep the output bounded to this component only. Do not redesign the whole workspace.
`.trim();

const buildImplementationPrompt = ({
  title,
  requirement,
  constraints,
  responsibilities,
  candidateComponents,
  interactions,
  candidateTasks,
  components,
}) => `
Create an implementation plan for a firmware feature workspace.

Feature:
- Name: ${title}
- Requirement: ${requirement}
- Constraints:
${asLines(constraints)}
- Responsibilities:
${asLines(responsibilities)}

Components:
${summarizeComponents(candidateComponents)}

Interactions:
${summarizeInteractions(interactions)}

Candidate RTOS tasks:
${summarizeTasks(candidateTasks)}

Refined component summaries:
${summarizeComponents(components)}

Return only:
- milestones
- APIs
- tests

Keep the plan practical for an embedded firmware project with staged bring-up and verification.
`.trim();

const requestOpenAiDraft = async ({ schema, systemPrompt, userPrompt }) => {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: openAiModel,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "archflow_stage_output",
          strict: true,
          schema,
        },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI request failed.");
  }

  if (!data.output_text) {
    throw new Error("OpenAI returned no structured draft.");
  }

  return JSON.parse(data.output_text);
};

const extractJsonText = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fencedMatch ? fencedMatch[1].trim() : value.trim();
};

const requestOllamaDraft = async ({ schema, systemPrompt, userPrompt }) => {
  let response;
  try {
    response = await fetch(`${ollamaBaseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ollamaModel,
        stream: false,
        format: schema,
        options: {
          temperature: 0,
        },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch {
    throw new Error(
      `Could not reach Ollama at ${ollamaBaseUrl}. Start Ollama, confirm the model is pulled, and ensure the container can reach the host service.`,
    );
  }

  const rawText = await response.text();
  let data;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(`Ollama returned non-JSON response: ${rawText.slice(0, 400)}`);
  }

  if (!response.ok) {
    throw new Error(data?.error || `Ollama request failed with status ${response.status}.`);
  }

  const content = extractJsonText(data?.message?.content);
  if (!content) {
    throw new Error("Ollama returned no structured draft.");
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Ollama returned invalid JSON draft: ${content.slice(0, 400)}`);
  }
};

const resolveProvider = () => {
  if (aiProvider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "AI drafting is disabled. Set OPENAI_API_KEY or switch AI_PROVIDER=ollama.",
      );
    }

    return {
      model: openAiModel,
      provider: "openai",
      requestDraft: requestOpenAiDraft,
    };
  }

  if (aiProvider === "ollama") {
    return {
      model: ollamaModel,
      provider: "ollama",
      requestDraft: requestOllamaDraft,
    };
  }

  throw new Error(
    `Unsupported AI provider "${aiProvider}". Use AI_PROVIDER=openai or AI_PROVIDER=ollama.`,
  );
};

const validateBaseInputs = (body) => {
  const title = String(body.title || "").trim();
  const requirement = String(body.requirement || "").trim();
  const constraints = Array.isArray(body.constraints)
    ? body.constraints.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const responsibilities = Array.isArray(body.responsibilities)
    ? body.responsibilities.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (!title || !requirement || constraints.length === 0 || responsibilities.length === 0) {
    throw new Error(
      "Feature name, requirement, at least one constraint, and at least one responsibility are required.",
    );
  }

  return { title, requirement, constraints, responsibilities };
};

const buildStageRequest = (body) => {
  const base = validateBaseInputs(body);
  const stage = String(body.stage || "").trim();

  if (stage === "discovery") {
    return {
      stage,
      schema: discoverySchema,
      systemPrompt:
        "Generate structured firmware feature discovery drafts. Return only data that fits the provided schema.",
      userPrompt: buildDiscoveryPrompt(base),
    };
  }

  if (stage === "component") {
    const selectedComponentName = String(body.selectedComponentName || "").trim();
    const selectedComponentResponsibility = String(
      body.selectedComponentResponsibility || "",
    ).trim();
    if (!selectedComponentName) {
      throw new Error("Selected component name is required for component refinement.");
    }

    return {
      stage,
      schema: componentSchema,
      systemPrompt:
        "Generate structured detailed component designs for embedded firmware workspaces. Return only data that fits the provided schema.",
      userPrompt: buildComponentPrompt({
        ...base,
        selectedComponentName,
        selectedComponentResponsibility,
        candidateComponents: Array.isArray(body.candidateComponents)
          ? body.candidateComponents
          : [],
        interactions: Array.isArray(body.interactions) ? body.interactions : [],
        systemRisks: Array.isArray(body.systemRisks) ? body.systemRisks : [],
      }),
    };
  }

  if (stage === "implementation") {
    return {
      stage,
      schema: implementationSchema,
      systemPrompt:
        "Generate practical embedded firmware implementation plans. Return only data that fits the provided schema.",
      userPrompt: buildImplementationPrompt({
        ...base,
        candidateComponents: Array.isArray(body.candidateComponents)
          ? body.candidateComponents
          : [],
        interactions: Array.isArray(body.interactions) ? body.interactions : [],
        candidateTasks: Array.isArray(body.candidateTasks) ? body.candidateTasks : [],
        components: Array.isArray(body.components) ? body.components : [],
      }),
    };
  }

  throw new Error(
    'Invalid AI stage. Use "discovery", "component", or "implementation".',
  );
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (request.method === "POST" && url.pathname === "/api/ai/workspace-draft") {
      const body = await parseBody(request);

      let provider;
      try {
        provider = resolveProvider();
      } catch (error) {
        response.writeHead(503, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : "AI drafting is disabled.",
          }),
        );
        return;
      }

      let stageRequest;
      try {
        stageRequest = buildStageRequest(body);
      } catch (error) {
        response.writeHead(400, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : "Invalid AI request.",
          }),
        );
        return;
      }

      const startedAt = Date.now();
      try {
        const draft = await provider.requestDraft(stageRequest);
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(
          JSON.stringify({
            draft,
            model: provider.model,
            provider: provider.provider,
            stage: stageRequest.stage,
            durationMs: Date.now() - startedAt,
          }),
        );
      } catch (error) {
        console.error(
          `[archflow-ai] stage=${stageRequest.stage} provider=${provider.provider} model=${provider.model} failed:`,
          error instanceof Error ? error.message : error,
        );
        response.writeHead(500, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(
          JSON.stringify({
            error:
              error instanceof Error ? error.message : "Unexpected AI drafting failure.",
          }),
        );
      }
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      response.writeHead(404, {
        "Content-Type": "application/json; charset=utf-8",
      });
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    await serveFile(url.pathname, response);
  } catch (error) {
    response.writeHead(500, {
      "Content-Type": "application/json; charset=utf-8",
    });
    response.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected server error.",
      }),
    );
  }
}).listen(port, () => {
  console.log(
    `ArchFlow server listening on port ${port} with AI provider ${aiProvider}`,
  );
});
