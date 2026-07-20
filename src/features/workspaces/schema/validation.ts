import type {
  FeatureWorkspace,
  FeatureComponent,
  ComponentObject,
  SequenceScenario,
  EventDefinition,
  WorkspaceCustomOptions,
} from "./workspace";

type ValidationIssue = {
  path: string;
  message: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const pushIssue = (issues: ValidationIssue[], path: string, message: string): void => {
  issues.push({ path, message });
};

const validateEventDefinition = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is EventDefinition => {
  if (!isRecord(value)) {
    pushIssue(issues, path, "must be an object");
    return false;
  }

  if (!isString(value.name)) {
    pushIssue(issues, `${path}.name`, "must be a string");
  }
  if (!isString(value.source)) {
    pushIssue(issues, `${path}.source`, "must be a string");
  }
  if (!isString(value.trigger)) {
    pushIssue(issues, `${path}.trigger`, "must be a string");
  }
  if (value.frequency !== undefined && !isString(value.frequency)) {
    pushIssue(issues, `${path}.frequency`, "must be a string when provided");
  }
  if (value.latencySensitive !== undefined && !isBoolean(value.latencySensitive)) {
    pushIssue(issues, `${path}.latencySensitive`, "must be a boolean when provided");
  }

  return true;
};

const validateObject = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is ComponentObject => {
  if (!isRecord(value)) {
    pushIssue(issues, path, "must be an object");
    return false;
  }

  if (!isString(value.id)) {
    pushIssue(issues, `${path}.id`, "must be a string");
  }
  if (!isString(value.name)) {
    pushIssue(issues, `${path}.name`, "must be a string");
  }
  if (!isString(value.responsibility)) {
    pushIssue(issues, `${path}.responsibility`, "must be a string");
  }
  if (value.objectType !== "active" && value.objectType !== "passive") {
    pushIssue(issues, `${path}.objectType`, "must be 'active' or 'passive'");
  }
  if (!isBoolean(value.needsState)) {
    pushIssue(issues, `${path}.needsState`, "must be a boolean");
  }
  if (!Array.isArray(value.states)) {
    pushIssue(issues, `${path}.states`, "must be an array");
  } else {
    value.states.forEach((state, index) => {
      const statePath = `${path}.states[${index}]`;
      if (!isRecord(state)) {
        pushIssue(issues, statePath, "must be an object");
        return;
      }
      if (!isString(state.name)) {
        pushIssue(issues, `${statePath}.name`, "must be a string");
      }
      if (!isString(state.description)) {
        pushIssue(issues, `${statePath}.description`, "must be a string");
      }
      if (!Array.isArray(state.transitions)) {
        pushIssue(issues, `${statePath}.transitions`, "must be an array");
      } else {
        state.transitions.forEach((transition, transitionIndex) => {
          const transitionPath = `${statePath}.transitions[${transitionIndex}]`;
          if (!isRecord(transition)) {
            pushIssue(issues, transitionPath, "must be an object");
            return;
          }
          if (!isString(transition.event)) {
            pushIssue(issues, `${transitionPath}.event`, "must be a string");
          }
          if (
            transition.triggerKind !== undefined &&
            transition.triggerKind !== "incoming" &&
            transition.triggerKind !== "internal"
          ) {
            pushIssue(
              issues,
              `${transitionPath}.triggerKind`,
              "must be 'incoming' or 'internal' when provided",
            );
          }
          if (!isString(transition.targetState)) {
            pushIssue(issues, `${transitionPath}.targetState`, "must be a string");
          }
          if (transition.action !== undefined && !isString(transition.action)) {
            pushIssue(issues, `${transitionPath}.action`, "must be a string when provided");
          }
        });
      }
    });
  }

  return true;
};

const validateComponent = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is FeatureComponent => {
  if (!isRecord(value)) {
    pushIssue(issues, path, "must be an object");
    return false;
  }

  if (!isString(value.id)) {
    pushIssue(issues, `${path}.id`, "must be a string");
  }
  if (!isString(value.name)) {
    pushIssue(issues, `${path}.name`, "must be a string");
  }
  if (!isString(value.summary)) {
    pushIssue(issues, `${path}.summary`, "must be a string");
  }
  if (!isStringArray(value.inputs)) {
    pushIssue(issues, `${path}.inputs`, "must be an array of strings");
  }
  if (!isStringArray(value.outputs)) {
    pushIssue(issues, `${path}.outputs`, "must be an array of strings");
  }

  const eventFields = ["incomingEvents", "internalSignals", "outgoingSignals"] as const;
  eventFields.forEach((field) => {
    const fieldValue = value[field];
    if (!Array.isArray(fieldValue)) {
      pushIssue(issues, `${path}.${field}`, "must be an array");
      return;
    }
    fieldValue.forEach((event, index) =>
      validateEventDefinition(event, `${path}.${field}[${index}]`, issues),
    );
  });

  if (!Array.isArray(value.objects)) {
    pushIssue(issues, `${path}.objects`, "must be an array");
  } else {
    value.objects.forEach((object, index) =>
      validateObject(object, `${path}.objects[${index}]`, issues),
    );
  }

  if (!Array.isArray(value.objectInteractions)) {
    pushIssue(issues, `${path}.objectInteractions`, "must be an array");
  } else {
    value.objectInteractions.forEach((interaction, index) => {
      const interactionPath = `${path}.objectInteractions[${index}]`;
      if (!isRecord(interaction)) {
        pushIssue(issues, interactionPath, "must be an object");
        return;
      }
      if (!isString(interaction.fromObjectId)) {
        pushIssue(issues, `${interactionPath}.fromObjectId`, "must be a string");
      }
      if (!isString(interaction.toObjectId)) {
        pushIssue(issues, `${interactionPath}.toObjectId`, "must be a string");
      }
      if (!isString(interaction.relationship)) {
        pushIssue(issues, `${interactionPath}.relationship`, "must be a string");
      }
      if (interaction.notes !== undefined && !isString(interaction.notes)) {
        pushIssue(issues, `${interactionPath}.notes`, "must be a string when provided");
      }
    });
  }

  const objectArrayFields = ["ownership", "failureModes"] as const;
  objectArrayFields.forEach((field) => {
    const fieldValue = value[field];
    if (!Array.isArray(fieldValue)) {
      pushIssue(issues, `${path}.${field}`, "must be an array");
    }
  });

  if (Array.isArray(value.ownership)) {
    value.ownership.forEach((ownership, index) => {
      const ownershipPath = `${path}.ownership[${index}]`;
      if (!isRecord(ownership)) {
        pushIssue(issues, ownershipPath, "must be an object");
        return;
      }
      if (!isString(ownership.resource)) {
        pushIssue(issues, `${ownershipPath}.resource`, "must be a string");
      }
      if (!isString(ownership.owner)) {
        pushIssue(issues, `${ownershipPath}.owner`, "must be a string");
      }
      if (!isString(ownership.accessRules)) {
        pushIssue(issues, `${ownershipPath}.accessRules`, "must be a string");
      }
    });
  }

  if (Array.isArray(value.failureModes)) {
    value.failureModes.forEach((failureMode, index) => {
      const failurePath = `${path}.failureModes[${index}]`;
      if (!isRecord(failureMode)) {
        pushIssue(issues, failurePath, "must be an object");
        return;
      }
      if (!isString(failureMode.scenario)) {
        pushIssue(issues, `${failurePath}.scenario`, "must be a string");
      }
      if (!isString(failureMode.impact)) {
        pushIssue(issues, `${failurePath}.impact`, "must be a string");
      }
      if (!isString(failureMode.recovery)) {
        pushIssue(issues, `${failurePath}.recovery`, "must be a string");
      }
    });
  }

  if (!isRecord(value.debugging)) {
    pushIssue(issues, `${path}.debugging`, "must be an object");
  } else {
    if (!isStringArray(value.debugging.logs)) {
      pushIssue(issues, `${path}.debugging.logs`, "must be an array of strings");
    }
    if (!isStringArray(value.debugging.traces)) {
      pushIssue(issues, `${path}.debugging.traces`, "must be an array of strings");
    }
    if (!isStringArray(value.debugging.observability)) {
      pushIssue(issues, `${path}.debugging.observability`, "must be an array of strings");
    }
  }

  return true;
};

const validateSequenceScenario = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is SequenceScenario => {
  if (!isRecord(value)) {
    pushIssue(issues, path, "must be an object");
    return false;
  }

  ["id", "name", "goal", "trigger", "outcome"].forEach((field) => {
    if (!isString(value[field])) {
      pushIssue(issues, `${path}.${field}`, "must be a string");
    }
  });
  if (value.failurePath !== undefined && !isString(value.failurePath)) {
    pushIssue(issues, `${path}.failurePath`, "must be a string when provided");
  }

  if (!Array.isArray(value.participants)) {
    pushIssue(issues, `${path}.participants`, "must be an array");
  } else {
    value.participants.forEach((participant, index) => {
      const participantPath = `${path}.participants[${index}]`;
      if (!isRecord(participant)) {
        pushIssue(issues, participantPath, "must be an object");
        return;
      }
      if (!isString(participant.id)) {
        pushIssue(issues, `${participantPath}.id`, "must be a string");
      }
      if (!isString(participant.name)) {
        pushIssue(issues, `${participantPath}.name`, "must be a string");
      }
      if (!isString(participant.kind)) {
        pushIssue(issues, `${participantPath}.kind`, "must be a string");
      }
      if (participant.description !== undefined && !isString(participant.description)) {
        pushIssue(issues, `${participantPath}.description`, "must be a string when provided");
      }
    });
  }

  if (!Array.isArray(value.steps)) {
    pushIssue(issues, `${path}.steps`, "must be an array");
  } else {
    value.steps.forEach((step, index) => {
      const stepPath = `${path}.steps[${index}]`;
      if (!isRecord(step)) {
        pushIssue(issues, stepPath, "must be an object");
        return;
      }
      if (!isString(step.id)) {
        pushIssue(issues, `${stepPath}.id`, "must be a string");
      }
      if (!isString(step.fromParticipantId)) {
        pushIssue(issues, `${stepPath}.fromParticipantId`, "must be a string");
      }
      if (!isString(step.toParticipantId)) {
        pushIssue(issues, `${stepPath}.toParticipantId`, "must be a string");
      }
      if (!isString(step.message)) {
        pushIssue(issues, `${stepPath}.message`, "must be a string");
      }
      if (
        step.type !== "call" &&
        step.type !== "async" &&
        step.type !== "return" &&
        step.type !== "event"
      ) {
        pushIssue(issues, `${stepPath}.type`, "must be one of call, async, return, event");
      }
      if (step.note !== undefined && !isString(step.note)) {
        pushIssue(issues, `${stepPath}.note`, "must be a string when provided");
      }
    });
  }

  return true;
};

const validateCustomOptions = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is WorkspaceCustomOptions => {
  if (!isRecord(value)) {
    pushIssue(issues, path, "must be an object");
    return false;
  }

  [
    "interactionMechanisms",
    "dataFlowNodeKinds",
    "runtimeNodeKinds",
    "runtimeLinkKinds",
    "contextEntityKinds",
  ].forEach((field) => {
    if (!isStringArray(value[field])) {
      pushIssue(issues, `${path}.${field}`, "must be an array of strings");
    }
  });

  return true;
};

const validateIdLabelItem = (
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  requiredFields: string[],
): boolean => {
  if (!isRecord(value)) {
    pushIssue(issues, path, "must be an object");
    return false;
  }
  requiredFields.forEach((field) => {
    if (!isString(value[field])) {
      pushIssue(issues, `${path}.${field}`, "must be a string");
    }
  });
  return true;
};

const uniqueStrings = (values: string[]): string[] => Array.from(new Set(values));

export const validateWorkspaceShape = (value: unknown): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return [{ path: "$", message: "workspace must be a JSON object" }];
  }

  ["id", "title", "requirement", "createdAt", "updatedAt"].forEach((field) => {
    if (!isString(value[field])) {
      pushIssue(issues, field, "must be a string");
    }
  });

  const featureSummary = value.featureSummary;
  if (!isRecord(featureSummary)) {
    pushIssue(issues, "featureSummary", "must be an object");
  } else {
    if (!isString(featureSummary.summary)) {
      pushIssue(issues, "featureSummary.summary", "must be a string");
    }
    if (!isString(featureSummary.problem)) {
      pushIssue(issues, "featureSummary.problem", "must be a string");
    }
    ["goals", "constraints", "assumptions", "openQuestions"].forEach((field) => {
      if (!isStringArray(featureSummary[field])) {
        pushIssue(issues, `featureSummary.${field}`, "must be an array of strings");
      }
    });
  }

  const discovery = value.discovery;
  if (!isRecord(discovery)) {
    pushIssue(issues, "discovery", "must be an object");
  } else {
    if (!Array.isArray(discovery.contextEntities)) {
      pushIssue(issues, "discovery.contextEntities", "must be an array");
    } else {
      discovery.contextEntities.forEach((entity, index) => {
        validateIdLabelItem(entity, `discovery.contextEntities[${index}]`, issues, [
          "id",
          "name",
          "kind",
        ]);
      });
    }

    if (!Array.isArray(discovery.contextFlows)) {
      pushIssue(issues, "discovery.contextFlows", "must be an array");
    } else {
      discovery.contextFlows.forEach((flow, index) => {
        validateIdLabelItem(flow, `discovery.contextFlows[${index}]`, issues, [
          "id",
          "entityId",
          "direction",
          "label",
        ]);
      });
    }

    if (!isStringArray(discovery.responsibilities)) {
      pushIssue(issues, "discovery.responsibilities", "must be an array of strings");
    }

    if (!Array.isArray(discovery.candidateComponents)) {
      pushIssue(issues, "discovery.candidateComponents", "must be an array");
    } else {
      discovery.candidateComponents.forEach((candidate, index) => {
        const path = `discovery.candidateComponents[${index}]`;
        if (!validateIdLabelItem(candidate, path, issues, ["id", "name", "responsibility"])) {
          return;
        }
        if (isRecord(candidate)) {
          if (candidate.rationale !== undefined && !isString(candidate.rationale)) {
            pushIssue(issues, `${path}.rationale`, "must be a string when provided");
          }
          if (candidate.layer !== undefined && !isString(candidate.layer)) {
            pushIssue(issues, `${path}.layer`, "must be a string when provided");
          }
        }
      });
    }

    if (!Array.isArray(discovery.interactions)) {
      pushIssue(issues, "discovery.interactions", "must be an array");
    } else {
      discovery.interactions.forEach((interaction, index) => {
        validateIdLabelItem(interaction, `discovery.interactions[${index}]`, issues, [
          "fromComponentId",
          "toComponentId",
          "mechanism",
          "data",
        ]);
      });
    }

    if (!Array.isArray(discovery.dataFlowNodes)) {
      pushIssue(issues, "discovery.dataFlowNodes", "must be an array");
    } else {
      discovery.dataFlowNodes.forEach((node, index) => {
        validateIdLabelItem(node, `discovery.dataFlowNodes[${index}]`, issues, [
          "id",
          "name",
          "kind",
        ]);
      });
    }

    if (!Array.isArray(discovery.dataFlows)) {
      pushIssue(issues, "discovery.dataFlows", "must be an array");
    } else {
      discovery.dataFlows.forEach((flow, index) => {
        validateIdLabelItem(flow, `discovery.dataFlows[${index}]`, issues, [
          "id",
          "fromNodeId",
          "toNodeId",
          "label",
        ]);
      });
    }

    if (!Array.isArray(discovery.sequenceScenarios)) {
      pushIssue(issues, "discovery.sequenceScenarios", "must be an array");
    } else {
      discovery.sequenceScenarios.forEach((scenario, index) =>
        validateSequenceScenario(scenario, `discovery.sequenceScenarios[${index}]`, issues),
      );
    }

    if (!Array.isArray(discovery.runtimeNodes)) {
      pushIssue(issues, "discovery.runtimeNodes", "must be an array");
    } else {
      discovery.runtimeNodes.forEach((node, index) => {
        validateIdLabelItem(node, `discovery.runtimeNodes[${index}]`, issues, [
          "id",
          "name",
          "kind",
          "responsibility",
        ]);
      });
    }

    if (!Array.isArray(discovery.runtimeLinks)) {
      pushIssue(issues, "discovery.runtimeLinks", "must be an array");
    } else {
      discovery.runtimeLinks.forEach((link, index) => {
        validateIdLabelItem(link, `discovery.runtimeLinks[${index}]`, issues, [
          "id",
          "fromNodeId",
          "toNodeId",
          "kind",
          "label",
        ]);
      });
    }

    if (!Array.isArray(discovery.candidateTasks)) {
      pushIssue(issues, "discovery.candidateTasks", "must be an array");
    } else {
      discovery.candidateTasks.forEach((task, index) => {
        const path = `discovery.candidateTasks[${index}]`;
        if (!validateIdLabelItem(task, path, issues, [
          "id",
          "name",
          "responsibility",
          "priority",
          "type",
          "trigger",
        ])) {
          return;
        }
        if (isRecord(task) && !isBoolean(task.mayBlock)) {
          pushIssue(issues, `${path}.mayBlock`, "must be a boolean");
        }
      });
    }

    if (!isStringArray(discovery.systemRisks)) {
      pushIssue(issues, "discovery.systemRisks", "must be an array of strings");
    }

    validateCustomOptions(discovery.customOptions, "discovery.customOptions", issues);
  }

  if (!Array.isArray(value.components)) {
    pushIssue(issues, "components", "must be an array");
  } else {
    value.components.forEach((component, index) =>
      validateComponent(component, `components[${index}]`, issues),
    );
  }

  if (!isRecord(value.implementation)) {
    pushIssue(issues, "implementation", "must be an object");
  } else {
    if (!Array.isArray(value.implementation.units)) {
      pushIssue(issues, "implementation.units", "must be an array");
    } else {
      value.implementation.units.forEach((unit, index) => {
        const path = `implementation.units[${index}]`;
        if (!validateIdLabelItem(unit, path, issues, ["id", "name", "kind", "responsibility"])) {
          return;
        }
        if (!isRecord(unit)) {
          return;
        }
        [
          "requirementRefs",
          "componentIds",
          "runtimeNodeIds",
          "candidateTaskIds",
          "interfaces",
          "files",
        ].forEach((field) => {
          if (!isStringArray(unit[field])) {
            pushIssue(issues, `${path}.${field}`, "must be an array of strings");
          }
        });
        if (unit.notes !== undefined && !isString(unit.notes)) {
          pushIssue(issues, `${path}.notes`, "must be a string when provided");
        }
      });
    }

    if (!Array.isArray(value.implementation.steps)) {
      pushIssue(issues, "implementation.steps", "must be an array");
    } else {
      value.implementation.steps.forEach((step, index) => {
        const path = `implementation.steps[${index}]`;
        if (!validateIdLabelItem(step, path, issues, ["id", "name", "goal"])) {
          return;
        }
        if (!isRecord(step)) {
          return;
        }
        if (!isStringArray(step.moduleIds)) {
          pushIssue(issues, `${path}.moduleIds`, "must be an array of strings");
        }
        if (!isStringArray(step.verification)) {
          pushIssue(issues, `${path}.verification`, "must be an array of strings");
        }
        if (step.notes !== undefined && !isString(step.notes)) {
          pushIssue(issues, `${path}.notes`, "must be a string when provided");
        }
      });
    }

    if (!isStringArray(value.implementation.rules)) {
      pushIssue(issues, "implementation.rules", "must be an array of strings");
    }
  }

  if (issues.length > 0) {
    return issues;
  }

  const workspace = value as FeatureWorkspace;
  const candidateIds = new Set(workspace.discovery.candidateComponents.map((candidate) => candidate.id));
  const componentIds = new Set(workspace.components.map((component) => component.id));
  const objectIdsByComponent = new Map(
    workspace.components.map((component) => [
      component.id,
      new Set(component.objects.map((object) => object.id)),
    ]),
  );
  const contextEntityIds = new Set(workspace.discovery.contextEntities.map((entity) => entity.id));
  const dataFlowNodeIds = new Set(workspace.discovery.dataFlowNodes.map((node) => node.id));
  const runtimeNodeIds = new Set(workspace.discovery.runtimeNodes.map((node) => node.id));
  const candidateTaskIds = new Set(workspace.discovery.candidateTasks.map((task) => task.id));
  const implementationUnitIds = new Set(workspace.implementation.units.map((unit) => unit.id));

  workspace.discovery.contextFlows.forEach((flow, index) => {
    if (!contextEntityIds.has(flow.entityId)) {
      pushIssue(
        issues,
        `discovery.contextFlows[${index}].entityId`,
        `references missing context entity '${flow.entityId}'`,
      );
    }
  });

  workspace.discovery.interactions.forEach((interaction, index) => {
    if (!candidateIds.has(interaction.fromComponentId)) {
      pushIssue(
        issues,
        `discovery.interactions[${index}].fromComponentId`,
        `references missing candidate component '${interaction.fromComponentId}'`,
      );
    }
    if (!candidateIds.has(interaction.toComponentId)) {
      pushIssue(
        issues,
        `discovery.interactions[${index}].toComponentId`,
        `references missing candidate component '${interaction.toComponentId}'`,
      );
    }
  });

  workspace.discovery.dataFlows.forEach((flow, index) => {
    if (!dataFlowNodeIds.has(flow.fromNodeId)) {
      pushIssue(
        issues,
        `discovery.dataFlows[${index}].fromNodeId`,
        `references missing data flow node '${flow.fromNodeId}'`,
      );
    }
    if (!dataFlowNodeIds.has(flow.toNodeId)) {
      pushIssue(
        issues,
        `discovery.dataFlows[${index}].toNodeId`,
        `references missing data flow node '${flow.toNodeId}'`,
      );
    }
  });

  workspace.discovery.sequenceScenarios.forEach((scenario, scenarioIndex) => {
    const participantIds = new Set(scenario.participants.map((participant) => participant.id));
    scenario.steps.forEach((step, stepIndex) => {
      if (!participantIds.has(step.fromParticipantId)) {
        pushIssue(
          issues,
          `discovery.sequenceScenarios[${scenarioIndex}].steps[${stepIndex}].fromParticipantId`,
          `references missing participant '${step.fromParticipantId}'`,
        );
      }
      if (!participantIds.has(step.toParticipantId)) {
        pushIssue(
          issues,
          `discovery.sequenceScenarios[${scenarioIndex}].steps[${stepIndex}].toParticipantId`,
          `references missing participant '${step.toParticipantId}'`,
        );
      }
    });
  });

  workspace.discovery.runtimeNodes.forEach((node, index) => {
    if (node.hostNodeId && !runtimeNodeIds.has(node.hostNodeId)) {
      pushIssue(
        issues,
        `discovery.runtimeNodes[${index}].hostNodeId`,
        `references missing runtime node '${node.hostNodeId}'`,
      );
    }
  });

  workspace.discovery.runtimeLinks.forEach((link, index) => {
    if (!runtimeNodeIds.has(link.fromNodeId)) {
      pushIssue(
        issues,
        `discovery.runtimeLinks[${index}].fromNodeId`,
        `references missing runtime node '${link.fromNodeId}'`,
      );
    }
    if (!runtimeNodeIds.has(link.toNodeId)) {
      pushIssue(
        issues,
        `discovery.runtimeLinks[${index}].toNodeId`,
        `references missing runtime node '${link.toNodeId}'`,
      );
    }
  });

  workspace.components.forEach((component, componentIndex) => {
    const objectIds = objectIdsByComponent.get(component.id) ?? new Set<string>();
    component.objectInteractions.forEach((interaction, interactionIndex) => {
      if (!objectIds.has(interaction.fromObjectId)) {
        pushIssue(
          issues,
          `components[${componentIndex}].objectInteractions[${interactionIndex}].fromObjectId`,
          `references missing object '${interaction.fromObjectId}' in component '${component.id}'`,
        );
      }
      if (!objectIds.has(interaction.toObjectId)) {
        pushIssue(
          issues,
          `components[${componentIndex}].objectInteractions[${interactionIndex}].toObjectId`,
          `references missing object '${interaction.toObjectId}' in component '${component.id}'`,
        );
      }
    });

    component.objects.forEach((object, objectIndex) => {
      const stateNames = uniqueStrings(object.states.map((state) => state.name));
      object.states.forEach((state, stateIndex) => {
        state.transitions.forEach((transition, transitionIndex) => {
          if (!stateNames.includes(transition.targetState)) {
            pushIssue(
              issues,
              `components[${componentIndex}].objects[${objectIndex}].states[${stateIndex}].transitions[${transitionIndex}].targetState`,
              `references missing state '${transition.targetState}' in object '${object.id}'`,
            );
          }
        });
      });
    });
  });

  workspace.implementation.units.forEach((unit, unitIndex) => {
    unit.componentIds.forEach((componentId, componentRefIndex) => {
      if (!componentIds.has(componentId)) {
        pushIssue(
          issues,
          `implementation.units[${unitIndex}].componentIds[${componentRefIndex}]`,
          `references missing component '${componentId}'`,
        );
      }
    });
    unit.runtimeNodeIds.forEach((runtimeNodeId, runtimeRefIndex) => {
      if (!runtimeNodeIds.has(runtimeNodeId)) {
        pushIssue(
          issues,
          `implementation.units[${unitIndex}].runtimeNodeIds[${runtimeRefIndex}]`,
          `references missing runtime node '${runtimeNodeId}'`,
        );
      }
    });
    unit.candidateTaskIds.forEach((candidateTaskId, taskRefIndex) => {
      if (!candidateTaskIds.has(candidateTaskId)) {
        pushIssue(
          issues,
          `implementation.units[${unitIndex}].candidateTaskIds[${taskRefIndex}]`,
          `references missing candidate task '${candidateTaskId}'`,
        );
      }
    });
  });

  workspace.implementation.steps.forEach((step, stepIndex) => {
    step.moduleIds.forEach((moduleId, moduleRefIndex) => {
      if (!implementationUnitIds.has(moduleId)) {
        pushIssue(
          issues,
          `implementation.steps[${stepIndex}].moduleIds[${moduleRefIndex}]`,
          `references missing implementation unit '${moduleId}'`,
        );
      }
    });
  });

  return issues;
};

export const parseWorkspaceForArcFlow = (value: unknown): FeatureWorkspace => {
  const issues = validateWorkspaceShape(value);
  if (issues.length === 0) {
    return value as FeatureWorkspace;
  }

  const preview = issues
    .slice(0, 12)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join("\n");
  const suffix =
    issues.length > 12 ? `\n...and ${issues.length - 12} more validation issue(s).` : "";
  throw new Error(`Workspace JSON does not fit ArcFlow expectations:\n${preview}${suffix}`);
};
