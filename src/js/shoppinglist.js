// src/js/shoppinglist.js

// --- Config ---
const HEADER_PARTIAL_URL = "/partials/header.html";
const FOOTER_PARTIAL_URL = "/partials/footer.html";

const MEAL_PLAN_KEY = "mealPlanV1";
const SHOPPING_EXTRAS_KEY = "shoppingExtrasV1";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEALS = ["Breakfast", "Lunch", "Dinner"];

// --- Partial Loader ---
async function loadPartial(selector, url) {
  const container = document.querySelector(selector);
  if (!container) return;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load partial: ${url}`);
    }
    const html = await response.text();
    container.innerHTML = html;
  } catch (error) {
    console.error(error);
    container.innerHTML =
      "<p class='error'>Sorry, we couldn’t load this section.</p>";
  }
}

// --- Mobile Nav Toggle ---
function initNavToggle() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");

  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

// --- Meal Plan Storage Helpers ---
function createEmptyPlan() {
  const plan = {};
  DAYS.forEach((day) => {
    MEALS.forEach((meal) => {
      const key = `${day.toLowerCase()}-${meal.toLowerCase()}`;
      plan[key] = "";
    });
  });
  return plan;
}

function loadPlanFromStorage() {
  try {
    const raw = localStorage.getItem(MEAL_PLAN_KEY);
    if (!raw) return createEmptyPlan();
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : createEmptyPlan();
  } catch (e) {
    console.error("Error reading meal plan from localStorage", e);
    return createEmptyPlan();
  }
}

// --- Shopping Extras Storage ---
function loadShoppingExtras() {
  try {
    const raw = localStorage.getItem(SHOPPING_EXTRAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("[shopping-list] error reading shopping extras", e);
    return [];
  }
}

function saveShoppingExtras(list) {
  try {
    localStorage.setItem(SHOPPING_EXTRAS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("[shopping-list] error saving shopping extras", e);
  }
}

// --- Build Recipe Summary ---
function buildShoppingListFromPlan(plan) {
  const resultMap = new Map();

  DAYS.forEach((day) => {
    MEALS.forEach((meal) => {
      const key = `${day.toLowerCase()}-${meal.toLowerCase()}`;
      const recipeName = (plan[key] || "").trim();
      if (!recipeName) return;

      const normalized = recipeName.toLowerCase();
      if (!resultMap.has(normalized)) {
        resultMap.set(normalized, {
          name: recipeName,
          count: 0,
          slots: [],
        });
      }

      const entry = resultMap.get(normalized);
      entry.count += 1;
      entry.slots.push({ day, meal });
    });
  });

  // Convert to array, sort by name
  return Array.from(resultMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

// --- Group extras ---
function groupExtras(extras) {
  const groups = new Map();

  extras.forEach((item) => {
    const fromTitle = item.fromRecipeTitle || "";
    const key = fromTitle || "manual";

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        type: fromTitle ? "recipe" : "manual",
        title: fromTitle || "Other Items",
        items: [],
      });
    }

    groups.get(key).items.push(item);
  });

  // Sort: recipe groups by title, "Other Items" last
  return Array.from(groups.values()).sort((a, b) => {
    if (a.type === "manual" && b.type !== "manual") return 1;
    if (b.type === "manual" && a.type !== "manual") return -1;
    return a.title.localeCompare(b.title);
  });
}

// --- Consolidated list helper ---
function buildConsolidatedList(extras) {
  const map = new Map();

  extras.forEach((item) => {
    const rawName = (item.name || "").trim();
    if (!rawName) return;

    const key = rawName.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        name: rawName,
        measures: [],
        fromRecipes: new Set(),
        type: item.type || "manual",
      });
    }

    const entry = map.get(key);

    if (item.measure && item.measure.trim()) {
      entry.measures.push(item.measure.trim());
    }

    if (item.fromRecipeTitle) {
      entry.fromRecipes.add(item.fromRecipeTitle);
    }
  });

  return Array.from(map.values())
    .map((entry) => ({
      name: entry.name,
      type: entry.type,
      measures: entry.measures,
      fromRecipes: Array.from(entry.fromRecipes),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

let currentPlan = loadPlanFromStorage();
let extras = loadShoppingExtras();

function renderShoppingList() {
  const root = document.querySelector("#shopping-list-root");
  if (!root) return;

  currentPlan = loadPlanFromStorage();
  extras = loadShoppingExtras();

  const aggregated = buildShoppingListFromPlan(currentPlan);

  const totalSlots = Object.values(currentPlan).filter(
    (value) => value && value.trim() !== ""
  ).length;

  const ingredientCount = extras.filter((e) => e.type === "ingredient").length;
  const manualCount = extras.filter((e) => e.type !== "ingredient").length;

  const summaryHtml = `
    <section class="shopping-summary-card">
      <h2>Shopping Summary</h2>
      <p>
        Based on your current weekly meal plan, you have
        <strong>${totalSlots}</strong> planned meal slot${totalSlots === 1 ? "" : "s"}
        generating
        <strong>${aggregated.length}</strong> unique recipe item${aggregated.length === 1 ? "" : "s"}.
      </p>
      <p class="small-note">
        You currently have
        <strong>${ingredientCount}</strong> ingredient item${ingredientCount === 1 ? "" : "s"}
        and
        <strong>${manualCount}</strong> extra item${manualCount === 1 ? "" : "s"}
        in your shopping list.
      </p>
      <button id="print-shopping-btn" class="btn-secondary">
        Print / Save as PDF
      </button>
      <p class="small-note">
        Tip: Use your browser's "Save as PDF" option in the print dialog.
      </p>
    </section>
  `;

  const itemsHtml = aggregated.length
    ? `
      <section class="shopping-group-card">
        <h2>Recipes from Meal Plan</h2>
        <ul class="shopping-list">
          ${aggregated
      .map((item) => {
        const slotText = item.slots
          .map((slot) => `${slot.day} ${slot.meal}`)
          .join(", ");

        return `
                <li class="shopping-item">
                  <div class="shopping-item-main">
                    <input type="checkbox" class="shopping-item-checkbox" />
                    <span class="shopping-item-name">${item.name}</span>
                    ${item.count > 1
            ? `<span class="shopping-item-count">×${item.count}</span>`
            : ""
          }
                  </div>
                  <div class="shopping-item-meta">
                    From: ${slotText}
                  </div>
                </li>
              `;
      })
      .join("")}
        </ul>
      </section>
    `
    : `
      <section class="shopping-group-card">
        <h2>Recipes from Meal Plan</h2>
        <p class="small-note">
          No recipes found in your current meal plan. Add meals to the planner first, then come back here.
        </p>
      </section>
    `;

  // --- Extra ingredients ---
  const groups = groupExtras(extras);

  const extrasGroupsHtml = groups.length
    ? groups
      .map(
        (group) => `
        <section class="shopping-group-subcard" data-group="${group.key}">
          <header class="shopping-group-header">
            <h3>${group.type === "manual"
            ? "Other Items"
            : `Ingredients from: ${group.title}`
          }</h3>
            <button
              type="button"
              class="shopping-group-clear"
              data-group="${group.key}"
            >
              ${group.type === "manual" ? "Clear Items" : "Clear This Recipe"}
            </button>
          </header>
          <ul class="shopping-list shopping-extras-list">
            ${group.items
            .map(
              (item) => `
              <li class="shopping-item" data-id="${item.id}">
                <div class="shopping-item-main">
                  <input
                    type="checkbox"
                    class="extra-item-checkbox"
                    ${item.checked ? "checked" : ""}
                  />
                  <span class="shopping-item-name ${item.checked ? "checked" : ""
                }">
                    ${item.name}
                  </span>
                  ${item.measure
                  ? `<span class="shopping-item-measure">${item.measure}</span>`
                  : ""
                }
                  <button
                    type="button"
                    class="extra-item-remove"
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
                ${item.fromRecipeTitle
                  ? `<div class="shopping-item-meta">From recipe: ${item.fromRecipeTitle}</div>`
                  : ""
                }
              </li>
            `
            )
            .join("")}
          </ul>
        </section>
      `
      )
      .join("")
    : `<p class="small-note">No ingredients or extra items yet. Add them from a recipe detail page or below.</p>`;

  const extrasCardHtml = `
    <section class="shopping-group-card">
      <div class="shopping-group-header">
        <h2>Ingredients & Extra Items</h2>
        <button id="clear-all-shopping-btn" class="clear-saved-btn">
          Clear All Items
        </button>
      </div>

      <form id="extra-item-form" class="extra-item-form">
        <label for="extra-item-input" class="sr-only">Add item</label>
        <input
          type="text"
          id="extra-item-input"
          placeholder="Add an extra item (e.g., milk, eggs, snacks)…"
          autocomplete="off"
        />
        <button type="submit" class="btn-secondary">Add</button>
      </form>

      <div class="shopping-extras-container">
        ${extrasGroupsHtml}
      </div>
    </section>
  `;

  const consolidated = buildConsolidatedList(extras);

  const consolidatedHtml = consolidated.length
    ? `
      <section class="shopping-group-card">
        <div class="shopping-group-header">
          <h2>Consolidated Shopping List</h2>
          <p class="small-note">
            Ingredients with the same name are grouped for easier shopping.
          </p>
        </div>
        <ul class="shopping-list shopping-consolidated-list">
          ${consolidated
      .map(
        (item) => `
              <li class="shopping-item">
                <div class="shopping-item-main">
                  <span class="shopping-item-name">${item.name}</span>
                  ${item.measures.length
            ? `<span class="shopping-item-measure">
                          ${item.measures.join(", ")}
                        </span>`
            : ""
          }
                </div>
                ${item.fromRecipes.length
            ? `<div class="shopping-item-meta">
                        From: ${item.fromRecipes.join(", ")}
                      </div>`
            : ""
          }
              </li>
            `
      )
      .join("")}
        </ul>
      </section>
    `
    : "";

  root.innerHTML = `
    <div class="shopping-layout">
      ${summaryHtml}
      ${itemsHtml}
      ${extrasCardHtml}
      ${consolidatedHtml}
    </div>
  `;

  attachShoppingEvents();
}

// --- Events ---
function attachShoppingEvents() {
  const form = document.querySelector("#extra-item-form");
  const input = document.querySelector("#extra-item-input");
  const extrasContainer = document.querySelector(".shopping-extras-container");

  // Print button
  const printBtn = document.querySelector("#print-shopping-btn");
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }

  // Clear all shopping items
  const clearAllBtn = document.querySelector("#clear-all-shopping-btn");
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", () => {
      const ok = confirm("Clear all ingredients and extra items?");
      if (!ok) return;

      saveShoppingExtras([]);
      renderShoppingList();
    });
  }

  // Add manual extra item
  if (form && input) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) return;

      const current = loadShoppingExtras();

      current.push({
        id: Date.now().toString(),
        type: "manual",
        name: value,
        measure: "",
        fromRecipeId: null,
        fromRecipeTitle: null,
        checked: false,
      });

      saveShoppingExtras(current);
      input.value = "";
      renderShoppingList();
    });
  }

  // Handle check / remove / clear-by-group
  if (extrasContainer) {
    extrasContainer.addEventListener("click", (event) => {
      const target = event.target;

      // Clear all in group
      if (target.classList.contains("shopping-group-clear")) {
        const groupKey = target.dataset.group;
        let current = loadShoppingExtras();

        current = current.filter((item) => {
          const fromTitle = item.fromRecipeTitle || "";
          const key = fromTitle || "manual";
          return key !== groupKey;
        });

        saveShoppingExtras(current);
        renderShoppingList();
        return;
      }

      // Individual items (checkboxes + remove button)
      const li = target.closest(".shopping-item");
      if (!li) return;
      const id = li.dataset.id;
      if (!id) return;

      let current = loadShoppingExtras();

      // Toggle checked
      if (target.classList.contains("extra-item-checkbox")) {
        current = current.map((item) =>
          item.id === id ? { ...item, checked: !item.checked } : item
        );
        saveShoppingExtras(current);
        renderShoppingList();
        return;
      }

      // Remove single item
      if (target.classList.contains("extra-item-remove")) {
        current = current.filter((item) => item.id !== id);
        saveShoppingExtras(current);
        renderShoppingList();
        return;
      }
    });
  }
}

// --- MAIN INIT ---
async function init() {
  await Promise.all([
    loadPartial("#site-header", HEADER_PARTIAL_URL),
    loadPartial("#site-footer", FOOTER_PARTIAL_URL),
  ]);

  initNavToggle();
  renderShoppingList();
}

init();
