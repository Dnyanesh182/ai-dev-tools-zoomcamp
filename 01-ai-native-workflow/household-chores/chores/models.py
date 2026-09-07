from django.db import models
from django.utils import timezone


class Chore(models.Model):
    class Recurrence(models.TextChoices):
        ONE_OFF = "one-off", "One-off"
        WEEKLY = "weekly", "Weekly"
        MONTHLY = "monthly", "Monthly"

    title = models.CharField(max_length=120)
    assignee = models.CharField(max_length=60)
    due_date = models.DateField()
    recurrence = models.CharField(max_length=10, choices=Recurrence.choices, default=Recurrence.ONE_OFF)
    completed_at = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["due_date", "title"]

    def __str__(self):
        return self.title

    @property
    def is_overdue(self):
        return self.completed_at is None and self.due_date < timezone.localdate()

    def complete(self):
        if self.completed_at is None:
            self.completed_at = timezone.localdate()
            self.save(update_fields=["completed_at"])
