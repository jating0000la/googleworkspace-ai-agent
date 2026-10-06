# Google Workspace AI Agent
### Google Apps Script + OpenRouter + Telegram + Drive + Docs + Sheets + Slides

This project turns a **Google Sheet-bound Apps Script project** into an OpenAI-style tool-using agent.

The LLM does not receive unrestricted code execution. It receives a curated set of Workspace tools. The model requests a tool call, Apps Script validates and executes it, returns the result to the model, and the model continues until it can answer.

## What is included

- Telegram webhook interface
- Durable Telegram job queue
- OpenRouter tool-calling loop
- Default free tool-capable model: `nvidia/nemotron-3-ultra-550b-a55b:free`
- Automatic fallback: `openrouter/free`
- Google Drive search/list/create-folder/move/rename/export-PDF tools
- Google Docs create/read/append/replace/table tools
- Google Sheets create/read/write/append/formula/chart tools
- Existing `CalculationEngine.gs` exposed as a specialized spreadsheet-analysis tool
- Google Slides complete-deck generator, reader, slide adder and text replacement
- Four presentation themes: `light`, `dark`, `muxro`, `healthcare`
- Session memory and current-file context
- Tool-call audit log
- Sidebar chat UI and settings UI
- Secure Telegram allow-list
- Non-destructive default tool set: no delete/trash tool is exposed

## Project files

```text
Config.gs
Utils.gs
Database.gs
Queue.gs
Telegram.gs
OpenRouter.gs
ToolRegistry.gs
ToolExecutor.gs
DriveTools.gs
DocsTools.gs
SheetsTools.gs
SlidesTools.gs
Agent.gs
Setup.gs
Tests.gs
CalculationEngine.gs
Agent_Sidebar.html
appsscript.json
```

---

# 1. Install into your existing Google Sheet

Use the Google Sheet that currently contains your Business AI / CalculationEngine project.

1. Open the Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Back up your existing project first.
4. Remove or rename the old `AI_Sidebar.gs`, `AI_Sidebar_openrouter_free.gs`, and old `AI_Sidebar.html` if they define duplicate global functions such as `onOpen()`, `callOpenRouter()`, or `showAISidebar()`.
5. Add every `.gs` file from this package.
6. Add `Agent_Sidebar.html` as an HTML file named exactly `Agent_Sidebar`.
7. Replace your existing `CalculationEngine.gs` with the included patched version. The patch only adds a fallback to the bound host spreadsheet for time-driven Telegram jobs.
8. In Apps Script Project Settings, enable **Show "appsscript.json" manifest file in editor**.
9. Replace your project manifest with the included `appsscript.json`.
10. Save the project.

> The new agent does not need your previous browser WebLLM sidebar. OpenRouter now runs server-side and the existing CalculationEngine is used as one specialized tool.

---

# 2. Run the installer

In the Apps Script editor choose the function:

```text
installAgent
```

and click **Run**.

Authorize the requested Google permissions.

`installAgent()` does four things:

1. Records the bound Google Sheet as the host spreadsheet.
2. Creates a private spreadsheet named **Google Workspace AI Agent - Private DB**.
3. Creates `Sessions`, `Queue`, and `AuditLog` tabs.
4. Installs a one-minute `processAgentQueue` trigger.

After this, reload the Google Sheet.

You should see:

```text
🤖 Workspace Agent
```

in the menu.

Choose:

```text
🤖 Workspace Agent → Open Agent
```

---

# 3. Configure OpenRouter

In the sidebar open **Settings**.

Enter your OpenRouter API key.

Default model:

```text
nvidia/nemotron-3-ultra-550b-a55b:free
```

You can replace it with any OpenRouter model that supports `tools`.

The project automatically falls back to:

```text
openrouter/free
```

if the selected model call fails.

Click:

```text
Save Settings
Test OpenRouter
```

The API key is stored in Apps Script **Script Properties** and is not sent to the browser after saving.

---

# 4. Create the Telegram bot

In Telegram:

1. Open **@BotFather**.
2. Run `/newbot`.
3. Choose a bot name and username.
4. Copy the Bot Token.
5. Paste it into **Workspace Agent → Settings → Telegram Bot Token**.
6. Save Settings.
7. Click **Test Telegram**.

Do not publish the bot token.

---

# 5. Deploy Apps Script as a Web App

Telegram needs a public HTTPS webhook.

In Apps Script:

```text
Deploy → New deployment
```

Choose:

```text
Type: Web app
Execute as: Me / User deploying
Who has access: Anyone
```

The manifest is configured for anonymous web-app access because Telegram's servers are not signed into your Google account.

The web endpoint is still protected by:

- a generated random webhook key in the URL;
- a Telegram user-ID allow-list.

After deploying, reload the sidebar.

It should now show a **Web app** link.

Click:

```text
Install Telegram Webhook
```

---

# 6. Authorize your Telegram account

Initially the Telegram allow-list can be blank. Blank means **deny all Telegram users**.

Send any message to the bot.

It will reply with your Telegram numeric user ID, for example:

```text
Your Telegram user ID is: 123456789
```

Copy the number into:

```text
Workspace Agent → Settings → Allowed Telegram User IDs
```

For multiple users:

```text
123456789,987654321
```

Save Settings.

Now send:

```text
/start
```

---

# 7. How Telegram processing works

Incoming Telegram requests are intentionally queued.

```text
Telegram
   ↓
Apps Script doPost()
   ↓
Validate webhook key
   ↓
Validate Telegram user ID
   ↓
Queue job
   ↓
Immediate Telegram acknowledgement
   ↓
1-minute Apps Script trigger
   ↓
Agent loop
   ↓
OpenRouter tool call
   ↓
Google Workspace tool
   ↓
OpenRouter final response
   ↓
Telegram
```

This is more reliable than trying to hold the Telegram webhook open during long presentation/document operations.

---

# 8. Example commands

### Google Drive

```text
Find my latest Kerala healthcare proposal.
```

```text
Find all presentations with "Business Automation" in the name.
```

### Google Docs

```text
Create a Google Doc called "Business Automation SOP" from these notes: ...
```

```text
Find my CRM proposal, read it, and append a section called Implementation Timeline.
```

```text
Replace "old company name" with "Muxro Technologies" in the proposal.
```

### Google Sheets

```text
Create a spreadsheet called Sales Follow-up Tracker with columns Date, Lead, Owner, Status, Next Follow-up.
```

```text
Open the sales sheet and read A1:H50. Summarize the main issues.
```

```text
Put a SUM formula in G52.
```

```text
Create a column chart from A1:B12.
```

### Existing CalculationEngine

```text
In the current business spreadsheet, calculate total sales for HSD.
```

The agent can use `sheet_calculate_current`, which calls your existing verified `calculate(request)` engine.

### Google Slides

```text
Create a 12-slide professional presentation called "Business Automation System".
Use a title slide, problem section, process explanation, benefits, implementation roadmap and closing slide.
```

```text
Find my Kerala health proposal and create a 15-slide healthcare-theme presentation from it.
```

```text
In the presentation you just created, add one more slide explaining the implementation timeline.
```

The agent remembers the current presentation ID in session context, so follow-up commands can refer to "the presentation you just created".

### Export

```text
Export the presentation you just created to PDF.
```

---

# 9. Telegram commands

```text
/start
/help
/model
/model nvidia/nemotron-3-ultra-550b-a55b:free
/reset
/status
```

`/reset` clears conversation memory and current-file context for that Telegram session.

---

# 10. Presentation design engine

`slides_create_deck` accepts an entire deck specification in one tool call.

Supported slide types:

```text
title
section
content
two_column
quote
closing
```

Supported themes:

```text
light
dark
muxro
healthcare
```

A deck is limited to 40 slides in one `slides_create_deck` call to keep Apps Script execution bounded.

Publicly accessible image URLs can be inserted into slides. If an image URL is invalid or inaccessible, the deck continues without failing.

---

# 11. Memory

The private DB spreadsheet stores:

### Sessions

- channel
- Telegram/user ID
- chat ID
- selected model
- recent conversation history
- current document/spreadsheet/presentation/folder IDs

### Queue

- request
- state
- attempt count
- errors
- result summary

### AuditLog

- tool name
- tool arguments
- tool result
- user/session
- success/failure

The OpenRouter API key and Telegram token are **not** stored in this database. They are stored in Script Properties.

---

# 12. Security model

This build intentionally uses a narrow tool surface.

The LLM can request only functions defined in `ToolRegistry.gs`.

Before execution:

1. the tool must exist;
2. required top-level arguments are checked;
3. undeclared top-level parameters are rejected;
4. the actual action is executed by hard-coded Apps Script, never by model-generated JavaScript.

There is no arbitrary `eval()`, shell execution, or LLM-generated Apps Script execution.

No delete/trash function is exposed in v1.

For Telegram, keep **Execute as user deploying** and maintain a strict numeric Telegram user-ID allow-list.

---

# 13. Important Apps Script behavior

Apps Script executions are time-bounded, so this project uses:

- composite tools such as `slides_create_deck`;
- bounded Drive searches;
- bounded Sheet reads;
- bounded document reads;
- a Telegram queue;
- a tool-step limit;
- a soft agent execution budget.

For very large jobs, split the request into logical stages or say `continue` after the agent reaches its run budget.

---

# 14. Smoke test

Run:

```text
runAgentSmokeTests
```

Then inspect the execution log.

It verifies:

- tool registry loads without duplicate names;
- private database is available;
- trigger/settings diagnostics;
- CalculationEngine presence.

You can also run individually:

```text
testOpenRouterConnection
testTelegramConnection
diagnoseAgent
```

---

# 15. Current limitations

This v1 intentionally focuses on reliable Workspace operations.

Not yet included:

- Telegram photo/document attachment ingestion;
- Gmail;
- Google Calendar;
- arbitrary file deletion;
- automatic image generation;
- real-time token streaming into Telegram;
- granular approval prompts before each write;
- Google Docs structural insertion at an arbitrary cursor/bookmark;
- pixel-level editing of an existing presentation theme/master.

The architecture is modular, so those can be added as more tools without changing the agent loop.

---

# 16. Recommended first test

After installation, use the sidebar first:

```text
Create a Google Doc called "Agent Test" and add:
Google Workspace AI Agent is working correctly.
```

Then:

```text
Create a 5-slide presentation called "Agent Test Presentation" explaining what this agent can do.
```

If both work, configure Telegram and send:

```text
Find "Agent Test" in my Drive and tell me what type of file it is.
```

That validates OpenRouter, Drive permissions, Docs/Slides creation, tool calls, memory, and Telegram end-to-end.
#   g o o g l e w o r k s p a c e - a i - a g e n t  
 