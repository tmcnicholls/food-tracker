# Product Requirements Document: MAN v FAT Weekly Food Journal PWA

**Version:** 1.1  
**Status:** Draft  
**Product type:** Mobile-first Progressive Web App (PWA)  
**Hosting:** Free static hosting, preferably GitHub Pages  
**Primary platform:** iPhone / iOS Safari  
**Primary user:** A MAN v FAT Football participant maintaining their weight

## 1. Product overview

### 1.1 Problem statement

MAN v FAT Football participants are expected to demonstrate weekly food tracking as part of the programme's scoring mechanism. The user's previous approach was to record basic meals in Apple Notes, without calorie counting.

Now that the user has reached maintenance weight, the priority is sustainable consistency rather than restrictive dieting or detailed nutritional analysis. The tracking process should remain simple, realistic and quick to complete.

The application must provide a structured weekly food journal featuring familiar British meals, with configurable meal-planning preferences and an easy export into Apple Notes.

### 1.2 Product vision

Create a free, lightweight, mobile-first PWA that helps users maintain a consistent food journal with minimal administrative effort.

The app should feel like a practical food diary, not a diet app. It should encourage balanced, realistic family meals and make weekly record-keeping straightforward.

### 1.3 Product principles

1. **Maintenance, not restriction:** No calorie counting, macro targets or weight-loss recommendations.
2. **Sustainable consistency:** Prioritise repeatable habits and realistic meals.
3. **British food culture:** Use familiar UK terminology, ingredients, portions and meal conventions.
4. **Low friction:** Generate, review and copy a week's journal in under two minutes.
5. **Honest records:** Generated meals are suggestions until confirmed or edited to reflect what was actually eaten.
6. **Free and private:** No subscription, account, paid API or backend required.

## 2. Goals and non-goals

### 2.1 Goals

- Generate a seven-day food journal for a configurable week.
- Default to Tuesday–Monday to match MAN v FAT session days.
- Include Breakfast, Lunch, Tea and Snacks for every day.
- Generate realistic meals based on the selected weekly consistency level.
- Support optional Saturday takeaway meals.
- Show a RAG-style status indicator for each day.
- Allow users to edit and confirm meals quickly.
- Export the journal as plain text using a copy button.
- Export the journal as two shareable images for weeks the user cannot attend.
- Work on an iPhone home screen and in mobile Safari.
- Host the application entirely for free.

### 2.2 Non-goals

The MVP must not include:

- Calorie, macro or micronutrient tracking.
- Weight tracking or body composition calculations.
- User accounts, authentication or cloud synchronisation.
- Paid APIs, AI inference or third-party meal-generation services.
- Grocery ordering, shopping integrations or recipe scraping.
- Social sharing, leaderboards or MAN v FAT account integrations. (Handing images to the device's own share sheet so the user can send them to their team — FR-09 — is not social sharing: the app never posts anything or contacts a server.)
- Medical advice or weight-loss targets.

## 3. Target user and primary use case

A participant attends a weekly football session on Tuesday. They want to maintain a simple record of meals from Tuesday through to the following Monday, showing a coach that their tracking is current.

Their desired workflow is:

1. Open the PWA on their phone.
2. Select the week start date, defaulting to Tuesday.
3. Choose Great, Medium or Poor as the planning profile.
4. Optionally enable a Saturday takeaway.
5. Generate a realistic suggested food journal.
6. Review, edit and confirm meals to reflect what they actually ate.
7. Copy the journal.
8. Paste it into Apple Notes.

The workflow should not require calorie calculations, lengthy forms or recipe research.

### 3.1 Secondary use case: away weeks

Some weeks the participant cannot attend — working away, or on holiday. Their tracking still needs to reach the coach, so a teammate shows it on their behalf. The participant:

1. Reviews the week as usual.
2. Enters their name once (remembered on the device).
3. Creates two images of the week.
4. Shares them to the team's group chat, or saves them to Photos first.
5. A teammate opens the images and shows them to the coach.

The teammate does not need the app; the images must stand on their own.

## 4. Functional requirements

### FR-01: Weekly food journal generation

**Priority:** P0 — Must have

The app must generate a journal containing seven consecutive days.

Each day must contain the following meal categories in this order:

- Breakfast
- Lunch
- Tea
- Snacks

Requirements:

- Each category must contain a realistic meal or food description.
- The week must follow the configured start date.
- The default start day must be Tuesday.
- A Tuesday-starting week must end on the following Monday.
- Dates and weekdays must be displayed clearly.
- The user must be able to regenerate a suggested week.
- Regeneration must create variation rather than repeatedly returning the same fixed sequence.
- Previously confirmed or edited entries must not be silently overwritten. The user must explicitly choose to replace them.

Meal descriptions should be concise enough to read comfortably on a phone and copy into Notes.

Examples:

- Breakfast: Porridge with banana.
- Lunch: Chicken salad wrap and an apple.
- Tea: Homemade spaghetti bolognese with side salad.
- Snacks: Greek yoghurt and a handful of almonds.

These examples are illustrative; the application must generate a broader selection.

### FR-02: Weekly consistency profile

**Priority:** P0 — Must have

Provide a three-option selector:

- Great
- Medium
- Poor

**Default: Great.**

The selector controls the type of suggested meal plan, not an assertion about the user's actual adherence.

| Profile | Expected characteristics |
|---|---|
| Great | Consistent, balanced meals; planned breakfasts and lunches; home-cooked weekday teas; snacks chosen deliberately. |
| Medium | Generally balanced meals with some convenience foods, less structured lunches or occasional extra treats. |
| Poor | A less structured week, including more convenience foods, irregular meal choices and more discretionary snacks. |

All profiles should produce plausible, non-judgemental food choices.

Additional rules:

- Avoid implying that one week makes someone a failure or success.
- Do not prescribe a calorie deficit.
- Do not make Poor synonymous with excessive eating.
- Do not automatically mark a day green simply because Great was selected.
- Use the profile to generate a suggested pattern; actual day status must depend on the user's confirmed entries and their own assessment of consistency.

### FR-03: Saturday takeaway option

**Priority:** P0 — Must have

Provide a checkbox:

`[ ] Include a takeaway meal on Saturday`

Default: unchecked.

When enabled:

- Include a takeaway as Saturday's Tea.
- Randomly choose a takeaway category when generating the plan.
- Support at least the following categories:
  - Chinese
  - Indian
  - Kebab
  - Pizza
  - Greek gyros
- Include a plausible meal description for the chosen category.
- Vary the selection between generated weeks.
- Avoid changing the takeaway selection on every render or page refresh.
- Preserve the selection when the user edits other settings.

Example outputs:

- Chinese: Chicken chow mein and spring rolls.
- Indian: Chicken tikka masala, rice and naan.
- Kebab: Chicken kebab with salad and pitta.
- Pizza: Pizza with a side salad.
- Greek gyros: Chicken gyros in a pitta with salad and tzatziki.

The meal descriptions should be illustrative, not nutritional assessments.

If the option is disabled, Saturday's Tea should be selected from the normal meal library.

### FR-04: Configurable week start

**Priority:** P0 — Must have

Provide a week-start configuration control with all seven weekdays available.

Default: Tuesday.

The date range must always span seven consecutive calendar days, including the selected start date.

Examples:

| Start day | End day |
|---|---|
| Tuesday | Following Monday |
| Monday | Following Sunday |
| Sunday | Following Saturday |

Requirements:

- Display the actual date next to each weekday.
- Calculate dates correctly across month and year boundaries.
- Use local calendar dates rather than UTC conversions that could shift a day.
- Preserve the configured start weekday between visits.
- Provide a clear indication of the selected week's date range.

The user must be able to select a specific start date, rather than only a weekday, to ensure the exported journal corresponds to the correct week.

### FR-05: Meal editing and confirmation

**Priority:** P0 — Must have

Generated meal suggestions must be editable before export.

Each meal entry must support:

- Editing its text.
- Confirming that it reflects what was eaten.
- Leaving an entry unconfirmed until reviewed.
- Replacing a suggestion with a different meal.
- Indicating when a meal was skipped or differed from the plan.

A quick-edit interaction should be usable on a phone without opening a separate complex form.

The app must distinguish between suggested meals and confirmed journal entries. Export should clearly identify any unconfirmed entries rather than silently representing them as verified meals.

### FR-06: Daily RAG status

**Priority:** P0 — Must have

Display a RAG-style emoji beside each day's heading:

- 🟢 Green — The user confirms the day's log is complete and considers their consistency on track.
- 🟠 Amber — The day is partially logged or the user considers adherence mixed.
- 🔴 Red — The user reports that the day was off plan or inconsistent.

Provide a simple status control for each day. The status must be editable independently of the meal plan.

Rules:

- New days begin with a neutral/unassessed state until the user reviews them.
- Incomplete entries must not automatically appear green.
- The status must not be derived solely from the Great, Medium or Poor profile.
- Allow the user to update a status after correcting their entries.
- Use emojis as well as colour so the status remains understandable in plain text and for users who cannot distinguish colours.

Suggested daily completion rule: a day can be marked green only when all four meal categories have been reviewed and the user explicitly confirms the day's status.

### FR-07: Copy to Apple Notes

**Priority:** P0 — Must have

Provide a prominent button labelled **Copy journal**.

The button must:

- Copy the journal as plain text.
- Include all seven days in chronological order.
- Include each day's date, weekday, RAG emoji and four meal categories.
- Preserve readable line breaks and spacing.
- Avoid HTML markup, tables that copy poorly, or unnecessary interface text.
- Use the Clipboard API where supported.
- Provide a fallback or helpful error message if clipboard access is unavailable.
- Display a success confirmation when copying succeeds.

Example output format:

    MAN v FAT — Weekly Food Journal
    Week: Tuesday 13 October – Monday 19 October

    Tuesday 13 October 🟢
    Breakfast: Porridge with banana
    Lunch: Chicken salad wrap and an apple
    Tea: Homemade spaghetti bolognese
    Snacks: Greek yoghurt

    Wednesday 14 October 🟠
    Breakfast: Scrambled eggs on wholemeal toast
    Lunch: Jacket potato with tuna and sweetcorn
    Tea: Chicken fajitas with peppers
    Snacks: Banana and a handful of nuts

    [Continue for the remaining five days]

The application must never invent dates or present an unconfirmed suggested meal as a confirmed record.

### FR-08: Persistence

**Priority:** P0 — Must have

Use browser local storage to retain:

- User preferences.
- Selected week and start date.
- Generated meal suggestions.
- User-edited meal descriptions.
- Meal confirmation states.
- Daily RAG statuses.
- Saturday takeaway preference and selected takeaway.
- The user's name for shared images (FR-09).

Requirements:

- Refreshing the page must not lose work.
- Reopening the PWA must restore the current journal where browser storage remains available.
- Changing weeks must not overwrite another week's journal.
- Provide an explicit action to start a new journal.
- Ask for confirmation before deleting or replacing a journal with existing edits.
- Include a way to clear locally stored journals and preferences.

Data should remain on the device. No information should be transmitted to an external service.

### FR-09: Share as images

**Priority:** P1 — Should have

Provide a **Share with your team** section in the Export area that turns the current week into images a teammate can show to the coach.

The feature must:

- Provide a **Your name** field, stored locally with the other preferences, and require a name before creating images so the coach knows whose journal it is.
- Create exactly two portrait 9:16 PNG images at 1080 × 1920: days 1–4 on the first and days 5–7 on the second.
- Show on every image: "MAN v FAT · Weekly Food Journal", the user's name, the week's date range, a page indicator (1 / 2, 2 / 2), and which days that image covers.
- Show for each day: weekday and date, its RAG status as a coloured marker plus a word (On track / Mixed / Off plan), and all four meal categories.
- Follow the same content rules as the plain-text export (FR-07): days not yet reviewed show no status, unconfirmed meals appear as plain text, and skipped meals read "Skipped".
- Use a fixed light colour scheme, so the images look the same whatever theme the app uses.
- Keep text readable: long meal descriptions wrap, and the layout shrinks (and, if needed, limits the lines per meal, ending with an ellipsis) so that nothing ever runs off the image.
- Show a preview of both images before sharing.
- Where the browser supports sharing files (Web Share API Level 2; iOS Safari 15+), offer a **Share or save images** button that opens the system share sheet with both files, allowing **Save Images** to Photos or sending straight to a messaging app. The files must be prepared before that button is tapped, because iOS may reject a share started after asynchronous work.
- Where file sharing is unsupported, hide that button and fall back to saving each preview image with a long press, plus download links.
- Discard the preview whenever the journal, the selected week or the name changes, so outdated images are never shared.
- Draw the images on the device with the browser's canvas, with no third-party library, network request or server.
- Include no calorie values, macro figures or weight targets (AC-13).

## 5. User interface and experience

### 5.1 Main screen

The main screen should be designed for portrait mobile use.

Recommended layout:

1. Application title: **Weekly Food Journal**
2. Selected date range.
3. Week-start date selector.
4. Consistency profile selector.
5. Saturday takeaway checkbox.
6. Generate / regenerate button.
7. Seven daily journal sections.
8. Copy journal button.
9. Share with your team: name field, create images, preview and share (FR-09).
10. New week action.

Use collapsible day sections if necessary to keep the screen manageable, but ensure the full week can be reviewed without excessive navigation.

### 5.2 Daily journal section

Each day should display:

- Weekday and date.
- RAG status.
- Breakfast.
- Lunch.
- Tea.
- Snacks.
- Edit controls.
- Meal confirmation indicators.

On smaller screens, use a single-column layout with readable text and sufficiently large touch targets.

### 5.3 Interaction principles

- No mandatory sign-up.
- No modal dialog for every meal edit.
- No calorie or macro fields.
- Clear feedback after generating, saving or copying.
- Confirm destructive actions.
- Preserve edits when navigating between sections.
- Avoid excessive animation and unnecessary decorative elements.

## 6. Meal content and generation logic

### 6.1 Meal library

Implement a bundled library of meals in JSON or JavaScript data structures.

The app must work without network calls to third-party food services.

The meal library should include at least:

**Breakfast**
- Porridge with fruit.
- Weetabix or another familiar cereal with milk.
- Scrambled eggs on wholemeal toast.
- Toast with peanut butter or a light spread.
- Greek yoghurt with fruit and granola.
- Overnight oats.
- Boiled eggs and toast.

**Lunch**
- Chicken salad wrap.
- Tuna jacket potato.
- Ham and cheese sandwich with fruit.
- Leftover pasta.
- Baked beans on toast.
- Soup with wholemeal bread.
- Egg mayonnaise sandwich with salad.
- Chicken and rice leftovers.

**Weekday tea**
- Spaghetti bolognese.
- Chicken fajitas.
- Sausage traybake with potatoes and vegetables.
- Chicken curry with rice.
- Cottage pie with vegetables.
- Homemade burgers with potatoes.
- Salmon with new potatoes and greens.
- Chicken pasta bake.
- Stir-fry with rice or noodles.
- Chilli con carne.
- Roast chicken dinner.
- Homemade fish pie.

**Snacks**
- Fruit.
- Greek yoghurt.
- Nuts.
- Cheese and crackers.
- Hummus and carrot sticks.
- Toast.
- A small chocolate bar.
- Oatcakes.
- A cereal bar.

The library should use UK English and realistic household ingredients. Avoid recipes requiring specialist equipment, expensive ingredients or extensive preparation on typical weekdays.

### 6.2 Generation algorithm

Use deterministic, testable client-side logic.

1. Read the configured start date and selected consistency profile.
2. Generate seven dates, advancing one calendar day at a time.
3. Select a breakfast, lunch, tea and snacks entry for each day.
4. Prefer easy family meals on Monday–Friday.
5. Avoid repeating the same main tea within a single week unless the meal is explicitly a planned leftover.
6. Allow leftovers to appear for lunch.
7. If Saturday takeaway is enabled, select one supported takeaway category for Saturday's Tea.
8. Use the selected profile to adjust meal structure and convenience choices.
9. Initialise day status as unassessed.
10. Save the generated suggestions and preferences locally.
11. Allow edits and confirmations without silently regenerating existing entries.

Use a seeded or stored random selection approach where appropriate so the meal selection remains stable across page refreshes. Generate a new selection only when the user explicitly requests regeneration or creates another week's plan.

### 6.3 Meal realism

Meal generation should prioritise believable combinations rather than arbitrary random selections.

For example, a weekday might include porridge for breakfast, leftovers for lunch, and chicken fajitas for tea. Another day could include cereal, a tuna jacket potato and a sausage traybake.

The generator should avoid:

- The same meal appearing repeatedly without reason.
- Implausible meal combinations.
- Excessive reliance on takeaway food.
- Making every snack a protein-focused diet food.
- Presenting every day as perfectly balanced.
- Adding calories or nutritional claims that have not been calculated.

## 7. Technical architecture

### 7.1 Recommended stack

- **Frontend:** Vanilla HTML, CSS and JavaScript, or a lightweight TypeScript-based frontend.
- **Hosting:** GitHub Pages.
- **PWA:** Web app manifest and service worker.
- **Persistence:** Browser local storage.
- **Icons:** Native emoji or locally bundled SVG icons.
- **Build tooling:** Optional; prefer a minimal build process.
- **External APIs:** None required.

A static application is sufficient for the MVP. There is no need for a server, database or paid hosting.

### 7.2 Hosting and installation

The application must:

- Be deployed to a public GitHub Pages URL.
- Support HTTPS.
- Be installable on iOS through Safari's Share menu and **Add to Home Screen**.
- Provide an appropriate app name, icon and theme colour.
- Include a service worker that caches the application shell.
- Continue to open and support existing local journals while offline.
- Use a deployment configuration that correctly handles the GitHub Pages repository subpath.

Document the deployment steps in a README, including repository setup, Pages configuration, deployment and how to update the app.

### 7.3 Offline behaviour

After the first successful load, the app should be usable without an internet connection.

Cache the HTML, CSS, JavaScript, manifest and required icons.

All meal data and generation logic must be bundled with the application. Avoid dependencies that require a live CDN at runtime.

### 7.4 Privacy and security

- No user account or personal profile is required.
- No analytics or advertising is required.
- No tracking data should be sent to a server.
- Use local storage only for the MVP.
- Explain that clearing browser data may erase locally saved journals.
- Do not request unnecessary permissions.
- Do not embed credentials or API keys.

## 8. Accessibility and compatibility

The app should:

- Work on current iOS Safari and desktop browsers.
- Use semantic HTML and accessible form labels.
- Support keyboard navigation where applicable.
- Maintain readable contrast.
- Provide status text as well as RAG emojis.
- Avoid relying on colour alone.
- Support dynamic text sizing where practical.
- Ensure copy and edit controls have descriptive accessible names.

## 9. Acceptance criteria

The MVP is accepted when the following conditions pass.

### AC-01: Generate a week

Given the user opens the application, when they generate a journal with the default settings, then seven consecutive days appear from Tuesday through the following Monday, each with Breakfast, Lunch, Tea and Snacks.

### AC-02: Change the week start

Given the user changes the start date to Monday, when they generate a new journal, then the journal covers Monday through Sunday with the correct dates.

### AC-03: Great profile default

Given a new user opens the application, then Great is selected by default and the generated plan reflects a generally consistent, sustainable meal routine.

### AC-04: Change consistency profile

Given the user selects Medium or Poor, when they generate a new journal, then the meal selection changes appropriately without changing the date range or introducing calorie tracking.

### AC-05: Saturday takeaway

Given the Saturday takeaway checkbox is enabled, when the user generates a journal, then Saturday's Tea contains a supported takeaway category and realistic meal description.

### AC-06: Takeaway variation

Given the user creates multiple new journals, then the takeaway category is capable of varying across generations rather than remaining permanently fixed.

### AC-07: Meal editing

Given a suggested meal does not reflect what the user ate, when they edit it, then the updated text persists after a page refresh and appears in the exported journal.

### AC-08: Confirmation and RAG

Given a day has unreviewed or incomplete entries, then it must not automatically display green. The user can explicitly set the appropriate daily status.

### AC-09: Copy journal

Given the user has reviewed their journal, when they press Copy journal, then the application copies readable plain text containing the seven days, dates, RAG emojis and all four meal categories.

### AC-10: Persistence across weeks

Given the user has saved a journal for one date range, when they start another week, then the existing journal remains available and is not overwritten without confirmation.

### AC-11: Offline access

Given the application has been loaded successfully and its assets cached, when the device goes offline, then the application can reopen and display locally saved journals.

### AC-12: Free hosting

Given the repository is deployed to GitHub Pages, then the application works over HTTPS without requiring a paid hosting service, backend or API subscription.

### AC-13: No calorie tracking

Across all screens and exported output, there are no calorie totals, macro calculations, calorie goals or weight-loss targets.

### AC-14: Accurate export

Given the journal contains unconfirmed suggestions, when the user exports it, then the application does not silently present those suggestions as verified food records.

### AC-15: Share as images

Given the user has entered their name and generated a journal, when they create share images, then two 1080 × 1920 PNG previews appear covering days 1–4 and days 5–7, each showing their name and the week's date range, and following the same status, unconfirmed and skipped rules as the plain-text export.

### AC-16: Share sheet and fallback

Given the browser supports sharing files, when the user taps **Share or save images**, then the system share sheet opens with both PNG files. Given it does not, then the share button is hidden and each image can be saved with a long press or downloaded.

### AC-17: No stale images

Given share images have been created, when the user edits the journal, changes week or changes their name, then the preview is discarded and must be created again before sharing.

## 10. Success metrics

The MVP should be evaluated against the following usability targets:

- A new journal can be generated in under 30 seconds.
- A user can review, confirm and copy a week in under two minutes.
- A completed journal contains all seven days and 28 meal categories.
- Share images for an away week can be created and sent to the team chat in under 30 seconds.
- No edits are lost during ordinary refreshes or navigation.
- The application remains usable offline after its first successful load.
- The full deployment can be maintained without recurring hosting or API costs.

These are target metrics, not claims of measured performance.

## 11. Delivery plan

### Phase 1 — Core journal

- Build the mobile-first interface.
- Implement configurable week start and date calculation.
- Create the meal library and generation logic.
- Add Great, Medium and Poor profiles.
- Implement Saturday takeaway selection.
- Add meal editing and confirmation.
- Add daily RAG statuses.

### Phase 2 — Persistence and export

- Save preferences and journals locally.
- Implement copy-to-clipboard.
- Add journal history and new-week handling.
- Add destructive-action confirmations.
- Test the plain-text output in Apple Notes.

### Phase 3 — PWA and deployment

- Add the manifest and icons.
- Implement service worker caching.
- Test offline operation.
- Configure GitHub Pages.
- Document installation and deployment.
- Test on an actual iPhone using Safari.

## 12. Definition of done

The product is complete when a user can open the free hosted PWA on an iPhone, generate a realistic Tuesday–Monday meal plan, configure the consistency profile and Saturday takeaway, edit and confirm their actual meals, set each day's RAG status, and copy the resulting journal into Apple Notes.

The finished application should be fast, private, easy to maintain and entirely usable without calorie tracking, accounts, subscriptions or paid infrastructure.
