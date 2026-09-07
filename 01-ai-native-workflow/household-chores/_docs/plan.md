# Household Chores: product specification

## Goal

Give a small shared household one place to agree on recurring and one-off chores, see who owns each task, and avoid forgotten work.

## Users

Household members who share chores. This first version has no login: a member is selected by name when a chore is created.

## In scope

1. Create a chore with a title, assignee, due date, and recurrence label (one-off, weekly, or monthly).
2. View incomplete chores on one dashboard; overdue work is visually distinguished.
3. Filter the dashboard by assignee.
4. Mark an open chore complete and retain its completion date.

## Out of scope

Authentication, notifications, editing/deleting chores, automatic regeneration of recurring chores, points, and mobile-native support.

## Acceptance criteria

- A visitor can add a valid chore and returns to the dashboard.
- The dashboard shows only incomplete chores, ordered by due date.
- Filtering by a member only shows that member’s open chores.
- Completing a chore removes it from the open dashboard and records the current date.
- A due date before today is labelled overdue.
