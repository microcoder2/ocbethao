# Gemini Project Context: Oc Be Thao

This document provides a comprehensive overview of the "Oc Be Thao" project, its structure, and operational commands to facilitate development and interaction with the Gemini CLI.

## Project Overview

"Oc Be Thao" is a full-stack monorepo application designed for a Food & Beverage (F&B) business. It separates the backend API and the frontend client into distinct workspaces.

-   **Backend (`/api`):** A RESTful API built with Node.js and Express. It uses TypeScript for type safety, Prisma as the ORM for a MySQL database, and TSOA for automated route and Swagger specification generation from controllers.

-   **Frontend (`/frontend`):** A modern single-page application (SPA) built with Vue 3 and Vite. It also uses TypeScript and is styled with the Bootstrap framework.

-   **Monorepo Structure:** The project is managed as an npm workspace, allowing for unified dependency installation and concurrent script execution across both the `api` and `frontend` packages.

### Key Features

-   Role-based authentication (Admin, Staff, Customer).
-   Management of menu items, categories, and daily menus.
-   Real-time order processing and tracking for customers and staff.
-   Administrative dashboard for business analytics.

## Building and Running the Project

The project is configured with `npm` scripts to streamline development, building, and database management. All commands should be run from the root directory (`ocbethao/`).

### Primary Commands (Root Workspace)

-   **Install all dependencies:**
    ```bash
    npm install
    ```

-   **Run frontend and backend in development mode:**
    This command starts both the API and frontend servers concurrently. The frontend is typically available at `http://localhost:5174` and the API at `http://localhost:3000`.
    ```bash
    npm run dev
    ```

-   **Build both applications for production:**
    ```bash
    npm run build
    ```

### Database Commands (Executed via Root)

-   **Apply schema changes to the database:**
    (Uses `prisma db push` in the API workspace)
    ```bash
    npm run db:push
    ```

-   **Seed the database with initial data:**
    (Runs the `prisma/seed.ts` script in the API workspace)
    ```bash
    npm run seed
    ```

### Default Seed Accounts

-   **Admin:** `admin@ocbethao.local` / `123456`
-   **Staff:** `staff@ocbethao.local` / `123456`
-   **Customer:** `0909000003` / `123456`

## Development Conventions

-   **Code:** The entire project (both frontend and backend) is written in TypeScript.
-   **API Development:** Controllers are located in `api/src/controllers/`. TSOA reads these files to generate Express routes and a `swagger.json` file. Any new or modified controller requires regenerating the routes, which is handled automatically by the `npm run dev` script in the `api` workspace.
-   **Database:** The database schema is managed declaratively with Prisma Schema at `api/prisma/schema.prisma`. Changes are pushed to the database using `npm run db:push`.
-   **Environment Configuration:** Both the `api` and `frontend` applications use `.env` files for configuration. Example files (`.env.example`) are provided in their respective directories.
-   **Authentication:** The backend controls which authentication providers (Password, Google, Facebook) are enabled via the `AUTH_ENABLED_LOGIN_PROVIDERS` variable in `api/.env`.
