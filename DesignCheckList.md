# Firmware Feature / System Design Checklist

> Purpose:
> A repeatable thinking framework for firmware & embedded system design.
>
> Use this EVERY TIME when receiving:
> - a new feature
> - a bugfix requiring architecture changes
> - a new subsystem
> - a communication protocol
> - an RTOS-based design
>
> Goal:
> Think like a system engineer instead of jumping directly into code.

---

# 0. FEATURE SUMMARY

## What is this feature?
- [ ] One-sentence feature summary
- [ ] Why does this feature exist?
- [ ] What user/system problem does it solve?

## Constraints
- [ ] Real-time requirement?
- [ ] Memory limitation?
- [ ] CPU limitation?
- [ ] Power limitation?
- [ ] Safety/reliability requirement?
- [ ] Scalability requirement?

---

# 1. SYSTEM PURPOSE

## Define the system behavior
- [ ] What should the system DO?
- [ ] What should the system NOT do?
- [ ] What is considered success?
- [ ] What is considered failure?

## Define feature boundaries
- [ ] What belongs to this feature?
- [ ] What does NOT belong to this feature?

---

# 2. INPUTS / OUTPUTS

## Inputs
- [ ] User input?
- [ ] Sensor input?
- [ ] UART/CAN/network packets?
- [ ] Timer events?
- [ ] Interrupts?
- [ ] External hardware signals?

## Outputs
- [ ] Motor/control outputs?
- [ ] Communication packets?
- [ ] Logs?
- [ ] UI updates?
- [ ] Persistent storage?
- [ ] State changes?

---

# 3. EVENTS

## What triggers behavior?
- [ ] Interrupt events
- [ ] Timer events
- [ ] Message received
- [ ] State transition
- [ ] Timeout
- [ ] Error events
- [ ] User actions

## Event characteristics
- [ ] Periodic?
- [ ] Event-driven?
- [ ] Burst traffic possible?
- [ ] High-frequency?
- [ ] Latency-sensitive?

---

# 4. STATES

## Define system states
- [ ] INIT
- [ ] IDLE
- [ ] RUNNING
- [ ] ERROR
- [ ] RECOVERY
- [ ] SHUTDOWN

## State transition thinking
- [ ] What transitions are valid?
- [ ] What events trigger transitions?
- [ ] What transitions are illegal?
- [ ] What happens on unexpected events?

## Error states
- [ ] Recoverable?
- [ ] Fatal?
- [ ] Retry strategy?
- [ ] Watchdog reset needed?

---

# 5. RESPONSIBILITY DECOMPOSITION

> Think in responsibilities, NOT files/tasks.

## Define responsibilities
- [ ] Who acquires data?
- [ ] Who processes data?
- [ ] Who owns system state?
- [ ] Who handles communication?
- [ ] Who handles logging?
- [ ] Who handles recovery?

## Subsystems/modules
- [ ] Communication subsystem
- [ ] Sensor subsystem
- [ ] Control subsystem
- [ ] Storage subsystem
- [ ] Monitoring subsystem

## Responsibility quality check
- [ ] Is each module focused?
- [ ] Does any module know too much?
- [ ] Is coupling too high?
- [ ] Can modules evolve independently?

---

# 6. INTERACTIONS & DATA FLOW

## Define interactions
- [ ] Who talks to who?
- [ ] Who triggers who?
- [ ] Is communication synchronous or asynchronous?
- [ ] Is data copied or shared?

## Communication mechanisms
- [ ] Queue
- [ ] Event group
- [ ] Task notification
- [ ] Callback
- [ ] Shared memory
- [ ] Ring buffer

## Draw flows
- [ ] Event flow
- [ ] Data flow
- [ ] Task interaction flow
- [ ] ISR → task flow

---

# 7. RTOS / CONCURRENCY DESIGN

> RTOS comes AFTER behavior understanding.

## Task design
- [ ] Which parts truly need concurrency?
- [ ] Which tasks are periodic?
- [ ] Which tasks are event-driven?
- [ ] Which tasks may block?

## Task priorities
- [ ] High-priority real-time tasks
- [ ] Medium-priority processing tasks
- [ ] Low-priority background tasks

## Synchronization
- [ ] Shared resources?
- [ ] Mutex needed?
- [ ] Semaphore needed?
- [ ] Lock-free possible?

## Timing analysis
- [ ] Worst-case execution time
- [ ] Queue overflow risk
- [ ] Priority inversion risk
- [ ] Starvation risk
- [ ] Deadlock risk

---

# 8. RESOURCE OWNERSHIP

## Data ownership
- [ ] Who owns buffers?
- [ ] Who allocates memory?
- [ ] Who frees memory?
- [ ] Is ownership explicit?

## Shared state
- [ ] Shared variables?
- [ ] Protected correctly?
- [ ] Atomic operations needed?
- [ ] ISR-safe access?

## Memory management
- [ ] Static allocation preferred?
- [ ] Heap fragmentation risk?
- [ ] Stack sizing estimated?

---

# 9. FAILURE ANALYSIS

> Think like the system is already failing.

## Failure scenarios
- [ ] Queue full
- [ ] Packet corruption
- [ ] Sensor timeout
- [ ] Communication loss
- [ ] Task crash
- [ ] Memory exhaustion
- [ ] ISR flood
- [ ] Watchdog reset

## Recovery strategy
- [ ] Retry?
- [ ] Reset subsystem?
- [ ] Enter safe state?
- [ ] Log error?
- [ ] Full reboot?

## Safety
- [ ] Unsafe outputs possible?
- [ ] Fault containment?
- [ ] Recovery deterministic?

---

# 10. LAYERED ARCHITECTURE

## Define layers
- [ ] Application layer
- [ ] Service layer
- [ ] Driver layer
- [ ] HAL/BSP layer

## Dependency rules
- [ ] Upper layer depends on lower only?
- [ ] Any circular dependency?
- [ ] Clear abstraction boundaries?

## Interface design
- [ ] APIs minimal?
- [ ] Responsibilities clear?
- [ ] Hidden implementation details?

---

# 11. DEBUGGABILITY

## Logging
- [ ] Useful logs?
- [ ] Timestamped?
- [ ] Log levels?
- [ ] Trace events?

## Debug strategy
- [ ] How to reproduce failures?
- [ ] Timing measurement available?
- [ ] State visibility available?
- [ ] Queue monitoring available?

## Observability
- [ ] Can system behavior be inspected?
- [ ] Can timing be measured?
- [ ] Can failures be diagnosed remotely?

---

# 12. IMPLEMENTATION PLANNING

## Before coding
- [ ] APIs defined?
- [ ] State machine defined?
- [ ] Task interaction defined?
- [ ] Ownership defined?
- [ ] Failure handling defined?

## Incremental implementation
- [ ] Minimum working slice first?
- [ ] Test each subsystem independently?
- [ ] Validate concurrency gradually?

---

# 13. REVIEW CHECKLIST

## Simplicity
- [ ] Can this design be simpler?
- [ ] Too many tasks?
- [ ] Too many layers?
- [ ] Too much shared state?

## Maintainability
- [ ] Can another engineer understand this?
- [ ] Can bugs be isolated easily?
- [ ] Can modules be replaced independently?

## Scalability
- [ ] Can features grow safely?
- [ ] Can event load increase safely?
- [ ] Can more devices/sensors be added?

---

# 14. AI REVIEW PROMPTS

## Architecture review
```text
Review this firmware architecture.
Focus on:
- coupling
- unclear ownership
- scalability
- maintainability