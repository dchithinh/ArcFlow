# STM32F4 TaskManager with FreeRTOS and LCD UI using LVGL

## Feature Summary

Build a firmware feature for an STM32F4-based system that supervises multiple FreeRTOS tasks and presents task and system health on an LCD through LVGL, while keeping the UI responsive and isolated from time-critical RTOS behavior.

## Feature Requirements

- The firmware shall supervise multiple application tasks on an STM32F4 platform using FreeRTOS.
- The firmware shall present task status and system health information on an LCD using the LVGL framework.
- The UI path shall remain responsive without disturbing time-critical or high-priority RTOS work.
- The design shall separate task supervision, UI rendering, event and message transport, and display hardware adaptation.
- The feature shall support future extension for user interaction such as buttons or touch input when present.

## Feature Responsibilities

- Supervise and organize application tasks under FreeRTOS.
- Track task state, runtime status, and health information for presentation.
- Coordinate task lifecycle, status collection, and fault visibility through a task manager boundary.
- Update the LCD UI through LVGL with task and system information.
- Separate UI rendering logic from RTOS task-control logic.
- Move status and events from worker tasks to the UI layer through safe RTOS communication paths.
- Protect shared resources used by LVGL, display drivers, and status data.
- Handle periodic UI refresh, LVGL tick processing, and display flushing.
- Expose failures such as task timeout, overload, queue overflow, or display update failure in a diagnosable way.

## Constraints

- Target platform is an STM32F4 microcontroller with limited RAM and flash.
- FreeRTOS is required for task scheduling and synchronization.
- LVGL is required for the LCD UI framework.
- UI updates must not block time-critical or high-priority tasks.
- Memory allocation should be controlled and preferably static where practical.
- Display refresh and LVGL tick handling must be deterministic and integrated safely with RTOS timing.
- Task communication must use explicit RTOS-safe mechanisms such as queues, event groups, notifications, or mutexes.
- Shared state shown on the UI must have clear ownership and synchronization rules.
- The system should remain stable if the LCD or UI update path slows down or temporarily fails.
- LCD driver details should remain below the feature-level logic.

## Assumptions

- The LCD hardware and low-level display driver are already selected.
- LVGL is available in the firmware build and can be integrated with the STM32F4 platform layer.
- Core application tasks already exist or will be added around the task manager feature.
- The system may add button or touch input later, but the first version can remain display-centric.

## Open Questions

- Which task metrics must be shown live on the LCD: state only, CPU usage, stack watermark, fault state, or message counters?
- Should the UI allow user control over tasks, or remain display-only for the first version?
- Will display refresh run in a dedicated UI task or be coordinated by the task manager?
- What watchdog or recovery behavior is expected if the UI task stalls?
