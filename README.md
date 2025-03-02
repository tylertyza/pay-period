# Pay Period Allocator

A mobile-friendly web application for tracking recurring expenses and determining how much each person needs to set aside per pay period.

## Overview

Pay Period Allocator replaces an Excel spreadsheet used to track recurring expenses and determine how much each person needs to set aside per pay period. The app allocates funds to specific bank accounts (e.g. "Spending", "Bills", "Joint Bills"), allows flexible frequency inputs, supports custom splitting ratios (defaulting to 50/50), and tracks income to calculate net remaining funds after expenses.

## Features

- **User Authentication**: Secure login via Supabase Auth
- **Expense Management**: Add, edit, and delete recurring expenses
- **Income Tracking**: Record and manage income sources
- **Flexible Frequency Handling**: Input expenses/income in any frequency (daily, weekly, bi-weekly, monthly, etc.)
- **Dynamic Conversion**: Toggle between different frequency displays while preserving original inputs
- **Custom Splitting**: Set custom ratios for expense sharing (defaults to 50/50)
- **Bank Account Allocation**: Assign expenses to specific accounts
- **Data Import**: Import expense data from CSV/Excel files
- **Mobile-Friendly Design**: Responsive UI with dark mode

## Technology Stack

- **Frontend**: HTML, CSS (TailwindCSS), Vanilla JavaScript
- **Backend**: Supabase (Authentication and PostgreSQL database)
- **Styling**: TailwindCSS with a modern UI inspired by shadcn

## Setup Instructions

1. Clone this repository
2. Create a Supabase project at [https://supabase.com](https://supabase.com)
3. Copy the `.env.example` file to `.env` and update with your Supabase URL and anon key:
   ```
   cp .env.example .env
   ```
4. Edit the `.env` file with your actual Supabase credentials
5. Run the SQL scripts in the `database` directory to set up your database schema
6. Install Node.js if you don't have it already
7. Install TailwindCSS: `npm install -g tailwindcss`
8. Build the CSS: `node build.js`
9. Start the server: `node server.js`
10. Open your browser and navigate to `http://localhost:3000`

Alternatively, you can use the start script to build the CSS and start the server in one command:
```
node start.js
```

## Environment Variables

The application requires the following environment variables to be set in the `.env` file:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key

These credentials are used to connect to your Supabase project for authentication and database operations.

## Database Schema

The application uses the following database tables:

- **users**: User information and authentication
- **accounts**: Bank accounts for expense allocation
- **categories**: Expense categories for organization
- **expenses**: Recurring expense details
- **expense_splits**: How expenses are split between users
- **income**: Income sources and amounts

## Development

To set up the development environment:

1. Install Node.js if you don't have it already
2. Install TailwindCSS: `npm install -g tailwindcss`
3. For live CSS updates during development, run: `npx tailwindcss -i ./src/css/input.css -o ./public/css/styles.css --watch`
4. In a separate terminal, start the server: `node server.js`

## Deployment

The application can be deployed to any static hosting service (Netlify, Vercel, GitHub Pages, etc.) as it uses Supabase for backend services.

## Future Enhancements

- Detailed reporting and analytics
- Notifications for upcoming expenses
- Budget forecasting
- Mobile application 