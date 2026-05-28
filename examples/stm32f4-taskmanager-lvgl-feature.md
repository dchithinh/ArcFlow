# STM32F4 TaskManager with FreeRTOS and LCD UI using LVGL

## Requirement

Build a firmware feature for an STM32F4-based system that manages multiple application tasks under FreeRTOS and presents task and system status on an LCD using the LVGL framework. The feature should initialize and coordinate the RTOS task manager, maintain task state and health information, update the display with system status and task data, handle user interaction from the LCD or UI layer when present, and keep the UI responsive without disturbing time-critical RTOS behavior. The design should clearly separate task supervision, UI rendering, event and message passing, and hardware abstraction for the display.

## Constraints

- Target platform is STM32F4 microcontroller with limited RAM and flash.
- FreeRTOS is required for task scheduling and synchronization.
- LVGL is required for the LCD UI framework.
- UI updates must not block time-critical or high-priority tasks.
- Memory allocation should be controlled and preferably static where practical.
- Display refresh and LVGL tick handling must be deterministic and integrated safely with RTOS timing.
- Task communication must use explicit RTOS-safe mechanisms such as queues, event groups, notifications, or mutexes.
- Shared state shown on the UI must have clear ownership and synchronization rules.
- The system should remain stable if the LCD or UI update path slows down or temporarily fails.
- The design should be portable enough that LCD driver details stay below the feature-level logic.

## Responsibilities

- Supervise and organize application tasks under FreeRTOS.
- Track task state, runtime status, and health information for presentation.
- Provide a task manager boundary that coordinates task lifecycle, status collection, and fault visibility.
- Update the LCD UI through LVGL with task and system information.
- Separate UI rendering logic from RTOS task-control logic.
- Move status and events from worker tasks to the UI layer through safe RTOS communication paths.
- Protect shared resources used by LVGL, display drivers, and status data.
- Handle periodic UI refresh, LVGL tick processing, and display flushing.
- Expose failures such as task timeout, overload, queue overflow, or display update failure in a diagnosable way.
- Support future extension for buttons, touch input, or menu navigation if the LCD hardware includes input capability.

## Goals

- Maintain a responsive LCD status UI while application tasks continue to meet timing expectations.
- Make task state, health, and runtime behavior visible to the operator.
- Keep component boundaries explicit between task supervision, UI rendering, display transport, and hardware abstraction.
- Allow future UI growth without redesigning the RTOS task structure.

## Assumptions

- The LCD hardware and low-level display driver are already selected.
- LVGL is available in the firmware build and can be integrated with the STM32F4 platform layer.
- The product either has a touch panel or may add button or touch input later.
- Core application tasks already exist or will be added around the task manager feature.

## Open Questions

- Which task metrics must be shown live on the LCD: state only, CPU usage, stack watermark, fault state, or message counters?
- Should the UI allow user control over tasks, or remain display-only for the first version?
- Will the display refresh run in a dedicated UI task or be coordinated by the task manager?
- What watchdog or recovery behavior is expected if the UI task stalls?
