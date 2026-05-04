# Employee Management System

A responsive Vue.js employee management app that performs CRUD operations with
Axios against a MockAPI `employees` resource.

## Features

- Add employee records
- View employees in a responsive Bootstrap table
- Update existing records
- Delete records with confirmation
- Clean Vue 3 composition API structure

## Tech Stack

- Vue 3
- Axios
- Bootstrap 5
- Vite

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```bash
VITE_MOCKAPI_URL=https://69f8d10af7044aa0103e8708.mockapi.io/post/:endpoint
```

3. Make sure your MockAPI project contains a resource named `employees` with
   these fields:

- `employeeId`
- `name`
- `designation`
- `department`
- `salary`

If your MockAPI URL includes `/:endpoint`, the app maps that placeholder to
`employees` automatically.

4. Run the app:

```bash
npm run dev
```

5. Open the local URL shown by Vite, usually:

```bash
http://localhost:3000
```

## MockAPI Request Shape

- `GET /employees`
- `POST /employees`
- `PUT /employees/:id`
- `DELETE /employees/:id`

Example payload:

```json
{
  "employeeId": "EMP-101",
  "name": "Aarav Sharma",
  "designation": "Software Engineer",
  "department": "IT",
  "salary": 50000
}
```

## Submission Notes

- Add screenshots of the working CRUD flow.
- Include the MockAPI project link in your submission sheet.
- Push the project to GitHub after verifying `npm run dev`.
