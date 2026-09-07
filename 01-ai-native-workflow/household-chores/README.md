# Household Chores

A small Django app for a shared home to keep chores visible and accountable.

## Features

- Add a chore with an assignee, due date, and recurrence label.
- See open chores, with overdue items clearly marked.
- Mark a chore complete from the dashboard.
- Filter the dashboard by household member.

## Run locally

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Open http://127.0.0.1:8000/.

## Tests

```bash
python manage.py test
```

The product scope and implementation backlog are in [`_docs/`](./_docs/).
