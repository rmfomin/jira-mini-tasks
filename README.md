# Jira Mini Tasks

Personal to-do list with Jira Dashboard integration.

## Features

### Creating and Editing Tasks

- Adding tasks: Type text and press `Enter` or click the `➤` button
- Editing: Click on a task to edit it
- Saving changes: `Enter` to save, `Esc` to cancel
- Deleting: Click the cross icon in the top-right corner of the task

### Jira Integration

- Automatic recognition: Type an issue key (e.g., `ITSS-12345`)

### Date Labels

Add a date using the `@` symbol:

- `@today` / `@сегодня` — Today
- `@tomorrow` / `@завтра` — Tomorrow
- `@thisweek` / `@этанеделя` — This week
- `@nextweek` / `@следнеделя` — Next week
- `@later` / `@позже` / `@позднее` — Later
- `@забыто` — Forgotten (1 year ago)

Features:

- Date is shown as a button with the `＠` symbol
- On hover, displays exact date or date range
- Overdue tasks are marked in red
- Remove date via cross icon on hover

### Sorting

- **"⇅ По дате" button**: Sorts tasks by date labels
- **Order**: Today → Tomorrow → This week → Next week → Later → Forgotten → No date
- Drag'n'Drop

---

## 🚀 Installation

Before using the plugin, you need to create a widget in Jira Dashboard:

- Find the gadget container element with an ID like `gadget-20269`
- Open `src/constants.js` and replace the value numberId
- Rebuild the project:

```bash
npm install              # Install dependencies
npm run build           # Build project → dist/jira-mini-tasks.user.js
npm run dev             # Development mode with auto-rebuild
```
