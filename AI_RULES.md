# AI Rules for Lovable Project

This document outlines the core technologies and best practices for developing this application. Adhering to these guidelines ensures consistency, maintainability, and optimal performance.

## Tech Stack

*   **Frontend Framework**: React (with Vite for fast development)
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS
*   **UI Component Library**: shadcn/ui (built on Radix UI)
*   **Routing**: React Router DOM
*   **Data Fetching/Caching**: TanStack Query
*   **Icons**: Lucide React
*   **Form Management**: React Hook Form (with Zod for validation)
*   **Date Utilities**: date-fns
*   **Toast Notifications**: shadcn/ui's `use-toast` (for imperative toasts) and `sonner` (for declarative toasts).

## Library Usage Rules

To maintain a consistent and efficient codebase, please follow these rules when implementing features or making changes:

*   **UI Components**: Always prioritize `shadcn/ui` components. If a specific component is not available in `shadcn/ui`, create a new, custom component in `src/components/` using Tailwind CSS for styling. **Do not modify existing `shadcn/ui` component files directly.**
*   **Styling**: All styling must be done using **Tailwind CSS** classes. Avoid inline styles or separate CSS files for component-specific styling.
*   **Icons**: Use icons from the `lucide-react` library.
*   **Routing**: Manage all application routes using `react-router-dom`. Keep route definitions within `src/App.tsx`.
*   **Data Management**: For server state management, data fetching, caching, and synchronization, use `TanStack Query`.
*   **Form Handling**: For forms, use `react-hook-form` for state management and validation, typically paired with `zod` for schema definition.
*   **Toast Notifications**: For user feedback, use the `toast` function from `@/hooks/use-toast` for imperative notifications (e.g., after a successful save). The `<Sonner />` component is also available for more declarative, persistent toasts if needed.
*   **Date Manipulation**: Use `date-fns` for all date and time formatting, parsing, and manipulation tasks.
*   **Utility Functions**: For combining Tailwind CSS classes, use `clsx` and `tailwind-merge` via the `cn` utility function (`@/lib/utils`).
*   **File Structure**:
    *   New pages should be placed in `src/pages/`.
    *   New reusable components should be placed in `src/components/`.
    *   Utility functions should be placed in `src/lib/` or `src/utils/`.
    *   Hooks should be placed in `src/hooks/`.
*   **Responsiveness**: All new components and layouts must be designed with responsiveness in mind, utilizing Tailwind's responsive utility classes.
*   **Error Handling**: Do not implement `try/catch` blocks for API calls or asynchronous operations unless specifically requested. Errors should bubble up to be handled by a global error boundary or `TanStack Query`'s error handling mechanisms.
*   **Simplicity**: Always aim for the simplest and most elegant solution. Avoid over-engineering. Implement only what is necessary to fulfill the user's request.