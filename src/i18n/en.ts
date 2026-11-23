/**
 * English copy, and the source of truth for which keys exist. `pt.ts` is typed against it.
 *
 * Keys are grouped by where the string appears. `{name}` placeholders must match in every locale;
 * a `.one` / `.other` pair is a plural, reached through `plural()`. Anything with a variable in it
 * is a whole sentence with a placeholder, never fragments joined in English word order.
 */

export const en = {
  // ------------------------------------------------------------------- app
  "app.locale": "Language",
  "theme.label": "Theme",
  "theme.system": "Follow the system",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "nav.week": "Week",
  "nav.history": "History",
  "nav.dishes": "Dishes",
  "nav.toValidate": "To validate",
  "nav.toDecide": "To decide",
  "nav.ingredients": "Ingredients",
  "nav.settings": "Settings",
  "nav.review": "To review",

  // ---------------------------------------------------------------- common
  "common.loading": "Loading…",
  "common.save": "Save",
  "common.saved": "Saved",
  "common.add": "Add",
  "common.remove": "Remove {name}",
  "common.refresh": "Refresh",
  "common.undo": "Undo",
  "common.rating": "{value} of 5",
  "common.notRated": "not rated",
  "common.close": "Close",
  "common.saving": "Saving…",

  // ---------------------------------------------------------------- review
  "review.empty": "Nothing to review. New dishes from Claude and undecided ingredients show up here.",
  "review.dishes": "New dishes",
  "review.position": "Dish {index} of {total}",
  "review.validate": "Validate",
  "review.skip": "Next",
  "review.edit": "Edit",
  "review.validated": "{dish} validated",
  "review.archived": "{dish} archived",
  "review.ingredients": "Ingredients to decide",
  "review.ingredientsHint": "Say whether each one is safe for the restrictions in the household.",

  // ---------------------------------------------------------------- toasts
  "toast.skipped": "{dish} marked as not made",
  "toast.replaced": "{dish} marked as replaced",
  "toast.restored": "{dish} back in the plan",
  // ---------------------------------------------------------------- aisles
  "aisle.produce": "Fruit and veg",
  "aisle.bakery": "Bakery",
  "aisle.butcher": "Butcher",
  "aisle.fish": "Fish",
  "aisle.dairy": "Dairy and eggs",
  "aisle.pantry": "Pantry",
  "aisle.frozen": "Frozen",
  "aisle.misc": "Other",

  // -------------------------------------------------------------- calendar
  "calendar.choose": "Choose a week",
  "calendar.thisWeek": "This week",
  "calendar.previousMonth": "Previous month",
  "calendar.nextMonth": "Next month",
  "calendar.hasPlan": "has a plan",

  // ----------------------------------------------------------------- board
  "board.cookDay": "cook on this day",
  "board.noMeal": "no meal",

  // -------------------------------------------------------------- shopping
  "shopping.share": "Share",
  "shopping.copy": "Copy",
  "shopping.copied": "Copied",
  "shopping.bought": "{count} of {total} bought",
  "shopping.estimate": "Estimated {total} of {budget}",
  "shopping.heading": "Shopping list, week of {day}",

  // ---------------------------------------------------------- restrictions
  "contains.label": "Contains",
  "contains.confirm": "Confirm",
  "contains.none": "None of these",
  "contains.decided": "Decided",

  // ------------------------------------------------------------------ tags
  "tags.protein": "Protein",
  "tags.base": "Base of the dish",
  "tags.extra": "Other tags (comma separated)",
  "tags.missing": "Pick a protein and a base.",
  "tag.carne": "meat",
  "tag.peixe": "fish",
  "tag.marisco": "seafood",
  "tag.ovos": "eggs",
  "tag.vegetariano": "vegetarian",
  "tag.arroz": "rice",
  "tag.massa": "pasta",
  "tag.batata": "potato",
  "tag.leguminosas": "pulses",
  "tag.pão": "bread",
  "tag.sopa": "soup",

  // ----------------------------------------------------- ingredient picker
  "ingredients.new": "New ingredient",
  "ingredients.unit": "Unit",
  "ingredients.price": "Price",
  "ingredients.aisle": "Aisle",
  "picker.search": "Find an ingredient…",
  "picker.create": "Create “{name}”",
  "picker.noMatch": "No ingredient with that name yet.",

  // ---------------------------------------------------------------- errors
  "error.generic": "Something went wrong.",
  "error.not_found": "Not found.",
  "error.invalid": "Some values are not valid.",
  "error.unauthorized": "Your session ended. Reload to sign in again.",
  "error.name_taken": "That name is already in use.",
  "error.in_use": "The unit cannot change while dishes use this ingredient.",
  "error.email_taken": "That email is already in the household.",
  "error.unit_mismatch": "{ingredient} already exists with another unit.",
  "error.undecided_ingredients": "Decide safe or forbidden for every ingredient below before validating.",
  "error.not_pending": "Only dishes waiting for validation can be validated.",
  "error.no_ingredients": "Add ingredients before validating.",
  "error.week_start_not_monday": "Weeks start on Monday.",

  // ----------------------------------------------------------------- terms
  "status.planned": "planned",
  "status.done": "done",
  "status.skipped": "skipped",
  "status.replaced": "replaced",
  "dishStatus.pending": "to validate",
  "dishStatus.validated": "validated",
  "dishStatus.archived": "archived",
  "slot.lunch": "lunch",
  "slot.dinner": "dinner",
  "restriction.safe": "safe",
  "restriction.forbidden": "forbidden",
  "unit.g": "g",
  "unit.ml": "ml",
  "unit.un": "un",
  "dish.portions.one": "{count} portion",
  "dish.portions.other": "{count} portions",

  // ------------------------------------------------------------------ week
  "week.title": "Week of {day}",
  "week.previous": "← Previous",
  "week.next": "Next →",
  "week.summary": "For {people} · planned {total} of {budget}",
  "week.overBudget": "over budget",
  "week.empty": "No plan for this week yet.",
  "week.plan.title": "Plan with Claude",
  "week.plan.retitle": "Re-plan with Claude",
  "week.plan.who": "Who is eating?",
  "week.plan.notes": "Anything special this week?",
  "week.plan.notesHint": "e.g. we eat out Thursday, guests on Saturday",
  "week.plan.openApp": "Open in Claude app",
  "week.plan.openWeb": "Open claude.ai",
  "week.plan.copy": "Copy prompt",
  "week.plan.copied": "Copied",
  "week.plan.help": "Claude saves the plan here through the {app} connector; press Refresh when it is done.",
  "cooking.cook": "Cook {day} · {portions} · {cost}",
  "cooking.eat": "Eat {meals}",
  "cooking.replacedBy": "replaced by {dish}",
  "cooking.skip": "Skipped",
  "cooking.replace": "Replaced…",
  "cooking.replacePick": "A dish from the catalogue…",
  "cooking.replaceOther": "…or something else",
  "shopping.title": "Shopping list",
  "shopping.noPrice": "no price",
  "shopping.total": "Total {amount}",
  "shopping.missing.one": "{count} price missing",
  "shopping.missing.other": "{count} prices missing",

  // --------------------------------------------------------------- history
  "history.empty": "Nothing eaten yet.",
  "history.commentHint": "What went well or badly?",
  "history.rateFirst": "Rate first, then comment",

  // ---------------------------------------------------------------- dishes
  "dishes.new": "New dish",
  "dishes.tab.validated": "Validated",
  "dishes.tab.archived": "Archived",
  "dishes.tag": "Tag",
  "dishes.empty": "No dishes here.",
  "dishes.summary": "{portions} · {cost}/portion · every {days} days · last {last}",
  "dishes.missingPrice": "(prices missing)",
  "dishes.never": "never",
  "dishes.byClaude": "by Claude",
  "dish.validate": "Validate",
  "dish.archive": "Archive",
  "dish.unarchive": "Unarchive",
  "dish.name": "Name",
  "dish.tags": "Tags (comma separated)",
  "dish.portionsField": "Portions the recipe makes",
  "dish.interval": "Repeat at most every (days)",
  "dish.notes": "Notes",
  "dish.ingredient": "Ingredient",
  "dish.quantity": "Qty",
  "dish.newPrice": "€ (new)",
  "dish.addIngredient": "Add ingredient",
  "dish.create": "Create",
  "dish.restrictions": "Restrictions",
  "dish.costPerPortion": "{cost} per portion",
  "dish.someMissing": "(some prices missing)",
  "dish.feedback": "Feedback",

  // ----------------------------------------------------------- ingredients
  "ingredients.all": "All",
  "ingredients.nothingToDecide": "Nothing to decide.",
  "ingredients.empty": "No ingredients yet.",

  // -------------------------------------------------------------- settings
  "settings.budget": "Weekly budget (€)",
  "settings.lunches": "Lunches per week",
  "settings.none": "None.",
  "settings.hard": "hard (never)",
  "settings.soft": "soft (avoid)",
  "settings.weight": "weight",
  "settings.restrictionHint": "e.g. gluten, lactose",
  "settings.addRestriction": "Add restriction",
  "settings.preferences": "Preferences",
  "settings.addPerson": "Add person: name",
  "settings.email": "Email they sign in with",
  "settings.accessNote": "Online, they also need to be on the sign-in list (Access) to open the app.",

  // ------------------------------------------------- prompt sent to Claude
  "prompt.plan": "Use the {app} tools to plan lunches for the week starting {day} ({date}), {who}.",
  "prompt.everyone": "for everyone",
  "prompt.only": "only for {names}",
  "prompt.and": "{first} and {last}",
  "prompt.notes": "Notes for this week: {notes}",
  "prompt.steps":
    "Start with get_context and list_candidates, then save the plan with save_plan. If a good dish is missing from the catalogue, propose it with add_dish.",
} as const;
