from django.contrib import admin
from .models import Chore


@admin.register(Chore)
class ChoreAdmin(admin.ModelAdmin):
    list_display = ("title", "assignee", "due_date", "recurrence", "completed_at")
    list_filter = ("recurrence", "completed_at")
    search_fields = ("title", "assignee")
