// src/js/plannermodule.js

// -- Config --
const HEADER_PARTIAL_URL = "public/partials/header.html";
const FOOTER_PARTIAL_URL = "public/partials/footer.html";

const MEAL_PLAN_KEY = "mealPlanV1";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEALS = ["Breakfast", "Lunch", "Dinner"];

// -- Partial Loader --
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

// -- Storage Helpers --
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

function savePlanToStorage(plan) {
    try {
        localStorage.setItem(MEAL_PLAN_KEY, JSON.stringify(plan));
    } catch (e) {
        console.error("Error saving meal plan to localStorage", e);
    }
}

// -- Rendering --
let currentPlan = loadPlanFromStorage();

function renderPlanner() {
    const root = document.querySelector("#planner-root");
    if (!root) return;

    const headerRow = DAYS.map(
        (day) => `<div class="planner-header-cell">${day}</div>`
    ).join("");

    const rowsHTML = MEALS.map((meal) => {
        const cells = DAYS.map((day) => {
            const key = `${day.toLowerCase()}-${meal.toLowerCase()}`;
            const value = currentPlan[key] || "";
            const label = value || "Click to add meal";

            return `
        <div class="planner-cell" data-key="${key}">
          <div class="meal-slot" draggable="true">
            ${label}
          </div>
        </div>
      `;
        }).join("");

        return `
      <div class="planner-row">
        <div class="planner-meal-label">${meal}</div>
        ${cells}
      </div>
    `;
    }).join("");

    root.innerHTML = `
    <section class="planner-controls">
      <button id="clear-plan-button" class="btn-secondary">
        Clear This Week
      </button>
      <p class="planner-hint">
        Tip: Click on a slot to set a recipe name. Drag and drop meals to rearrange your week.
      </p>
    </section>

    <section class="planner-grid" aria-label="Weekly meal planner">
      <div class="planner-row planner-header-row">
        <div class="planner-meal-label"></div>
        ${headerRow}
      </div>
      ${rowsHTML}
    </section>
  `;

    attachPlannerEvents();
}

// -- Events --
let dragSourceKey = null;

function attachPlannerEvents() {
    const cells = document.querySelectorAll(".planner-cell");
    const clearButton = document.querySelector("#clear-plan-button");

    // Click to add/edit meal
    cells.forEach((cell) => {
        const slot = cell.querySelector(".meal-slot");
        const key = cell.dataset.key;

        // click to edit
        slot.addEventListener("click", () => {
            const [day, meal] = key.split("-");
            const prettyDay = day[0].toUpperCase() + day.slice(1);
            const prettyMeal = meal[0].toUpperCase() + meal.slice(1);
            const currentValue = currentPlan[key] || "";

            const result = window.prompt(
                `Enter recipe name for ${prettyDay} ${prettyMeal} (leave blank to clear):`,
                currentValue
            );

            if (result === null) return; // user cancelled

            currentPlan[key] = result.trim();
            savePlanToStorage(currentPlan);
            renderPlanner();
        });

        // drag start
        slot.addEventListener("dragstart", (event) => {
            dragSourceKey = key;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", key);
            slot.classList.add("dragging");
        });

        // drag end
        slot.addEventListener("dragend", () => {
            dragSourceKey = null;
            slot.classList.remove("dragging");
        });

        // drag over target cell
        cell.addEventListener("dragover", (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            cell.classList.add("drag-over");
        });

        cell.addEventListener("dragleave", () => {
            cell.classList.remove("drag-over");
        });

        // drop to swap meals
        cell.addEventListener("drop", (event) => {
            event.preventDefault();
            cell.classList.remove("drag-over");
            const targetKey = cell.dataset.key;
            const sourceKey = dragSourceKey || event.dataTransfer.getData("text/plain");

            if (!sourceKey || !targetKey || sourceKey === targetKey) return;

            const temp = currentPlan[sourceKey];
            currentPlan[sourceKey] = currentPlan[targetKey];
            currentPlan[targetKey] = temp;

            savePlanToStorage(currentPlan);
            renderPlanner();
        });
    });

    // Clear button
    if (clearButton) {
        clearButton.addEventListener("click", () => {
            const confirmClear = window.confirm(
                "Clear the entire meal plan for this week?"
            );
            if (!confirmClear) return;

            currentPlan = createEmptyPlan();
            savePlanToStorage(currentPlan);
            renderPlanner();
        });
    }
}

// -- Main Init --
async function init() {
    await Promise.all([
        loadPartial("#site-header", HEADER_PARTIAL_URL),
        loadPartial("#site-footer", FOOTER_PARTIAL_URL),
    ]);

    currentPlan = loadPlanFromStorage();
    renderPlanner();
}

init();
