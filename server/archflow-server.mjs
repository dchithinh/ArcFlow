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
      required: ["summary", "problem", "assumptions", "openQuestions"],
      properties: {
        summary: { type: "string" },
        problem: { type: "string" },
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

const definitionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["featureRequirements", "featureResponsibilities"],
  properties: {
    featureRequirements: { type: "array", items: { type: "string" } },
    featureResponsibilities: { type: "array", items: { type: "string" } },
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
- assumptions
- open questions
- external actors
- candidate components
- component interactions
- candidate RTOS tasks
- system risks

Keep it implementation-oriented and sized for an embedded firmware team. Use the provided feature requirements and responsibilities as fixed inputs; do not rewrite or replace them. Do not generate detailed component state machines yet.
`.trim();

const buildDefinitionPrompt = ({
  title,
  summary,
  constraints,
  assumptions,
  openQuestions,
}) => `
Create a first-pass feature definition draft for a firmware feature workspace.

Known user inputs:
- Feature name: ${title}
- Feature summary: ${summary}
- Constraints:
${asLines(constraints)}
- Assumptions:
${asLines(assumptions)}
- Open questions:
${asLines(openQuestions)}

Return only:
- feature requirements
- feature responsibilities

Guidance:
- Treat the summary as rough source material. Ignore meta authoring text such as requests for help, requests for lists, or conversational filler.
- Requirements must describe externally visible feature behavior only.
- Every requirement must use the form: "Feature shall ...".
- Requirements must describe what the user, operator, or external system can do, receive, observe, or rely on from the feature.
- Do not put internal design behavior into requirements.
- Do not use internal implementation verbs in requirements such as "parse", "validate", "dispatch", "queue", "schedule", "store", "log", "signal", "notify", "call", or "handle malformed input".
- Requirements should be specific enough to guide design, not vague restatements of the summary.
- Responsibilities must describe internal system jobs needed to satisfy the requirements.
- Responsibilities must start with direct action verbs such as "Receive", "Parse", "Validate", "Dispatch", "Store", "Update", "Generate", "Protect", or "Report".
- Do not write project tasks or implementation directives such as "develop", "design", "implement", or "create".
- Infer obvious embedded-firmware concerns when the summary implies them, such as input framing, validation, malformed input handling, response generation, handoff between execution contexts, and non-blocking behavior.
- Keep the output clear, concise, and editable by a firmware developer.
- Prefer 4 to 8 requirements and 4 to 8 responsibilities.
- Avoid duplicates and near-duplicates.
- The requirements and responsibilities must not be near-duplicates of each other.
- Before returning, check that each requirement reads like an acceptance statement and each responsibility reads like an internal design job.
- Do not generate components, interactions, tasks, diagrams, APIs, tests, or implementation plans yet.
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

const buildChatPrompt = ({ scope, context, history, question }) => {
  const historyText =
    Array.isArray(history) && history.length > 0
      ? history
          .map((entry) => {
            const role = String(entry.role || "").trim() || "user";
            const text = String(entry.text || "").trim();
            return text ? `- ${role}: ${text}` : "";
          })
          .filter(Boolean)
          .join("\n")
      : "- none";

  return `
You are answering a firmware design question inside ArchFlow.

Scope:
- Type: ${scope.type}
- Label: ${scope.label}

Rules:
- Answer only the user's design question.
- Use the provided workspace context; do not invent missing details.
- If context is insufficient, say what is missing and make the smallest reasonable inference.
- Keep the answer clear, concise, and practical for a firmware developer.
- Focus on design reasoning, tradeoffs, risks, and clarification.
- Do not rewrite the whole workspace.
- Do not return JSON, markdown tables, or code unless the question directly needs it.

Recent chat history:
${historyText}

Workspace context:
${JSON.stringify(context, null, 2)}

User question:
${question}
`.trim();
};

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

const requestOpenAiAnswer = async ({ systemPrompt, userPrompt }) => {
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
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI chat request failed.");
  }

  const answer = String(data.output_text || "").trim();
  if (!answer) {
    throw new Error("OpenAI returned no chat answer.");
  }

  return answer;
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

const requestOllamaAnswer = async ({ systemPrompt, userPrompt }) => {
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
        options: {
          temperature: 0.2,
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

  const answer = String(data?.message?.content || "").trim();
  if (!answer) {
    throw new Error("Ollama returned no chat answer.");
  }

  return answer;
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
      requestAnswer: requestOpenAiAnswer,
    };
  }

  if (aiProvider === "ollama") {
    return {
      model: ollamaModel,
      provider: "ollama",
      requestDraft: requestOllamaDraft,
      requestAnswer: requestOllamaAnswer,
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

const validateDefinitionInputs = (body) => {
  const title = String(body.title || "").trim();
  const summary = String(body.summary || "").trim();
  const constraints = Array.isArray(body.constraints)
    ? body.constraints.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const assumptions = Array.isArray(body.assumptions)
    ? body.assumptions.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const openQuestions = Array.isArray(body.openQuestions)
    ? body.openQuestions.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (!title || !summary) {
    throw new Error("Feature name and feature summary are required.");
  }

  return { title, summary, constraints, assumptions, openQuestions };
};

const validateChatInputs = (body) => {
  const question = String(body.question || "").trim();
  const scope = body.scope;
  const context = body.context;
  const history = Array.isArray(body.history)
    ? body.history.map((entry) => ({
        role: String(entry?.role || "").trim(),
        text: String(entry?.text || "").trim(),
      }))
    : [];

  if (!question) {
    throw new Error("Chat question is required.");
  }

  if (!scope || typeof scope !== "object") {
    throw new Error("Chat scope is required.");
  }

  if (!context || typeof context !== "object") {
    throw new Error("Chat context is required.");
  }

  const scopeType = String(scope.type || "").trim();
  const scopeLabel = String(scope.label || "").trim();
  if (!scopeType || !scopeLabel) {
    throw new Error("Chat scope must include type and label.");
  }
  if (!["workspace", "component"].includes(scopeType)) {
    throw new Error('Chat scope type must be "workspace" or "component".');
  }

  return {
    question,
    scope: {
      type: scopeType,
      label: scopeLabel,
      componentId: String(scope.componentId || "").trim(),
    },
    context,
    history: history.filter((entry) => entry.role && entry.text).slice(-6),
  };
};

const buildStageRequest = (body) => {
  const stage = String(body.stage || "").trim();

  if (stage === "definition") {
    const base = validateDefinitionInputs(body);
    return {
      stage,
      schema: definitionSchema,
      systemPrompt:
        "Generate structured firmware feature requirements and feature responsibilities. Requirements must be externally visible 'Feature shall ...' acceptance statements about what the user, operator, or external system gets from the feature. Requirements must not describe internal behaviors like parse, validate, dispatch, queue, store, log, or signal. Responsibilities must be internal system jobs, not project tasks. Return only data that fits the provided schema.",
      userPrompt: buildDefinitionPrompt(base),
    };
  }

  const base = validateBaseInputs(body);

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

  throw new Error(
    'Invalid AI stage. Use "definition", "discovery", or "component".',
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

    if (request.method === "POST" && url.pathname === "/api/ai/workspace-chat") {
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
            error: error instanceof Error ? error.message : "AI chat is disabled.",
          }),
        );
        return;
      }

      let chatRequest;
      try {
        chatRequest = validateChatInputs(body);
      } catch (error) {
        response.writeHead(400, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : "Invalid AI chat request.",
          }),
        );
        return;
      }

      const startedAt = Date.now();
      try {
        const answer = await provider.requestAnswer({
          systemPrompt:
            "You are a firmware design assistant inside ArchFlow. Answer clearly and concisely using only the provided scoped workspace context. Focus on explanation and review; do not mutate the workspace or invent missing structure.",
          userPrompt: buildChatPrompt(chatRequest),
        });

        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(
          JSON.stringify({
            answer,
            model: provider.model,
            provider: provider.provider,
            scope: chatRequest.scope.type,
            durationMs: Date.now() - startedAt,
          }),
        );
      } catch (error) {
        console.error(
          `[archflow-ai-chat] scope=${chatRequest.scope.type} provider=${provider.provider} model=${provider.model} failed:`,
          error instanceof Error ? error.message : error,
        );
        response.writeHead(500, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : "Unexpected AI chat failure.",
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
