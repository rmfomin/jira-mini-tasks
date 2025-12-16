# Jira Mini Tasks

Personal to-do list with Jira Dashboard integration.

## 🎯 Features

### ✏️ Creating and Editing Tasks

- **Adding tasks**: Type text and press `Enter` or click the `➤` button
- **Editing**: Click on a task to edit it
- **Saving changes**: `Enter` to save, `Esc` to cancel
- **Deleting**: Click the cross icon in the top-right corner of the task
- **Line breaks**: All line breaks are preserved in task text

### 🔗 Jira Integration

- **Automatic recognition**: Type an issue key (e.g., `UI-5788`)
- **Data fetching**: Automatically loads issue summary from Jira
- **Clickable link**: Issue is displayed as a button with Jira logo and truncated summary (25 characters)
- **Removing link**: Hover over the Jira button and click the cross icon
- **Validation**: If issue is not found, a red border appears and saving is blocked

### 📅 Date Labels

Add a date using the `@` symbol:

**Supported keywords:**

- `@today` / `@сегодня` — Today
- `@tomorrow` / `@завтра` — Tomorrow
- `@thisweek` / `@этанеделя` — This week
- `@nextweek` / `@следнеделя` — Next week
- `@later` / `@позже` / `@позднее` — Later
- `@забыто` — Forgotten (1 year ago)

**Display:**

- Date is shown as a button with the `＠` symbol
- On hover, displays exact date or date range
- Overdue tasks are marked in red
- Remove date via cross icon on hover

### ✅ Status Management

- **Mark as done**: Click the checkbox on the left of the task
- **Visual styling**: Completed tasks get a gray background and green "✓ Выполнено" label
- **Automatic sorting**: Completed tasks always move to the bottom
- **Date removal**: Date label is automatically removed when task is marked as done

### 🔄 Sorting

- **"⇅ По дате" button**: Sorts tasks by date labels
- **Order**: Today → Tomorrow → This week → Next week → Later → Forgotten → No date
- **Button states**:
  - Gray-blue (inactive)
  - Blue (active after click)
  - Returns to gray-blue after drag-and-drop

### 🎨 Drag & Drop

- **Dragging**: Click and drag a task to change its order
- **Auto-reset sorting**: After dragging, the sort button is deactivated
- **Order persistence**: Changed order is saved automatically

### 📋 Jira Page Integration

- **Automatic display**: When opening a Jira issue, if it exists in your task list, an info block appears under the page header
- **Shows**:
  - Date label (if present)
  - Task text
  - Task creation time
- **Design**: Blue background, max-width 900px, 20px left margin

---

## 🚀 Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) extension for your browser
2. Download the `dist/jira-mini-tasks.user.js` file
3. Open Tampermonkey Dashboard and import the file
4. Done! Open [Jira Dashboard](https://jira.theteamsoft.com/secure/)

## 🛠️ Development

### Building the project

```bash
npm install              # Install dependencies
npm run build           # Build project → dist/jira-mini-tasks.user.js
npm run dev             # Development mode with auto-rebuild
```

### Project structure

```
src/
├── constants.js        # Constants (selectors, keys, intervals)
├── utils/              # Utilities (DOM, polling)
├── api/jira.js         # Jira REST API wrapper
├── storage/index.js    # localStorage operations
├── dnd/index.js        # Drag & Drop logic
├── ui/                 # UI components
├── bootstrap.js        # Widget initialization
├── index.js            # Entry point (routing)
└── jira-page-integration.js  # Jira page integration

scripts/
├── header.txt          # Tampermonkey metadata
└── build.mjs           # Build configuration (esbuild)
```
