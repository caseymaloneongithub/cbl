# Design Guidelines: Strat League Auction Platform

## Design Approach: Material Design System
**Rationale**: Information-dense application requiring clear data hierarchy, real-time feedback, and robust form patterns. Material Design provides excellent structure for tables, forms, and interactive elements with strong visual feedback.

## Core Design Principles
1. **Data Clarity First**: Bid information, timers, and player stats must be immediately scannable
2. **Action-Oriented**: CTAs for bidding should be prominent and unambiguous
3. **Real-time Awareness**: Live bid updates and countdown timers require clear visual treatment
4. **Baseball Context**: Professional sports aesthetic without cartoonish elements

---

## Typography System

**Font Stack**: Roboto (primary), Roboto Mono (data/numbers)
- **Headings**: Roboto Bold, tight letter-spacing for impact
  - H1: 2.5rem (page titles)
  - H2: 2rem (section headers)
  - H3: 1.5rem (card headers, player names)
- **Body Text**: Roboto Regular, 1rem base size
- **Data/Numbers**: Roboto Mono Medium for bids, contract years, timers
- **Labels**: Roboto Medium, 0.875rem, uppercase with tracking

---

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8
- Standard padding: p-6 for cards, p-8 for main containers
- Tight spacing: gap-2 for form fields, gap-4 for card grids
- Generous spacing: mb-8 between major sections

**Grid System**:
- Desktop: max-w-7xl centered container
- Commissioner dashboard: 2-column layout (controls + preview)
- Free agent listings: Single column with full-width table
- Owner portfolio: 3-column card grid for active bids

---

## Component Library

### Navigation
**Top App Bar** (sticky):
- League name/logo left-aligned
- Navigation links center (Free Agents | My Bids | Leaderboard)
- User profile + role badge right-aligned (Commissioner badge if applicable)
- Subtle elevation shadow when scrolling

### Data Tables (Free Agent Listings)
**Structure**:
- Columns: Player Name | Position | Current Bid | Years | Total Value | High Bidder | Time Remaining | Actions
- Sticky header row
- Alternating row treatment for scannability
- Sortable columns with clear indicators
- Highlight row on hover with subtle elevation

**Countdown Timers**:
- Display format: "2d 14h 23m" or "45m 12s" for < 1 hour
- Urgent state (< 1 hour): emphasized treatment
- Expired state: clear "CLOSED" indicator

### Bidding Interface
**Modal Dialog** (triggered from table action):
- Player name and current bid prominent at top
- Two-column form layout:
  - Left: Dollar amount input (large, clear)
  - Right: Years selector (1-5, chip selection)
- Calculated total value displayed prominently below inputs
- "Submit Bid" primary button (full-width)
- Current bid history timeline below form (last 5 bids)

**Auto-bid Card**:
- Toggle switch to enable/disable
- Max bid amount input
- Strategy indicator showing "Will bid up to $X over Y years"
- Warning message about auction end time

### Cards
**Player Bid Cards** (Owner Portfolio):
- Player name bold at top
- Bid amount large and centered
- Contract details secondary
- Status badge: "WINNING" (success), "OUTBID" (alert), "WON" (neutral)
- Card elevation with border accent based on status

### Commissioner Tools
**Upload Section**:
- Drag-and-drop CSV zone with dashed border
- File preview table showing parsed data
- Year factor inputs (1x through 5x) in horizontal chip group
- "Publish Free Agents" prominent button

### Forms
**Input Fields**:
- Outlined style with floating labels
- Helper text below for format guidance
- Error states with specific validation messages
- Number inputs with increment/decrement steppers for bids

**Buttons**:
- Primary: filled, rounded corners, clear affordance
- Secondary: outlined
- Icon buttons for actions (edit, delete)

---

## Responsive Behavior

**Mobile (< 768px)**:
- Stack table into card-based view
- Single column forms
- Bottom sheet for bidding modal
- Hamburger navigation

**Tablet (768px - 1024px)**:
- Maintain table view with horizontal scroll
- 2-column card grids

**Desktop (> 1024px)**:
- Full table layouts
- 3-column card grids
- Side-by-side commissioner controls

---

## Baseball Theming

**Subtle Sport Context**:
- Baseball diamond icon in logo/branding
- Position badges styled like jersey numbers
- Field-inspired divider lines (base paths as visual separators)
- Professional sports broadcast aesthetic for data presentation
- Avoid literal baseball imagery; focus on clean, competitive UI

---

## Key Interactions

- **Real-time Updates**: Toast notifications for outbid alerts
- **Bid Submission**: Clear confirmation with confetti micro-animation
- **Timer Warnings**: Pulsing effect when < 5 minutes remain
- **Auto-bid Trigger**: Subtle indicator when auto-bid places bid
- Keep animations minimal and purposeful

---

## Images

**No hero images required** - this is a utility-focused application where data and functionality are primary.