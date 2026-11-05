# ShiftFlow

A responsive, browser-local shift planning and volume performance app built with React, strict TypeScript, Vite, Lucide and Recharts. No backend or employee data is required.

## Run locally

Install Node.js 22 or newer, then from this folder:

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. For verification:

```sh
npm test
npm run build
```

The production output is `dist/`. Serve that folder on an approved static host with HTTPS. No server-side secrets or API keys are required. The app does not use path-based routing.

## Daily workflow

1. Open Shift Setup and enter the shift date, goal, UPH, staffing and start/end times.
2. Add breaks and adjust their productivity percentages. Correct any field errors.
3. Generate the plan. Capacity shortages remain visible; the original goal is retained.
4. Record actual whole units in the Hourly Tracker or dashboard table. Blank means unreported; zero means reported with no output.
5. Review matching-period variance, remaining capacity and the performance forecast. Completed shifts display final results.
6. Save reusable shift hours, staffing, breaks and productivity in Settings, then choose Use saved defaults in setup.

Revising a plan with recorded actuals requires explicit confirmation. Actuals are preserved by matching date, interval start and duration. Changes that would remove or shift recorded intervals are blocked; create a new shift instead. Previous baselines are retained and the original is reviewable. New shift archives the active shift; use the saved-shift selector to reopen it. Deleting a current shift requires confirmation. Editing the form alone does not alter the active plan.

## Calculations and assumptions

`src/engine.ts` is independent of React. Intervals begin at the shift start and end after at most 60 minutes. Break overlap is calculated in exact minutes. Overlapping breaks are rejected. Capacity is UPH × headcount × effective hours. Productivity percentages are absolute fractions of full output, independently configurable for normal operation and each break.

Allocation uses capacity weights and deterministic largest remainders with chronological tie breaking and integer interval limits. An integer-capacity shortfall is disclosed even when theoretical fractional capacity is sufficient. Required constant staffing is rounded up. A zero-capacity shift is supported and clearly infeasible for a positive goal.

Times use scheduled wall-clock minutes rather than timezone-aware elapsed timestamps. An overnight end time is interpreted as the next day; identical start/end is invalid. On DST transition dates, a 00:00–04:00 shift has four scheduled hours. Repeated local times cannot be represented individually in v1. Interval IDs include date, start and offset. The configurable safety limit defaults to 16 hours (maximum 24; equal-time 24-hour shifts are not supported).

Actual totals include all entered intervals. Cumulative comparisons and cumulative actual chart points include only the consecutive completed prefix. A gap is explicitly flagged. Recovery capacity includes all unreported intervals. Forecast is actual volume divided by completed planned targets, multiplied by remaining planned targets, plus actual volume; zero completed target volume produces Awaiting actuals. Forecasts may exceed capacity and are estimates, separate from capacity feasibility.

## Data and architecture

`src/main.tsx`: app navigation, setup, settings, charts and tracking components.
`src/engine.ts`: typed configuration, validation, interval planning, allocation and tracking.
`src/engine.test.ts`: automated calculation tests.
`src/style.css`: responsive accessible UI, including horizontally scrollable tracking on small screens.

The versioned `shiftflow-v1` localStorage record stores active and archived shifts, revision records, actuals and defaults. Storage errors show a visible notice. Data stays in this browser profile and is not synced between devices. Clearing browser data removes it. Extract the persistence adapter and introduce authenticated storage for future multi-user support; the pure planning engine does not depend on browser storage.

The recommended Tailwind/shadcn styling stack is replaced by a compact custom CSS design system and native accessible form controls to minimize dependencies. No future-scope cloud, employee, historical or dynamic staffing features are included.
## Verification

- 14 automated calculation tests pass, including deterministic allocation, exact capacity limits, overnight breaks, partial intervals, DST wall-clock semantics, missing actuals and recovery forecasts.
- Production build passes with strict TypeScript checking.
- Dependency installation audit reported zero vulnerabilities after updates.
- Browser checks verified actual entry, persistence after reload, baseline confirmation with preserved actuals, shift archiving and reopening, and desktop/tablet rendering.
- The chart bundle exceeds Vite's default 500 kB warning threshold; it is compressed by production hosting. Future optimization can lazy-load charts.
- Publication has not occurred. Source upload requires the user's approval of the private Sites destination.
