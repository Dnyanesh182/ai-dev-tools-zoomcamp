from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from chores.models import Chore


class ChoreModelTests(TestCase):
    def test_overdue_only_when_open_and_past_due(self):
        chore = Chore.objects.create(title="Clean oven", assignee="Ria", due_date=timezone.localdate() - timedelta(days=1))
        self.assertTrue(chore.is_overdue)
        chore.complete()
        self.assertFalse(chore.is_overdue)
        self.assertEqual(chore.completed_at, timezone.localdate())


class DashboardTests(TestCase):
    def setUp(self):
        today = timezone.localdate()
        self.alex = Chore.objects.create(title="Take bins out", assignee="Alex", due_date=today)
        self.ria = Chore.objects.create(title="Mop kitchen", assignee="Ria", due_date=today + timedelta(days=1))
        Chore.objects.create(title="Completed", assignee="Alex", due_date=today, completed_at=today)

    def test_dashboard_shows_only_open_chores(self):
        response = self.client.get(reverse("dashboard"))
        self.assertContains(response, "Take bins out")
        self.assertContains(response, "Mop kitchen")
        self.assertNotContains(response, "Completed")

    def test_dashboard_filters_by_assignee(self):
        response = self.client.get(reverse("dashboard"), {"assignee": "Alex"})
        self.assertContains(response, "Take bins out")
        self.assertNotContains(response, "Mop kitchen")

    def test_create_chore_redirects_to_dashboard(self):
        response = self.client.post(reverse("create_chore"), {"title": "Buy soap", "assignee": "Ria", "due_date": "2026-09-10", "recurrence": "monthly"})
        self.assertRedirects(response, reverse("dashboard"))
        self.assertTrue(Chore.objects.filter(title="Buy soap", recurrence="monthly").exists())

    def test_complete_action_records_the_date(self):
        response = self.client.post(reverse("complete_chore", args=[self.alex.id]))
        self.assertRedirects(response, reverse("dashboard"))
        self.alex.refresh_from_db()
        self.assertEqual(self.alex.completed_at, timezone.localdate())
