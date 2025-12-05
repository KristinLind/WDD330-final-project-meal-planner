import { defineConfig } from "vite";

export default defineConfig({
    root: ".",
    publicDir: "public",
        build: {
        rollupOptions: {
            input: {
                main: "index.html",
                mealPlanner: "meal-planner.html",
                shoppingList: "shopping-list.html",
                recipeDetail: "recipe-detail.html",
                savedRecipes: "saved-recipes.html"),
            },
        },
    },
});
