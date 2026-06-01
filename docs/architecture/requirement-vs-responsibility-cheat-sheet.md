# Requirement vs Responsibility Cheat Sheet

## Short Version

- **Requirement** = what the feature must do
- **Responsibility** = what the system must own internally to make that happen

## How To Think

Ask these two questions in order:

1. What must be true for the feature to be considered correct?
   Those are **requirements**.

2. What jobs must the system take on to make those requirements happen?
   Those are **responsibilities**.

## Writing Rules

### Requirements

- Write from the feature or user expectation point of view.
- Prefer `Feature shall ...`
- Keep them externally visible and testable.
- Avoid implementation detail when possible.

Examples:

- Feature shall provide a UART terminal interface for user command entry.
- Feature shall support update date and time command.
- Feature shall reject unknown commands safely.

### Responsibilities

- Write from the system design point of view.
- Use internal action verbs like:
  - receive
  - parse
  - validate
  - dispatch
  - update
  - store
  - respond
  - protect
- These usually help reveal component boundaries.

Examples:

- Receive UART bytes and detect command boundaries.
- Parse command tokens and arguments.
- Validate command syntax and supported command names.
- Dispatch valid commands to the correct handler.
- Generate success or error response messages.

## Simple Test

- If it sounds like something you would put in an acceptance test or feature spec, it is probably a **requirement**.
- If it sounds like something you would assign to a subsystem or component, it is probably a **responsibility**.

## Example Pairing

Requirement:

- Feature shall support get date and time via command.

Responsibilities:

- Parse the get-date-time command.
- Query the owned date/time source.
- Format the response payload.
- Return the value through UART.

## Fast Template

### Requirements

- Feature shall ...
- Feature shall ...
- Feature shall ...

### Responsibilities

- Receive ...
- Parse ...
- Validate ...
- Dispatch ...
- Store or update ...
- Respond ...
