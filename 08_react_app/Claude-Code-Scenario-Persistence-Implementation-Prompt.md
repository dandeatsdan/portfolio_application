# Claude Code Implementation Prompt — Scenario Persistence

Use this prompt in Claude Code to implement persistent, reloadable, editable scenarios in the React/FastAPI application.

**Later UI decision:** omit the Save As control. Users name or rename a scenario through the existing text field and Save; New scenario starts a separate record. This supersedes Save As UI requirements below. Saved scenarios are accessed through a small button beneath the Home Build a Scenario card that opens the shared right-hand panel.

---

You are working in the repository `dandeatsdan/portfolio_application`.

Before changing code, read:

- `CLAUDE.md`
- `08_react_app/README.md`
- `08_react_app/frontend/src/App.jsx`
- `08_react_app/frontend/src/hooks/useScenario.js`
- `08_react_app/frontend/src/hooks/scenarioInstructions.js`
- `08_react_app/frontend/src/pages/BuildScenario.jsx`
- `08_react_app/backend/main.py`
- `08_react_app/backend/schemas.py`
- `08_react_app/backend/routers/scenario.py`
- existing backend and frontend tests relevant to scenario state and execution

Do not assume the architecture from this brief is more current than the code. Inspect the repository first and adapt the implementation to existing patterns where appropriate.

## Objective

Implement **scenario persistence** for the React application.

The key requirement is not merely to save scenario results. A user must be able to:

1. build a scenario;
2. save it;
3. leave the page or restart the application;
4. reopen that saved scenario later;
5. restore the scenario into the **Build a Scenario** screen;
6. continue editing the shortlist, case inclusion/exclusion decisions, operations and parameters;
7. run the modified scenario again;
8. save changes to the existing scenario or use **Save As** to create a new scenario.

A saved scenario is therefore primarily a **persisted scenario definition / configuration**, not an archived output dataframe.

The application should maintain a clear distinction between:

- **Saved scenario** — persistent backend record;
- **Working scenario** — editable React state currently loaded into the Build a Scenario screen.

Opening a saved scenario should create/edit a working copy in React. User edits must not silently overwrite persistence until the user explicitly chooses Save.

## Current architecture to preserve

The React app already uses a FastAPI backend and the shared Python scenario-modelling package. Preserve this separation.

Current scenario state is split across the frontend:

- `SelectionContext` in `App.jsx` owns the shortlisted case IDs;
- `useScenario.js` owns scenario `name`, `description`, `rationale`, `caseConfig`, execution state and the latest hook-local result;
- `caseConfig` is keyed by case ID and contains the current scenario configuration such as `include`, `operation` and `params`;
- the existing scenario engine and `/api` execution flow must remain the source of truth for calculations.

Scenario persistence must faithfully serialise and rehydrate **both shortlist membership and the scenario configuration**. Do not implement a save mechanism that restores metadata but loses shortlist state or per-case operation settings.

## Functional requirements

### 1. Scenario data model

Create a persistent scenario entity with at least:

- `scenario_id` — stable unique identifier, preferably UUID;
- `name`;
- `description`;
- `rationale`;
- `created_at`;
- `updated_at`;
- `shortlisted_case_ids`;
- `case_configurations` keyed by case ID, preserving the frontend scenario contract required to restore editing;
- a lightweight schema/version field so the persisted payload can evolve safely later.

You may store the scenario configuration as JSON within the persistence layer if this produces a simpler and more maintainable implementation than normalising every parameter into relational columns.

Keep the representation lossless relative to current React editing state. Preserve parameter order and the exact engine-facing operation values used by the current application.

Do **not** redesign the scenario engine's operation model as part of this feature.

### 2. Persistence technology

**User decision, 10 September 2026:** use one JSON file per saved scenario instead of SQLite. This supersedes the original SQLite recommendation.

Requirements:

- persistence survives backend/application restart while the storage folder remains on disk;
- isolate file access behind a small repository abstraction;
- store files in `08_react_app/app_data/scenarios/`, with an optional `SCENARIO_STORAGE_DIR` override;
- name files using server-generated UUIDs, not user-entered scenario names;
- write a temporary file in the same directory, flush it, then atomically replace the destination;
- reject corrupt/unsupported records without silently resetting them; list healthy records alongside file errors;
- prevent stale updates using an expected modified timestamp;
- ignore generated storage files in Git;
- keep this a local, single-process prototype; no database server or new storage dependency.

### 3. Backend API

Add a dedicated saved-scenario API rather than overloading the existing scenario execution endpoint.

Provide the equivalent of:

- `GET /api/scenarios` — list saved scenarios using lightweight summary records;
- `GET /api/scenarios/{scenario_id}` — retrieve the complete persisted scenario definition;
- `POST /api/scenarios` — create/save a new scenario and return its assigned ID plus persisted metadata;
- `PUT /api/scenarios/{scenario_id}` — update an existing saved scenario;
- `DELETE /api/scenarios/{scenario_id}` — delete a saved scenario, or archive it if an archive pattern already exists in the codebase.

Use proper Pydantic request/response schemas. Validate malformed IDs, duplicate/invalid data and missing records cleanly using appropriate HTTP status codes.

Do not make scenario execution dependent on a scenario having been saved. Unsaved working scenarios must still run exactly as they do now.

### 4. Frontend API layer

Extend the existing frontend API/client pattern rather than creating ad hoc `fetch` calls in page components.

Provide functions for:

- listing saved scenarios;
- loading one saved scenario;
- creating a scenario;
- updating a scenario;
- deleting a scenario if implemented in the UI.

Keep HTTP details outside presentation components.

### 5. Rehydrating an editable scenario

This is the most important requirement.

When a saved scenario is opened, restore:

- scenario name;
- description;
- rationale;
- shortlist membership into `SelectionContext`;
- all stored case configurations into the working scenario state used by `useScenario`;
- operation parameter values exactly as stored.

The restored scenario must then behave exactly like a manually constructed working scenario. The user must be able to:

- add or remove shortlist cases;
- change include/exclude state;
- change operations;
- change parameters;
- reset case configurations;
- run the scenario through the existing engine;
- save the changed configuration.

Be careful with existing `initCases` behaviour so loading a saved scenario does not overwrite restored configurations with defaults.

Add an explicit, tested rehydration method to `useScenario` if that is cleaner than setting each state field separately. For example, a method conceptually equivalent to `loadScenario(savedScenario)` or `replaceScenarioState(...)` is preferable to fragile page-level state mutation.

### 6. Open/navigation behaviour

Implement a simple Saved Scenarios entry point using the existing UI style.

A sensible V1 is:

- show a **Saved Scenarios** section on the Home page, or another clearly accessible location consistent with the application design;
- list scenario name and modified date;
- clicking Open navigates to Build a Scenario and loads that persisted scenario;
- use a stable route/query mechanism, for example `/build?scenario=<uuid>`, if that fits the current router cleanly;
- direct navigation to a saved scenario should work without requiring an already-populated in-memory scenario context.

Do not rely only on `navigate(..., { state })` for the persisted scenario definition because browser refresh would lose it.

Handle loading, not-found and backend-error states cleanly.

### 7. Save / Save As workflow

On Build a Scenario add restrained controls consistent with the existing interface:

- **Save**;
- **Save As**;
- a small status indicator such as `Unsaved changes` or `Saved`.

Behaviour:

- a newly constructed scenario has no persistent `scenario_id`;
- Save on a new scenario creates it and retains the returned ID as the currently opened saved scenario;
- Save on an already-opened saved scenario updates that scenario;
- Save As always creates a new scenario with a new ID and then treats that new scenario as the current persisted scenario;
- editing any persisted scenario metadata, shortlist membership or case configuration after a successful save should mark the working scenario dirty;
- successful save clears the dirty state;
- a failed save must not clear dirty state or corrupt the working scenario;
- do not implement continuous autosave in V1.

Avoid modal complexity unless needed. Reuse existing dialog/component patterns where appropriate.

### 8. Scenario results

For V1, do **not** turn persistence into a result-versioning project.

The persisted scenario definition is the primary requirement.

When a saved scenario is reopened:

- restore its configuration;
- do not pretend that an old result is current;
- the user should run the scenario normally to calculate results from the currently loaded reference data.

It is acceptable to store lightweight last-run metadata later, but full result snapshots, result history, reference-data versioning and scenario revision history are outside this change unless they are trivial consequences of the implementation.

### 9. Optimisation compatibility — design only, do not implement optimiser here

The persistence model should allow a future optimisation service to generate an ordinary editable scenario and save it through the same scenario contract.

Do not build the optimiser in this task.

Avoid persistence assumptions that would make optimisation results a separate incompatible object type. Future flow should be possible as:

`Optimiser recommendation -> ordinary working scenario -> user reviews/modifies -> Save / Save As`.

A future field such as `creation_method` (`manual`, `optimisation`, `duplicated`) may be added if it is low-cost and useful, but it is not a reason to expand this feature substantially.

## Important behavioural constraints

Preserve existing application behaviour unless explicitly changed above:

- all loaded cases remain included by reference by default;
- shortlist membership remains distinct from inclusion/exclusion in the scenario run;
- removing a case from the shortlist continues to restore its reference/no-change behaviour;
- scenario execution still uses the existing engine and validation logic;
- failed runs continue to preserve the previous successful Scenario Results behaviour;
- existing Post-tax, NPV, reference measure and scenario result behaviour must not regress;
- do not change calculation logic while implementing persistence;
- do not alter the Streamlit application's behaviour as part of this task.

## Suggested code organisation

Adapt to repository conventions after inspection, but an acceptable shape would be:

```text
08_react_app/
├── backend/
│   ├── persistence/
│   │   ├── database.py
│   │   └── scenario_repository.py
│   ├── routers/
│   │   ├── scenario.py
│   │   └── saved_scenarios.py
│   └── schemas.py
└── frontend/
    └── src/
        ├── api/
        │   └── client.js
        ├── hooks/
        │   └── useScenario.js
        ├── pages/
        │   ├── Home.jsx
        │   └── BuildScenario.jsx
        └── components/
            └── ...
```

Do not create extra layers/files merely to match this diagram. Prefer the smallest coherent implementation consistent with existing code quality.

## Testing requirements

Add automated tests covering both persistence and rehydration.

Backend tests should cover at least:

1. create scenario;
2. list scenario;
3. retrieve complete scenario;
4. update scenario;
5. delete/not-found behaviour if delete is exposed;
6. JSON files survive repository/service recreation;
7. malformed persisted/request configuration is rejected appropriately.

Frontend/unit tests should cover at least:

1. serialising the current working scenario into the save payload;
2. rehydrating a saved scenario into `useScenario` state;
3. shortlist IDs are restored correctly;
4. include/exclude state, operation and all parameters survive save/load round-trip;
5. editing after load sets dirty state;
6. Save updates an existing ID rather than creating a duplicate;
7. Save As creates a new ID;
8. loading a persisted scenario is not overwritten by default initialisation.

Add a round-trip test with at least:

- one No Change shortlisted case;
- one modified operation with non-zero parameters;
- one explicitly excluded shortlisted case.

After implementation run the existing regression suites as documented in `08_react_app/README.md`, plus the new tests and frontend production build.

Do not weaken or delete existing tests merely to make the change pass.

## Documentation

Update `08_react_app/README.md` to explain:

- that scenarios can now be persisted;
- where persistence is stored for local development;
- the Save / Save As / Open behaviour;
- that reopening restores the editable configuration and the user must rerun to produce current results;
- that scenario persistence is local prototype storage and not an enterprise multi-user database;
- any new setup or migration steps, if required.

If `.gitignore` changes are required, document only the meaningful reason.

## Non-goals for this change

Do not implement:

- optimisation/MILP;
- user authentication;
- shared multi-user scenario ownership;
- cloud database deployment;
- real-time collaboration;
- autosave;
- full audit/version history;
- reference-data snapshotting;
- historical result replay;
- engine or tax/NPV calculation changes;
- broad UI redesign.

## Definition of done / acceptance criteria

The feature is complete when all of the following are demonstrably true:

1. I can create a scenario on Build a Scenario, including shortlist selections and case operations.
2. I can save it and receive a stable persistent scenario ID.
3. I can restart the backend/frontend and still see the saved scenario.
4. I can open that scenario from the application.
5. Opening it restores the correct shortlist, scenario metadata, inclusion decisions, operations and parameter values.
6. I can modify the reopened scenario using the existing Build a Scenario controls.
7. I can run the modified scenario through the existing engine successfully.
8. Save updates the existing saved scenario.
9. Save As produces an independent scenario with a new ID.
10. Unsaved edits are visibly distinguished from the last persisted state.
11. Existing scenario calculations and regression tests continue to pass.
12. The JSON files/generated persistence artefacts are not committed to Git.
13. The README accurately describes the new behaviour and limitations.

## Working approach

Implement this as a focused feature, not a refactor of the whole application.

Before coding, briefly summarise:

- what you found in the current scenario state flow;
- the files you expect to change;
- your persistence schema and rehydration approach;
- any compatibility risk you found.

Then implement the feature, run tests/builds, fix regressions, and finish with a concise summary containing:

- files changed;
- persistence/API design;
- frontend load/save behaviour;
- tests executed and results;
- any manual browser checks still recommended.

Do not claim browser behaviour has been verified if only unit/build tests were run.
