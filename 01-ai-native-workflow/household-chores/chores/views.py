from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from .forms import ChoreForm
from .models import Chore


def dashboard(request):
    assignee = request.GET.get("assignee", "").strip()
    open_chores = Chore.objects.filter(completed_at__isnull=True)
    chores = open_chores
    if assignee:
        chores = chores.filter(assignee__iexact=assignee)
    members = (
        Chore.objects.filter(completed_at__isnull=True)
        .exclude(assignee="")
        .order_by("assignee")
        .values_list("assignee", flat=True)
        .distinct()
    )
    return render(request, "chores/dashboard.html", {
        "chores": chores,
        "members": members,
        "selected_assignee": assignee,
        "open_count": open_chores.count(),
        "overdue_count": open_chores.filter(due_date__lt=timezone.localdate()).count(),
        "member_count": members.count(),
    })


def create_chore(request):
    if request.method == "POST":
        form = ChoreForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect("dashboard")
    else:
        form = ChoreForm()
    return render(request, "chores/chore_form.html", {"form": form})


@require_POST
def complete_chore(request, chore_id):
    chore = get_object_or_404(Chore, pk=chore_id)
    chore.complete()
    return redirect("dashboard")
